/* jshint node:true */
/* jshint -W099 */
'use strict';

var common = require('./common');
var async = require('async');
var _ = require('underscore');
var afinn = require('./afinn');
var twitter = require('./twitter_service');
var models = require('./models');
var SocialID = models.SocialID;
var Person = models.Person;
var Message = models.Message;



function compute_message_score(msg) {
	var punctuationless = msg.text.replace(/[\.,-\/#!$%\^&\*;:{}=\-`~()]/g, " ");
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
		if (msg.retweet_count >= 10) {
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


function find_related_messages(social_ids, callback) {
	SocialID.find({
		_id: {
			$in: social_ids
		}
	}, function(err, social_id_list) {
		if (err) {
			console.error('FAILED FIND SOCIAL IDS', err, social_ids);
			return callback(err);
		}
		var q = new Array(2 * social_id_list.length);
		var j = 0;
		for (var i = 0; i < social_id_list.length; i++) {
			var s = social_id_list[i];
			q[j++] = {
				type: s.type,
				sender: s.sid
			};
			q[j++] = {
				type: s.type,
				mentions: s.sid
			};
		}
		return Message.find().or(q).exec(callback);
	});
}



function create_report(messages, callback) {
	// calculate level per message
	for (var i = 0; i < messages.length; i++) {
		var msg = messages[i];
		msg.level = compute_message_score(msg);
	}

	var report = new models.Report();
	// TODO fill the report
}


function make_report(person_id, callback) {
	return async.waterfall([
		function(next) {
			return find_person(person_id, next);
		},

		function(person, next) {
			return find_related_messages(person.social_ids, next);
		},

		function(messages, next) {
			return create_report(messages, next);
		}
	], callback);
}

function find_last_report(person_id, callback) {
	// TODO
	return callback();
}


function periodic_report(person_id, period_seconds, callback) {
	return async.waterfall([
		function(next) {
			return find_last_report(person_id, next);
		},

		function(last_report, next) {
			var threshold_ms = (new Date()).getTime() - (1000 * period_seconds);
			var report_still_valid = last_report &&
				(last_report.id.getTimestamp().getTime() > threshold_ms);
			if (report_still_valid) {
				return next();
			}
			return make_report(person_id, next);
		},

	], callback);
}


exports.make_report = function(req, res) {
	var person_id = req.body.person_id;
	return make_report(person_id,
		common.reply_callback(req, res, 'REPORT ' + person_id));
};


exports.make_periodic_report = function(req, res) {
	var person_id = req.body.person_id;
	var period_seconds = parseInt(req.body.period_seconds, 10);
	return periodic_report(person_id, period_seconds,
		common.reply_callback(req, res, 'PERIODIC REPORT ' + person_id));
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
