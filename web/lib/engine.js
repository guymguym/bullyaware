/* jshint node:true */
/* jshint -W099 */
'use strict';

var common = require('./common');
var async = require('async');
var _ = require('underscore');
var afinn = require('./afinn');
var twitter = require('./twitter');
var models = require('./models');
var Identity = models.Identity;
var Person = models.Person;
var Message = models.Message;
var Report = models.Report;



function compute_message_score(msg) {
	var punctuationless = msg.data.text.replace(/[\.,-\/#!$%\^&\*;:{}=\-`~()]/g, " ");
	var words = punctuationless.toLowerCase().split(' ');
	var score = 0;
	for (var j = 0; j < words.length; j++) {
		if (words[j] in afinn.words) {
			score += afinn.words[words[j]];
		}
	}
	if (score >= 0) {
		score = 0;
	} else {
		if (msg.data.retweet_count >= 10) {
			score *= 2;
		}
		if (score < -10) {
			score = -10;
		}
		score = -score / 10;
	}
	return score;
}


function sort_reverse_level(x) {
	return -x.level;
}


function find_person(person_id, callback) {
	return Person.findById(person_id, callback);
}


function find_related_messages(identities, callback) {
	Identity.find({
		_id: {
			$in: identities
		}
	}, function(err, identity_list) {
		if (err) {
			console.error('FAILED FIND IDENTITIES', err, identities);
			return callback(err);
		}
		var sender_query = new Array(identity_list.length);
		var mention_query = new Array(identity_list.length);
		var j = 0;
		for (var i = 0; i < identity_list.length; i++) {
			var s = identity_list[i];
			sender_query[j] = {
				type: s.type,
				sender: s.sid
			};
			mention_query[j] = {
				type: s.type,
				mentions: s.sid
			};
			j++;
		}
		if (j === 0) {
			return callback(null, {
				sender: [],
				mentions: []
			});
		}
		return async.parallel({
			sender: function(next) {
				return Message.find().or(sender_query).exec(next);
			},
			mentions: function(next) {
				return Message.find().or(mention_query).exec(next);
			}
		}, callback);
	});
}


// calculate level per message

function compute_list_score(list) {
	for (var i = 0; i < list.length; i++) {
		list[i].level = compute_message_score(list[i]);
	}
}

function create_report(person, messages, callback) {
	compute_list_score(messages.sender);
	compute_list_score(messages.mentions);
	var report = new Report();
	report.user = person.user;
	report.person = person.id;
	report.person_name = person.name;
	report.identities = person.identities;
	report.send_stats.num_msg = messages.sender.length;
	report.rcv_stats.num_msg = messages.mentions.length;
	// TODO fill the report
	return report.save(function(err) {
		if (err) {
			return callback(err);
		}
		return callback(null, report.toObject());
	});
}


function make_report(person_id, callback) {
	var person;
	return async.waterfall([
		function(next) {
			return find_person(person_id, next);
		},

		function(person_result, next) {
			person = person_result;
			return find_related_messages(person.identities, next);
		},

		function(messages, next) {
			return create_report(person, messages, next);
		}
	], callback);
}

function find_last_report(person_id, callback) {
	// TODO
	return callback(null, null);
}


function periodic_report(person_id, period_seconds, callback) {
	return async.waterfall([
		function(next) {
			return find_last_report(person_id, next);
		},

		function(last_report, next) {
			console.log('LAST REPORT', last_report);
			var threshold_ms = (new Date()).getTime() - (1000 * period_seconds);
			var report_still_valid = last_report &&
				(last_report.id.getTimestamp().getTime() > threshold_ms);
			if (report_still_valid) {
				return next(last_report.toObject());
			}
			return make_report(person_id, next);
		},

	], callback);
}


exports.do_report = function(req, res) {
	var person_id = req.params.person_id;
	var period_seconds = parseInt(req.body.period_seconds || 0, 10);
	return periodic_report(person_id, period_seconds,
		common.reply_callback(req, res, 'REPORT ' + person_id));
};






//////////
// DEMO //
//////////


function analyze_query_messages(messages, user_map, callback) {
	// calculate level per message
	for (var i = 0; i < messages.length; i++) {
		var msg = messages[i];
		msg.level = compute_message_score(msg);
	}

	// group the messages by user id
	var group_by_user_id = _.groupBy(messages, function(msg) {
		return msg.user_id;
	});

	// process each user and detect bullys
	var users = [];
	var total_level = 0;
	var total_count = 0;

	for (var user_id in group_by_user_id) {
		var user_messages = _.sortBy(group_by_user_id[user_id], sort_reverse_level);
		var user_level = 0;
		var user_count = 0;
		for (var k = 0; k < user_messages.length; k++) {
			user_level += user_messages[k].level;
			if (user_messages[k].level > 0.1) {
				user_count++;
			}
		}
		total_level += user_level;
		total_count += user_count;
		if (user_count) {
			user_level /= user_count;
		}
		var user = {
			info: user_map[user_id],
			level: user_level,
			messages: user_messages,
		};
		users.push(user);
	}
	users = _.sortBy(users, sort_reverse_level);
	if (total_count) {
		total_level /= total_count;
	}

	return callback(null, {
		level: total_level,
		users: users,
		messages: messages
	});
}



exports.demo_query = function(req, res) {
	var args = req.body;

	console.log('DEMO ARGS', args);

	return async.waterfall([

		function(next) {
			return twitter.tweet_search(args.query, function(err, messages, user_map) {
				if (err) {
					return next(err);
				}
				return next(null, messages, user_map);
			});
		},

		function(messages, user_map, next) {
			return analyze_query_messages(messages, user_map, next);
		}

	], common.reply_callback(req, res, 'DEMO ' + args.query));
};
