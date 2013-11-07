/* jshint node:true */
/* jshint -W099 */
'use strict';

var mongoose = require('mongoose');
var types = mongoose.Schema.Types;


/////////////
// SCHEMAS //
/////////////

var session_schema = new mongoose.Schema({
	user: types.ObjectId,
});

var event_log_schema = new mongoose.Schema({
	event: String,
	data: {},
	session: types.ObjectId,
	user: types.ObjectId,
});

var user_schema = new mongoose.Schema({
	name: String,
	email: String,
	password: String,
	persons: [types.ObjectId],
});

// Child
var person_schema = new mongoose.Schema({
	user: types.ObjectId,
	name: String,
	social_ids: [types.ObjectId]
});

// @child (twitter)
var social_id_schema = new mongoose.Schema({
	type: String,
	sid: String,
	profile: {}
});

var message_schema = new mongoose.Schema({
	type: String,
	data: {},
	sender: String, // sid from social_id_schema
	mentions: [String], // sid from social_id_schema
	owner: types.ObjectId, // User, or empty if received through public tapping
});

var report_schema = new mongoose.Schema({
	user: types.ObjectId,
	person: types.ObjectId,
	person_name: String,
	social_ids: [types.ObjectId],
	insights: [{
		msgs: [types.ObjectId],
		level: String,
		summary: String,
	}],
	send_stats: {
		msgs: [types.ObjectId],
		num_msg: Number,
		num_users: Number,
	},
	rcv_stats: {
		msgs: [types.ObjectId],
		num_msg: Number,
		num_users: Number,
	}
});


/////////////
// INDEXES //
/////////////

session_schema.index({
	user: 1
}, {
	unique: false,
	// user is not mandatory in session so
	// defining as sparse avoids indexing when the field is not present
	sparse: true
});

event_log_schema.index({
	session: 1
}, {
	unique: false
});

user_schema.index({
	email: 1
}, {
	unique: true
});

person_schema.index({
	user: 1,
	name: 1
}, {
	unique: true
});

social_id_schema.index({
	type: 1,
	sid: 1
}, {
	unique: true
});

message_schema.index({
	sender: 1
}, {
	unique: false
});

message_schema.index({
	target: 1
}, {
	unique: false,
	sparse: true // dont include messages without target in the index
});

report_schema.index({
	user: 1
}, {
	unique: false
});

report_schema.index({
	person: 1
}, {
	unique: false
});


////////////
// MODELS //
////////////

var Session = mongoose.model('Session', session_schema);
var EventLog = mongoose.model('EventLog', event_log_schema);
var User = mongoose.model('User', user_schema);
var Person = mongoose.model('Person', person_schema);
var SocialID = mongoose.model('SocialID', social_id_schema);
var Message = mongoose.model('Message', message_schema);
var Report = mongoose.model('Report', report_schema);


module.exports = {
	Session: Session,
	EventLog: EventLog,
	User: User,
	Person: Person,
	SocialID: SocialID,
	Message: Message,
	Report: Report
};
