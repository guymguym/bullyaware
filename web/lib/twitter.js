/* jshint node:true */
/* jshint -W099 */
'use strict';

var async = require('async');
var _ = require('underscore');
var util = require('util');
var fs = require('fs');
var path = require('path');
// var S = require('string');

var ntwitter = require('ntwitter');
var twitter = new ntwitter({
	consumer_key: process.env.TWITTER_CONSUMER_KEY,
	consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
	access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
	access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
});

exports.twitter = twitter;

exports.tweet_search = function(search_expression, callback) {
	var max_id;
	var results = new Array(100);
	var user_map = {};
	var num = 0;
	var done = false;
	var iterations = 0;

	var cache_file_path = path.resolve(__dirname, search_expression);
	if (process.env.READ_CACHE_TWITTER) {
		if (fs.existsSync(cache_file_path)) {
			var cached_data = fs.readFileSync(cache_file_path);
			if (cached_data) {
				cached_data = JSON.parse(cached_data);
				return callback(null, cached_data.results, cached_data.user_map);
			}
		}
	}

	async.whilst(function() {
		console.log('TWT1', num);
		return !done && num < results.length && iterations < 5;
	}, function(next) {
		console.log('TWT2', num);
		var opt = {
			q: search_expression,
			count: 100
		};
		if (max_id) {
			opt.max_id = max_id;
		}
		// override the old url in the library for twitter api version 1.1
		var search_tweets_url = 'https://api.twitter.com/1.1/search/tweets.json';
		return twitter.get(search_tweets_url, opt, function(err, data) {
			if (err) {
				return next(err);
			}
			console.log('TWT3', num);
			iterations++;
			if (!data || !data.statuses) {
				console.log('NO MORE TWEETS', data);
				done = true;
				return next();
			}
			if (!data.statuses.length) {
				done = true;
				return next();
			}
			for (var i = 0; i < data.statuses.length; i++) {
				var status = data.statuses[i];
				if (!status.retweeted_status) {
					results[num++] = {
						id: status.id,
						text: status.text,
						user_id: status.user.id,
						user_name: status.user.name,
						retweet_count: status.retweet_count
					};
					user_map[status.user.id] = status.user;
				}
			}
			max_id = data.statuses[data.statuses.length - 1].id;
			return next();
		});
	}, function(err) {
		results = results.slice(0, num);
		if (process.env.WRITE_CACHE_TWITTER) {
			fs.writeFileSync(path.resolve(__dirname, search_expression), JSON.stringify({
				results: results,
				user_map: user_map
			}));
		}
		return callback(err, results, user_map);
	});
};


/*

twit.search('@grolnik', function(data) {
	// console.log(util.inspect(data));
	var tweets = data.statuses;
	_.each(data.statuses, function(tweet) {

		console.log('----------------------------');
		// in_reply_to_screen_name
		// console.log('tweet: ', tweet);
		var ctweet = _.pick(tweet,
			'id',
			'text',
			'created_at',
			'in_reply_to_screen_name',
			'retweet_count',
			'geo',
			'coordinates',
			'place',
			'favorite_count'
		);
		// console.log('ctweet.user: ', ctweet.user);
		var user_info = _.pick(tweet.user,
			'id',
			'name',
			'screen_name',
			'followers_count',
			'friends_count',
			'location',
			'geo_enabled',
			'statuses_count',
			'profile_image_url'
		);
		console.log('ctweet: ', ctweet);
		console.log('user_info: ', user_info);

		// ctweet.user: {
		// 	id: 10124722,
		// 	id_str: '10124722',
		// 	name: 'Yacov Bar-Haim',
		// 	screen_name: 'Yacovb',
		// 	location: 'ÜT: 45.689499,-0.317699',
		// 	description: '',
		// 	url: null,
		// 	entities: {
		// 		description: {
		// 			urls: []
		// 		}
		// 	},
		// 	protected: false,
		// 	followers_count: 75,
		// 	friends_count: 193,
		// 	listed_count: 0,
		// 	created_at: 'Sat Nov 10 12:27:06 +0000 2007',
		// 	favourites_count: 32,
		// 	utc_offset: 10800,
		// 	time_zone: 'Jerusalem',
		// 	geo_enabled: true,
		// 	verified: false,
		// 	statuses_count: 143,
		// 	lang: 'en',
		// 	contributors_enabled: false,
		// 	is_translator: false,
		// 	profile_background_color: 'C0DEED',
		// 	profile_background_image_url: 'http://abs.twimg.com/images/themes/theme1/bg.png',
		// 	profile_background_image_url_https: 'https://abs.twimg.com/images/themes/theme1/bg.png',
		// 	profile_background_tile: false,
		// 	profile_image_url: 'http://a0.twimg.com/profile_images/1235694143/PICT0081A_normal.JPG',
		// 	profile_image_url_https: 'https://si0.twimg.com/profile_images/1235694143/PICT0081A_normal.JPG',
		// 	profile_link_color: '0084B4',
		// 	profile_sidebar_border_color: 'C0DEED',
		// 	profile_sidebar_fill_color: 'DDEEF6',
		// 	profile_text_color: '333333',
		// 	profile_use_background_image: true,
		// 	default_profile: true,
		// 	default_profile_image: false,
		// 	following: false,
		// 	follow_request_sent: false,
		// 	notifications: false
		// }



		// console.log('ctweet: ', ctweet);
		// _.pick({name: 'moe', age: 50, userid: 'moe1'}, 'name', 'age');
		// => {name: 'moe', age: 50}


		// console.log('tweet.text: ',tweet.text);
	});
});

*/
