/* jshint node:true */
/* jshint -W099 */
'use strict';
var mongoose = require('mongoose');
var twitter = require('ntwitter');
var _ = require('underscore');


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

twit.stream('statuses/filter', {
    'locations': '-122.75,36.8,-121.75,37.8,-74,40,-73,41'
}, function(stream) {
    stream.on('data', function(data) {
        console.log("=========================================");
        console.log(data);
    });
});

function get_twitter_user_ids(callback){

}
// function get_twitter_stream_filter(callback) {
// 	//TODO get the filter from the DB
// 	var return_filter = "{}";
// 	return callback(null, return_filter);
// }
