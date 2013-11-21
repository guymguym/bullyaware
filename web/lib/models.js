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
	email: String,
	password: String,
	first_name: String,
	last_name: String
});

// Child
var person_schema = new mongoose.Schema({
	user: types.ObjectId,
	name: String,
	identities: [types.ObjectId]
});

// @child (twitter)
var identity_schema = new mongoose.Schema({
	type: String,
	sid: String,
	profile: {}
});

var message_schema = new mongoose.Schema({
	type: String,
	data: {},
	time: Date,
	sender: String, // sid from identity_schema
	mentions: [String], // sid from identity_schema
	owner: types.ObjectId, // User, or empty if received through public tapping
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

identity_schema.index({
	type: 1,
	sid: 1
}, {
	unique: true
});

message_schema.index({
	time: 1
}, {
	unique: false
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


////////////
// MODELS //
////////////

var Session = mongoose.model('Session', session_schema);
var EventLog = mongoose.model('EventLog', event_log_schema);
var User = mongoose.model('User', user_schema);
var Person = mongoose.model('Person', person_schema);
var Identity = mongoose.model('Identity', identity_schema);
var Message = mongoose.model('Message', message_schema);


module.exports = {
	Session: Session,
	EventLog: EventLog,
	User: User,
	Person: Person,
	Identity: Identity,
	Message: Message
};
