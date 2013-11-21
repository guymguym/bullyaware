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

function find_identities(identity_ids, callback) {
	return Identity.find({
		_id: {
			$in: identity_ids
		}
	}, callback);
}

function find_related_messages(identities, days, callback) {
	var sender_query = new Array(identities.length);
	var mention_query = new Array(identities.length);
	var j = 0;
	for (var i = 0; i < identities.length; i++) {
		var s = identities[i];
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
	var since_date = new Date();
	since_date.setDate(since_date.getDate() - days);
	console.log('SINCE', since_date);
	return async.parallel({
		sender: function(next) {
			return Message.find({
				time: {
					$gt: since_date
				}
			}).or(sender_query).exec(next);
		},
		mentions: function(next) {
			return Message.find({
				time: {
					$gt: since_date
				}
			}).or(mention_query).exec(next);
		}
	}, callback);
}


// calculate level per message

function compute_list_score(list) {
	for (var i = 0; i < list.length; i++) {
		list[i].level = compute_message_score(list[i]);
	}
}

function count_profanities(list) {
	var profs = {};
	for (var i = 0; i < list.length; i++) {
		count_message_profanities(list[i], profs);
	}
	return profs;
}

function count_message_profanities(message) {}


exports.do_report = function(req, res) {
	var person_id = req.params.person_id;
	var days = parseInt(req.body.days || 1, 10);
	console.log('REPORT', person_id, days);
	var person;
	var identities;
	return async.waterfall([
		function(next) {
			setTimeout(next, 1000);
		},

		function(next) {
			return find_person(person_id, next);
		},

		function(person_result, next) {
			person = person_result;
			console.log('REPORT - PERSON', person);
			return find_identities(person.identities, next);
		},

		function(identities_result, next) {
			identities = identities_result;
			console.log('REPORT - IDENTITIES', identities.length,
				_.pluck(_.pluck(identities, 'profile'), 'screen_name').join(','));
			return find_related_messages(identities, days, next);
		},

		function(messages, next) {
			compute_list_score(messages.sender);
			compute_list_score(messages.mentions);
			var report = {
				user: person.user,
				person: person.id,
				person_name: person.name,
				identities: person.identities,
				sent: {
					num_msg: messages.sender.length,
					profanities: count_profanities(messages.sender)
				},
				mention: {
					num_msg: messages.mentions.length,
					profanities: count_profanities(messages.mentions)
				}
			};
			return next(null, report);
		}
	], common.reply_callback(req, res, 'REPORT ' + person_id));
};






//////////
// DEMO //
//////////


function analyze_query_messages(messages, user_map, callback) {
	// calculate level per message
	for (var i = 0; i < messages.length; i++) {
		var msg = messages[i];
		msg.level = compute_message_score({
			data: msg
		});
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
