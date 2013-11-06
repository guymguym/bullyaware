/* jshint node:true */
/* jshint -W099 */
'use strict';

var common = require('./common');
var async = require('async');
var _ = require('underscore');
var mongoose = require('mongoose');
var types = mongoose.Schema.Types;
var mandrill = require('node-mandrill')('T4f6so795LfLb-mFVed1wg');

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

user_schema.index({
	email: 1
}, {
	unique: true,
	// defining as sparse avoids indexing when the field is not present
	sparse: true
});

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

// indexes are ensured by default
// Session.ensureIndexes();
// User.ensureIndexes();
// Action.ensureIndexes();


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
	act.data = req.body;
	/* TODO: validity needed?
	_.pick(req.body,
		'load_page',
		'analyze_demo',
		'analyze_try',
		'try_account_type',
		'contact_us',
		'about_us',
		'support_call',
		'user_role'
	);
	*/
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


// save the user id into cookie session

function save_user_in_session(req, user) {
	req.session.user = {
		id: user.id,
		email: user.email
	};
}


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
			save_user_in_session(req, user);
			return next();
		},

		function(next) {
			return mandrill('/messages/send', {
				message: {
					to: [{
						email: 'info@bullyaware.co',
						name: 'info@bullyaware.co'
					}, {
						email: user.email,
						name: user.email
					}],
					from_email: 'info@bullyaware.co',
					from_name: 'Bullyaware.co',
					subject: "Welcome to Bullyaware - " + user.email,
					text: [
						'Hi and welcome to Bullyaware.co',
						'',
						'Thank you for signing up.',
						'With Bullyaware we are trying to fight cyberbullying over the social networks with technology.',
						'We are a young company and we need the community\'s help.',
						'',
						'We are trying to improve our service and would like to get your feedback.',
						'Would you be willing to tell us about your experience?',
						'What did you like/dislike?',
						'We will reward you for any feedback.',
						'',
						'We are at your service and can be reached at info@bullyaware.co',
						'You can login to your account at www.bullyaware.co',
						'',
						'Many thanks,',
						'Bullyaware Team'
					].join('\n')
				}
			}, function(err) {
				return next(err);
			});
		}

	], common.reply_callback(req, res, 'SIGNUP ' + req.body.email));
};


exports.login = function(req, res) {
	var email = req.body.email;
	var password = req.body.password;

	return async.waterfall([

		function(next) {
			return User.find({
				email: email
			}, next);
		},

		function(users, next) {
			if (users.length === 0) {
				console.error('LOGIN: USER NOT FOUND', email, password);
				return next({
					status: 403
				});
			}
			if (users.length > 1) {
				console.error('LOGIN: MULTIPLE RESULTS FOR EMAIL', users);
				return next({
					status: 500
				});
			}
			var user = users[0];
			if (user.password !== password) {
				console.error('LOGIN: BAD PASSWORD', user, password);
				return next({
					status: 403
				});
			}
			save_user_in_session(req, user);
			return next();
		}
	], common.reply_callback(req, res, 'LOGIN ' + email));
};


exports.logout = function(req, res) {
	delete req.session.user;
	return res.redirect('/');
};


exports.read_user = function(req, res) {
	var user_id;

	return async.waterfall([

		function(next) {
			if (!req.session.user || !req.session.user.id) {
				return next({
					status: 403
				});
			}
			user_id = req.session.user.id;
			return User.findById(req.session.user.id, next);
		},

		function(user, next) {
			if (!user) {
				console.error('GET USER NOT FOUND', req.session.user);
				return next({
					status: 403
				});
			}
			return next(null, _.omit(user.toObject(), 'password'));
		}
	], common.reply_callback(req, res, 'GET_USER ' + user_id));
};


exports.update_user = function(req, res) {
	var updates = _.pick(req.body, 'role');
	var user_id;

	return async.waterfall([

		function(next) {
			if (!req.session.user || !req.session.user.id) {
				return next({
					status: 403
				});
			}
			user_id = req.session.user.id;
			return User.findByIdAndUpdate(req.session.user.id, updates, function(err) {
				return next(err);
			});
		},

	], common.reply_callback(req, res, 'GET_USER ' + user_id));
};


exports.fetch_all = function(callback) {
	async.parallel({
		users: function(next) {
			return User.find().lean().exec(next);
		},
		sessions: function(next) {
			return Session.find().lean().exec(next);
		},
		actions: function(next) {
			return Action.find({}, {
				req: 0
			}).lean().exec(next);
		}
	}, callback);
};
