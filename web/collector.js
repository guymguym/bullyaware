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
	var follow = [];
	var track = [];
	Identity.find({
		type: 'twitter'
	}, function(err, twitter_users) {
		if (err) {
			return callback(err);
		}
		twitter_users = twitter_users || [];
		_.each(twitter_users, function(tu) {
			follow.push(tu.sid);
			if (tu.profile.name.split().join().length > 6) {
				track.push(tu.profile.name);
			} else {
				console.log('IGNORE SHORT NAME', tu.profile.name, 'FOR', tu.sid);
			}
			if (tu.profile.screen_name.split().join().length > 6) {
				track.push(tu.profile.screen_name);
			} else {
				console.log('IGNORE SHORT SCREEN NAME', tu.profile.screen_name, 'FOR', tu.sid);
			}
		});
		var filter = {};
		if (follow.length) {
			filter.follow = follow.sort().join(',');
		}
		if (track.length) {
			filter.track = track.sort().join(',');
		}
		if (_.isEmpty(filter)) {
			// if the filter is empty put something for twitter to accept it
			return callback(null, {
				track: ['gumrrr'] // TEST ID
				// track: ['SomeSKANKinMI'] // TEST ID
				// 'locations': '-122.75,36.8,-121.75,37.8,-74,40,-73,41'
			});
		} else {
			return callback(null, filter);
		}
	});
}


function ingest_twit(twit, callback) {
	if (!twit || !twit.id || !twit.text) {
		console.log('IGNORE TWIT CONTROL MESSAGE', twit);
		return callback(null);
	}
	var message = new Message();
	message.type = 'twitter';
	message.data = twit;
	if (twit.created_at) {
		// convert twitter's created_at to js date
		message.time = new Date(Date.parse(twit.created_at.replace(/( \+)/, ' UTC$1')));
	} else {
		message.time = new Date();
	}
	if (twit.user) {
		message.sender = twit.user.id_str;
	}
	if (twit.entities && twit.entities.user_mentions) {	
		var mentions = _.pluck(twit.entities.user_mentions, 'id_str');
		if (mentions) {
			message.mentions = mentions;
		}
	}

	// avoid saving during tests
	if (process.env.DONT_SAVE_MESSAGES) {
		console.log('UNSAVE MESSAGE', twit.user.screen_name,
			'MENTION', _.pluck(twit.entities.user_mentions, 'screen_name').join(','));
		return callback(null);
	}

	return message.save(function(err) {
		if (err) {
			console.error('SAVE MESSAGE FAILED', err, message);
			return callback(err, null);
		}
		console.log('SAVED MESSAGE FROM', twit.user.screen_name,
			'MENTION', _.pluck(twit.entities.user_mentions, 'screen_name').join(','));
		return callback(null);
	});
}

var active_filter;
var active_stream;

function connect_twitter_stream() {
	async.waterfall([
		function(next) {
			return get_twitter_stream_filter(next);
		},
		function(filter, next) {
			if (_.isEqual(filter, active_filter)) {
				console.log('TWITTER FILTER UNCHANGED', filter);
				return next(null);
			}
			console.log('TWITTER FILTER: ', filter);
			twitter.stream('statuses/filter', filter, function(stream) {
				if (!stream) {
					return next('no stream');
				}
				stream.on('data', function(data) {
					return ingest_twit(data, function(err) {
						if (err) {
							console.error("FAILED INGEST TWIT", err);
						}
					});
				});
				stream.on('error', function(err) {
					console.error('ERROR FROM TWITTER STREAM', err);
				});
				stream.on('end', function() {
					setTimeout(connect_twitter_stream, 1000);
				});
				if (active_stream) {
					active_stream.destroy();
				}
				active_stream = stream;
				active_filter = filter;
				return next(null);
			});
		}
	], function(err) {
		if (err) {
			console.error("FAILED COLLECT TWIT", err);
			setTimeout(connect_twitter_stream, 1000);
		}
	});
}

connect_twitter_stream();
setInterval(connect_twitter_stream, 60000);
