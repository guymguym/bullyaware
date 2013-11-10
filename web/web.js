/* jshint node:true */
/* jshint -W099 */
'use strict';

process.on('uncaughtException', function(err) {
	console.log(err.stack);
});

if (process.env.NODETIME_ACCOUNT_KEY) {
	require('nodetime').profile({
		accountKey: process.env.NODETIME_ACCOUNT_KEY,
		appName: process.env.NODETIME_APP_DESC
	});
}

require('newrelic');

var path = require('path');
var URL = require('url');
var http = require('http');
var dot = require('dot');
var dot_emc = require('dot-emc');
var express = require('express');
// var passport = require('passport');
var mongoose = require('mongoose');

// connect to the database
if (!process.env.MONGOHQ_URL) {
	console.error('MISSING MONGOHQ_URL');
	process.exit(1);
}
mongoose.connect(process.env.MONGOHQ_URL);

// create express app
var app = express();
var web_port = process.env.PORT || 5000;
app.set('port', web_port);
app.set('env', 'development'); // TODO: temporary

// setup view template engine with doT
var dot_emc_app = dot_emc.init({
	app: app
});
dot.templateSettings.strip = false;
dot.templateSettings.cache = ('development' != app.get('env'));
// replace dot regexp to use <% %> to avoid collision with angular {{ }}
for (var i in dot.templateSettings) {
	var reg = dot.templateSettings[i];
	if (!(reg instanceof RegExp)) {
		continue;
	}
	var pattern = reg.source;
	pattern = pattern.replace(/\\\{\\\{/g, '\\<\\?');
	pattern = pattern.replace(/\\\}\\\}/g, '\\?\\>');
	var flags = '';
	if (reg.global) {
		flags += 'g';
	}
	if (reg.ignoreCase) {
		flags += 'i';
	}
	if (reg.multiline) {
		flags += 'm';
	}
	dot.templateSettings[i] = new RegExp(pattern, flags);
}
app.set('views', path.join(__dirname, 'views'));
app.engine('dot', dot_emc_app.__express);
app.engine('html', dot_emc_app.__express);



////////////////
// MIDDLEWARE //
////////////////

// configure app middleware handlers in the order to use them

app.use(express.favicon(path.join(__dirname, 'public/img/kid.gif')));
app.use(express.logger());
app.use(function(req, res, next) {
	// HTTPS redirect:
	// since we want to provide secure and certified connections 
	// for the entire application, so once a request for http arrives,
	// we redirect it to https.
	// it was suggested to use the req.secure flag to check that.
	// however our nodejs server is always http so the flag is false,
	// and on heroku only the router does ssl,
	// so we need to pull the heroku router headers to check.
	var fwd_proto = req.get('X-Forwarded-Proto');
	// var fwd_port = req.get('X-Forwarded-Port');
	// var fwd_from = req.get('X-Forwarded-For');
	// var fwd_start = req.get('X-Request-Start');
	if (fwd_proto === 'https') {
		var host = req.get('Host');
		return res.redirect('http://' + host + req.url);
	}
	return next();
});
var COOKIE_SECRET = '2430360efa2d43cf271d413cf48110249baa23110639f9a987asdlkmlknv';
app.use(express.cookieParser(COOKIE_SECRET));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.cookieSession({
	// no need for secret since its signed by cookieParser
	key: 'bullyaware_session',
	cookie: {
		maxAge: 7 * 24 * 60 * 60 * 1000 // 1 week
	}
}));
// app.use(passport.initialize());
// app.use(passport.session());

var allowCrossDomain = function(req, res, next) {
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Credentials', true);
	res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
	res.header('Access-Control-Allow-Headers', 'Content-Type');
	next();
};
// app.use(allowCrossDomain);

// using router before static files is optimized
// since we have less routes then files, and the routes are in memory.
app.use(app.router);

// setup static files
app.use(express.compress());
app.use('/public/', express.static(path.join(__dirname, 'public')));
app.use('/vendor/', express.static(path.join(__dirname, '..', 'vendor')));
app.use('/vendor/', express.static(path.join(__dirname, '..', 'bower_components')));
app.use('/vendor/', express.static(path.join(__dirname, '..', 'node_modules')));
app.use('/', express.static(path.join(__dirname, 'public', 'google')));
// app.use('/2FE5F0A5036CF33C937D0E26CE9B0B10.txt', express.static(path.join(__dirname, 'public', 'js')));


// error handlers should be last
// roughly based on express.errorHandler from connect's errorHandler.js
app.use(error_404);
app.use(function(err, req, res, next) {
	console.error('ERROR:', err);
	var e = {};
	if (app.get('env') === 'development') {
		// show internal info only on development
		e = err;
	}
	e.data = e.data || e.message;
	e.status = err.status || res.statusCode;
	if (e.status < 400) {
		e.status = 500;
	}
	res.status(e.status);

	if (req.xhr) {
		return res.json(e);
	} else if (req.accepts('html')) {
		return res.render('error.html', {
			err: e,
			req: req
		});
	} else if (req.accepts('json')) {
		return res.json(e);
	} else {
		return res.type('txt').send(e.data || e.toString());
	}
});

function error_404(req, res, next) {
	next({
		status: 404, // not found
		data: 'Can\'t find ' + req.originalUrl
	});
}

function error_403(req, res, next) {
	if (req.accepts('html')) {
		return res.redirect(URL.format({
			pathname: '/auth/facebook/login/',
			query: {
				state: req.originalUrl
			}
		}));
	}
	next({
		status: 403, // forbidden
		data: 'Forgot to login?'
	});
}

function error_501(req, res, next) {
	next({
		status: 501, // not implemented
		data: 'Working on it... ' + req.originalUrl
	});
}



////////////
// ROUTES //
////////////

var engine = require('./lib/engine');
var users = require('./lib/users');

app.post('/event_log', users.mk_session, users.event_log);
app.post('/user/signup', users.mk_session, users.signup);
app.post('/user/login', users.mk_session, users.login);
app.get('/user/logout', users.mk_session, users.logout);
app.get('/user', users.mk_session, users.read_user);
app.put('/user', users.mk_session, users.update_user);
app.post('/user/person', users.mk_session, users.add_person);
app.del('/user/person/:person_id', users.mk_session, users.del_person);
app.post('/user/person/:person_id/social_id', users.mk_session, users.add_social_id);

app.post('/demo_query', users.mk_session, engine.demo_query);
app.post('/report', users.mk_session, engine.make_report);


// admin route
var admin_auth = express.basicAuth(function(user, pass, callback) {
	var result = (user === 'noobaa' && pass === 'batyam');
	return callback(null, result);
});
app.get('/admin', admin_auth, function(req, res, next) {
	users.fetch_all(function(err, results) {
		if (err) {
			return next(err);
		}
		return res.render('admin.html', results);
	});
});


function page_context(req) {
	return {
		session: req.session.session_id,
		user: req.session.user
	};
}

app.get('/', users.mk_session, function(req, res) {
	return res.render('main.html', page_context(req));
});

app.get('/about', users.mk_session, function(req, res) {
	return res.render('about.html', page_context(req));
});
app.get('/contact', users.mk_session, function(req, res) {
	return res.render('contact.html', page_context(req));
});
app.get('/whatis', users.mk_session, function(req, res) {
	return res.render('whatis.html', page_context(req));
});
app.get('/features', users.mk_session, function(req, res) {
	return res.render('features.html', page_context(req));
});
app.get('/demo', users.mk_session, function(req, res) {
	return res.render('demo.html', page_context(req));
});
app.get('/getstarted', users.mk_session, function(req, res) {
	if (!req.session.user) {
		return res.redirect('/signup');
	}
	return res.render('getstarted.html', page_context(req));
});
app.get('/settings', users.mk_session, function(req, res) {
	if (!req.session.user) {
		return res.redirect('/signup');
	}
	return res.render('settings.html', page_context(req));
});
app.get('/signup', users.mk_session, function(req, res) {
	if (req.session.user) {
		return res.redirect('/getstarted');
	}
	return res.render('signup.html', page_context(req));
});
app.get('/login', users.mk_session, function(req, res) {
	return res.render('login.html', page_context(req));
});


// start http server
var server = http.createServer(app);
server.listen(web_port, function() {
	console.log('Web server on port ' + web_port);
});
