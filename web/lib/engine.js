var async = require('async');
var _ = require('underscore');
var afinn = require('./afinn');
var twitter = require('./twitter_service');

function analyze(args, callback) {
	console.log('ANALYZE ARGS', args);

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
			// calculate level per message
			for (var i = 0; i < messages.length; i++) {
				var msg = messages[i];
				var punctuationless = msg.text.replace(/[\.,-\/#!$%\^&\*;:{}=\-`~()]/g, " ");
				var words = punctuationless.toLowerCase().split(' ');
				var score = 0;
				for (var j = 0; j < words.length; j++) {
					if (words[j] in afinn.words) {
						score += afinn.words[words[j]];
					}
				}
				if (score >= 0) {
					msg.level = 0;
				} else {
					if (msg.retweet_count >= 10) {
						score *= 2;
					}
					if (score < -10) {
						score = -10;
					}
					msg.level = -score / 10;
				}
			}

			// group the messages by user id
			var group_by_user_id = _.groupBy(messages, function(msg) {
				return msg.user_id;
			});

			// process each user and detect bullys
			var users = [];
			var total_level = 0;
			var total_count = 0;

			function sort_reverse_level(o) {
				return -o.level;
			}
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

			return next(null, {
				level: total_level,
				users: users,
				messages: messages
			});
		}

	], callback);
}

exports.analyze = analyze;

exports.analyze_api = function(req, res) {
	analyze(req.body, function(err, result) {
		if (err) {
			return res.json(500, err);
		} else {
			return res.json(200, result);
		}
	});
};