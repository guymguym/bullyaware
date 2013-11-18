/* jshint node:true */
/* jshint -W099 */
'use strict';

var common = require('./common');
var async = require('async');
var _ = require('underscore');
var mandrill = require('node-mandrill')('T4f6so795LfLb-mFVed1wg');
var twitter = require('./twitter').twitter;

var models = require('./models');
var Session = models.Session;
var EventLog = models.EventLog;
var User = models.User;
var Person = models.Person;
var Identity = models.Identity;

function is_testing(req) {
	var host = req.get('host');
	return host.substring(0, 9) === '127.0.0.1';
}

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

// event_log is a route that is used to capture actions info from the UI.
// it saves the action info along with the session_id and optionaly user_id 
// to have proper links to the state when the action occured.
exports.event_log = function(req, res) {
	var ev = new EventLog();
	// session_id is always created before this route by mk_session
	ev.session = req.session.session_id;
	// user_id is not always available, but save when it does
	if (req.session.user) {
		ev.user = req.session.user.id;
	}
	ev.event = req.body.event;
	ev.data = req.body.data;

	return ev.save(function(err) {
		var callback = common.reply_callback(req, res, 'EVENT_LOG ' + req.session.session_id);
		return callback(err);
	});
};


// save the user id into cookie session

function save_user_in_session(req, user) {
	req.session.user = {
		id: user.id,
		email: user.email,
		first_name: user.first_name,
		last_name: user.last_name
	};
}


// signup creates a new user with a given email
exports.signup = function(req, res) {
	console.log('SIGNUP', req.body);
	var user = new User();
	user.first_name = req.body.first_name;
	user.last_name = req.body.last_name;
	user.email = req.body.email;
	user.password = req.body.password;
	// user.role = req.body.role;

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
			if (is_testing(req)) {
				// dont send emails when testing
				return next();
			}
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



function validate_user(req) {
	return function(next) {
		if (!req.session.user || !req.session.user.id) {
			return next({
				status: 403
			});
		}
		return next();
	};
}



exports.update_user = function(req, res) {
	var updates = _.pick(req.body, 'CANCELED-role');
	var user_id;

	return async.waterfall([

		validate_user(req),

		function(next) {
			user_id = req.session.user.id;
			return User.findByIdAndUpdate(req.session.user.id, updates, function(err) {
				return next(err);
			});
		},

	], common.reply_callback(req, res, 'UPDATE_USER ' + user_id));
};


exports.read_user = function(req, res) {
	var user_id;
	var user_info;
	var persons;
	var identities;

	return async.waterfall([

		validate_user(req),

		function(next) {
			user_id = req.session.user.id;
			return User.findById(req.session.user.id).lean().exec(next);
		},

		function(user, next) {
			if (!user) {
				console.error('GET USER NOT FOUND', req.session.user);
				return next({
					status: 403
				});
			}
			user_info = _.omit(user, 'password');
			return next();
		},

		function(next) {
			return Person.find({
				user: user_id
			}).lean().exec(function(err, persons_list) {
				if (err) {
					return next(err);
				}
				persons = persons_list;
				return next();
			});
		},

		function(next) {
			var ids = [];
			for (var i = 0; i < persons.length; i++) {
				ids = ids.concat(persons[i].identities);
			}
			return Identity.find({
				_id: {
					$in: ids
				}
			}).lean().exec(function(err, identity_list) {
				if (err) {
					return next(err);
				}
				identities = identity_list;
				return next();
			});
		},

		function(next) {
			user_info.persons = persons;
			user_info.identities = identities;
			return next(null, user_info);
		}

	], common.reply_callback(req, res, 'GET_USER ' + user_id));
};


exports.add_person = function(req, res) {
	var user_id;
	var name = req.body.name;

	return async.waterfall([

		validate_user(req),

		function(next) {
			user_id = req.session.user.id;
			var person = new Person();
			person.user = user_id;
			person.name = name;
			return person.save(function(err) {
				if (err) {
					if (err.code === 11000) { // duplicate key
						return next({
							status: 409 // conflict
						});
					} else {
						return next(err);
					}
				}
				return next(null, {
					id: person.id
				});
			});
		},

	], common.reply_callback(req, res, 'ADD_PERSON ' + user_id));
};

exports.add_identity = function(req, res) {
	var user_id;
	var person_id = req.params.person_id;
	var type = req.body.type;
	var sid = req.body.sid;

	return async.waterfall([

		validate_user(req),

		function(next) {
			user_id = req.session.user.id;
			if (type !== 'twitter') {
				return next(null, null);
			}
			return twitter.showUser(sid, function(err, profiles) {
				if (err) {
					return next(err);
				}
				if (profiles.length !== 1) {
					return next('unexpected profiles reply');
				}
				return next(null, profiles[0]);
			});
		},

		function(profile, next) {
			var data_fields = {
				type: type,
				sid: sid
			};
			return Identity.findOneAndUpdate({
				type: type,
				sid: sid
			}, {
				type: type,
				sid: sid,
				profile: profile
			}, {
				// using upsert to create if not exists
				upsert: true
			}, function(err, identity) {
				return next(err, identity);
			});
		},

		function(identity, next) {
			Person.findByIdAndUpdate(person_id, {
				$addToSet: {
					identities: identity.id
				}
			}, function(err) {
				return next(err);
			});
		}

	], common.reply_callback(req, res, 'ADD_IDENTITY ' + user_id));
};

exports.del_person = function(req, res) {
	var user_id;
	var person_id = req.params.person_id;

	return async.waterfall([

		validate_user(req),

		// TODO check if we want to remove related identities from the db completely

		function(next) {
			user_id = req.session.user.id;
			Person.findByIdAndRemove(person_id, function(err) {
				return next(err);
			});
		},

	], common.reply_callback(req, res, 'DEL_PERSON ' + user_id));
};

exports.del_identity = function(req, res) {
	var user_id;
	var person_id = req.params.person_id;
	var identity = req.params.identity;

	return async.waterfall([

		validate_user(req),

		function(next) {
			user_id = req.session.user.id;
			return Person.findByIdAndUpdate(person_id, {
				$pull: {
					identities: identity
				}
			}, function(err) {
				return next(err);
			});
		},

		// TODO check if we want to remove identity from the db completely

	], common.reply_callback(req, res, 'DEL_IDENTITY ' + user_id));
};


exports.twitter_id_complete = function(req, res) {
	return async.waterfall([

		function(next) {
			if (!req.query.q) {
				return next(null, []);
			}
			return twitter.searchUser(req.query.q, req.query, next);
		}

	], common.reply_callback(req, res, 'TW_ID_COMPL ' + req.query));
};


exports.fetch_all = function(callback) {
	async.parallel({
		sessions: function(next) {
			return Session.find().lean().exec(next);
		},
		event_logs: function(next) {
			return EventLog.find().lean().exec(next);
		},
		users: function(next) {
			return User.find().lean().exec(next);
		},
		persons: function(next) {
			return Person.find().lean().exec(next);
		},
		identities: function(next) {
			return Identity.find().lean().exec(next);
		}
	}, callback);
};
