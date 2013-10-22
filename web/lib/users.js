/* jshint node:true */
/* jshint -W099 */
'use strict';

var common = require('./common');
var async = require('async');
var _ = require('underscore');
var mongoose = require('mongoose');
var types = mongoose.Schema.Types;

// schemas

var user_schema = new mongoose.Schema({
	email: String,
	password: String,
	role: String
});
var session_schema = new mongoose.Schema({
	user: types.ObjectId,
});
var action_schema = new mongoose.Schema({
	session: types.ObjectId,
	user: types.ObjectId,
	data: {},
	req: {}
});

// indexes

session_schema.index({
	user: 1
}, {
	unique: false,
	// user is not mandatory in session so
	// defining as sparse avoids indexing when the field is not present
	sparse: true
});

action_schema.index({
	session: 1,
	user: 1
}, {
	unique: false,
	sparse: true
});

// models

var Session = mongoose.model('Session', session_schema);
var User = mongoose.model('User', user_schema);
var Action = mongoose.model('Action', action_schema);


// mk_session is a middleware (it takes 3 arguments and can pass execution to next)
// it makes sure that the current cookie session will have a DB session
// it created a session in the DB if needed and saves its id into the cookie session
// so that next requests will have it available.
exports.mk_session = function(req, res, next) {
	if (req.session.session_id) {
		console.log('SESSION EXIST', req.session.session_id);
		return next();
	}
	var s = new Session();
	console.log('SAVE SESSION', s);
	return s.save(function(err) {
		if (err) {
			return next(err);
		}
		req.session.session_id = s.id;
		return next();
	});
};

// action_log is a route that is used to capture actions info from the UI.
// it saves the action info along with the session_id and optionaly user_id 
// to have proper links to the state when the action occured.
exports.action_log = function(req, res) {
	var act = new Action();
	// session_id is always created before this route by mk_session
	act.session = req.session.session_id;
	// user_id is not always available, but save when it does
	if (req.session.user) {
		act.user = req.session.user.id;
	}
	// pick only expected fields
	act.data = _.pick(req.body,
		'load_page',
		'check_demo',
		'check_try',
		'try_account_type',
		'contact_us',
		'user_role'
	);
	// saving request headers in case they will become valuable
	act.req = {
		headers: _.clone(req.headers)
	};
	delete act.req.headers.cookie; // not very interesting to save

	return act.save(function(err) {
		var callback = common.reply_callback(req, res, 'ACTION ' + req.session.session_id);
		return callback(err);
	});
};

// signup creates a new user with a given email
exports.signup = function(req, res) {
	console.log('SIGNUP', req.body);
	var user = new User();
	user.email = req.body.email;
	user.password = req.body.password;
	user.role = req.body.role;

	// TODO check for duplicate email?

	return async.waterfall([

		// save the new user object
		function(next) {
			console.log('SAVE USER', user);
			user.save(function(err) {
				return next(err);
			});
		},

		// update the session to link to the user
		function(next) {
			console.log('UPDATE SESSION', req.session.session_id);
			Session.findByIdAndUpdate(req.session.session_id, {
				user: user.id
			}, function(err) {
				return next(err);
			});
		},

		function(next) {
			// save the user id into cookie session
			req.session.user = {
				id: user.id,
				email: user.email
			};
			// send the user as reply
			return next(null, _.omit(user, 'password'));
		}

	], common.reply_callback(req, res, 'SIGNUP ' + req.body.email));
};


exports.logout = function(req, res) {
	delete req.session.user;
	res.redirect('/');
};

exports.fetch_all = function(callback) {
	async.parallel({
		users: function(next) {
			return User.find(next);
		},
		sessions: function(next) {
			return Session.find(next);
		},
		actions: function(next) {
			return Action.find({}, {
				req: 0
			}, next);
		}
	}, callback);
};
