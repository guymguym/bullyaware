/* jshint node:true */
/* jshint -W099 */
'use strict';
var mongoose = require('mongoose');
var twitter = require('ntwitter');
var _ = require('underscore');
var SocialID = require('./lib/models').SocialID;
var Message = require('./lib/models').Message;
var async = require('async');


// connect to the database
if (process.env.MONGOHQ_URL) {
	mongoose.connect(process.env.MONGOHQ_URL);
}

var twit = new twitter({
	consumer_key: process.env.TWITTER_CONSUMER_KEY,
	consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
	access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
	access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
});


function get_twitter_stream_filter(callback) {

	//as documented in https://dev.twitter.com/docs/api/1.1/post/statuses/filter
	var filter = {
		'follow': [],
		'track': []
	};

	SocialID.find({
		type: 'twitter'
	}, function(err, twitter_users) {
		if (err) {
			return callback(err, null);
		}

		_.each(twitter_users, function(tu) {
			filter.follow.push(tu.sid);
			filter.track.push(tu.profile.name);
			filter.track.push(tu.profile.screen_name);
		});

		_.each(filter, function(v, k) {
			if (filter[k].length > 0) {
				filter.k = filter.k.join();
			} else {
				delete filter[k];
			}

		});

		return callback(null, filter);

	});
}

function ingest_twit(twit, callback) {
	var message = new Message();
	message.type = 'twitter';
	message.data = twit;
	message.sender = twit.user.id_str;

	var mentions = _.pluck(twit.entities.user_mentions, 'id_str');
	if (mentions) {
		message.mentions = mentions;
	}
	return message.save(function(err, message, num) {
		if (err) {
			console.log("error while creating message: ", err);
			return callback(err, null);
		}
		console.log("Successfuly collected message:", message);
		return callback(null);
	});
}

function collect_twits() {
	async.waterfall([
		function(next) {
			get_twitter_stream_filter(next);
		},
		function(filter, next) {
			console.log('filter: ', filter);
			if (!_.keys(filter).length) {
				filter = {
					'locations': '-122.75,36.8,-121.75,37.8,-74,40,-73,41'
				};
			}
			console.log('filter: ', filter);

			twit.stream('statuses/filter', filter, function(stream) {
				stream.on('data', function(data) {
					ingest_twit(data, function(err) {
						if (err) {
							console.log("Errpr in twit ingest:", err);
						}
					});
				});
				stream.on('error', function(error) {
					console.log("Error in reading tweets using filetr. The filter was: ", filter);
					console.log('error: ', error);
				});

			});
		}
	], function(err, results) {

	});
}

collect_twits();