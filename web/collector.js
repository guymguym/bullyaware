/* jshint node:true */
/* jshint -W099 */
'use strict';
var mongoose = require('mongoose');
var twitter = require('./lib/twitter').twitter;
var _ = require('underscore');
var Identity = require('./lib/models').Identity;
var Message = require('./lib/models').Message;
var async = require('async');


// connect to the database
if (process.env.MONGOHQ_URL) {
	mongoose.connect(process.env.MONGOHQ_URL);
}


function get_twitter_stream_filter(callback) {

	//as documented in https://dev.twitter.com/docs/api/1.1/post/statuses/filter
	var filter = {
		'follow': [],
		'track': []
	};

	Identity.find({
		type: 'twitter'
	}, function(err, twitter_users) {
		if (err) {
			return callback(err);
		}
		if (!twitter_users || !twitter_users.length) {
			return callback(null, []);
		}

		_.each(twitter_users, function(tu) {
			filter.follow.push(tu.sid);
			filter.track.push(tu.profile.name);
			filter.track.push(tu.profile.screen_name);
		});

		_.each(filter, function(v, k) {
			if (filter[k].length > 0) {
				filter[k] = filter[k].join();
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
	return message.save(function(err) {
		if (err) {
			console.error('SAVE MESSAGE FAILED', err, message);
			return callback(err, null);
		}
		console.log('SAVED MESSAGE FROM', twit.user.name);
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

			// TODO reload filters every few minutes

			// TODO limit number of messages during tests

			if (!_.keys(filter).length) {
				filter = {
					track: ['MileyCyrus'] // TEST ID
					// track: ['SomeSKANKinMI'] // TEST ID
					// 'locations': '-122.75,36.8,-121.75,37.8,-74,40,-73,41'
				};
			}
			console.log('filter: ', filter);

			twitter.stream('statuses/filter', filter, function(stream) {
				stream.on('data', function(data) {
					ingest_twit(data, function(err) {
						if (err) {
							console.log("Errpr in twit ingest:", err);
						}
					});
				});
				stream.on('error', function(err) {
					console.error('TWITTER STREAM ERROR', err);
					console.log('TWITTER STREAM ERROR - FILTER', filter);
				});
			});
		}
	], function(err, results) {

	});
}

// collect_twits();
