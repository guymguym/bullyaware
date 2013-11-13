/* jshint browser:true, jquery:true, devel:true */
/* global angular:false */
/* global _:false */
/* global Backbone:false */
(function() {
	'use strict';

	// define the angular module
	var bullyaware_app = angular.module('bullyaware_app', ['ngSanitize']);


	// safe apply handles cases when apply may fail with:
	// "$apply already in progress" error

	function safe_apply(func) {
		/* jshint validthis:true */
		var phase = this.$root.$$phase;
		if (phase == '$apply' || phase == '$digest') {
			return this.$eval(func);
		} else {
			return this.$apply(func);
		}
	}

	// safe_callback returns a function callback that performs the safe_apply
	// while propagating arguments to the given func.

	function safe_callback(func) {
		/* jshint validthis:true */
		var me = this;
		return function() {
			// build the args array to have null for 'this'
			// and rest is taken from the callback arguments
			var args = new Array(arguments.length + 1);
			args[0] = null;
			for (var i = 0; i < arguments.length; i++) {
				args[i + 1] = arguments[i];
			}
			// the following is in fact calling func.bind(null, a1, a2, ...)
			var fn = Function.prototype.bind.apply(func, args);
			return me.safe_apply(fn);
		};
	}


	// initializations - setup functions on globalScope
	// which will be propagated to any other scope, and easily visible
	bullyaware_app.run(function($rootScope) {
		$rootScope.safe_apply = safe_apply;
		$rootScope.safe_callback = safe_callback;
		$rootScope.stringify = function(o) {
			return JSON.stringify(o);
		};

		jQuery.fn.redraw = function() {
			$(this).each(function() {
				var redraw = this.offsetHeight;
			});
			return this;
		};
		jQuery.fn.focusWithoutScrolling = function() {
			var x = window.scrollX;
			var y = window.scrollY;
			this.focus();
			window.scrollTo(x, y);
			return this;
		};
	});

	bullyaware_app.directive('nbEffectToggle', ['$timeout',
		function($timeout) {
			return {
				restrict: 'A', // use as attribute
				link: function(scope, element, attrs) {
					var opt = scope.$eval(attrs.nbEffectOptions);
					var jqelement = angular.element(element);
					var last = {};
					scope.$watch(attrs.nbEffectToggle, function(value) {
						if (last.value === undefined) {
							if (value) {
								jqelement.show();
							} else {
								jqelement.hide();
							}
							last.value = value;
						} else if (last.value !== value) {
							last.value = value;
							if (value) {
								jqelement.show(opt);
							} else {
								jqelement.hide(opt);
							}
						}
					});
				}
			};
		}
	]);

	bullyaware_app.directive('nbEffectSwitchClass', function($parse) {
		return {
			restrict: 'A', // use as attribute
			link: function(scope, element, attrs) {
				var opt = scope.$eval(attrs.nbEffectOptions);
				var jqelement = angular.element(element);
				if (opt.complete) {
					var complete_apply = function() {
						scope.safe_apply(opt.complete);
					};
				}
				var first = true;
				scope.$watch(attrs.nbEffectSwitchClass, function(value) {
					var duration = opt.duration;
					if (first) {
						first = false;
						duration = 0;
					}
					if (value) {
						jqelement.switchClass(
							opt.from, opt.to,
							duration, opt.easing, complete_apply);
					} else {
						jqelement.switchClass(
							opt.to, opt.from,
							duration, opt.easing, complete_apply);
					}
				});
			}
		};
	});


	bullyaware_app.directive('nbTwitterChooser', [
		'$http', '$sanitize', '$rootScope', '$parse',
		function($http, $sanitize, $rootScope, $parse) {
			return {
				restrict: 'A', // use as attribute
				link: function(scope, element, attrs) {
					var fn = $parse(attrs.nbTwitterChooser);
					element.autocomplete({
						delay: 500,
						source: function(request, callback) {
							$http({
								method: 'GET',
								url: '/api/user/twitter_id_complete?q=' + escape(request.term)
							}).then(function(res) {
								return callback(res.data);
							}, function(err) {
								return callback();
							});
						},
						focus: function(event, ui) {
							return false;
						},
						select: function(event, ui) {
							element.val('@' + ui.item.screen_name);
							scope.$apply(function() {
								fn(scope, {
									$item: ui.item
								});
							});
							return false;
						},
						search: function(event, ui) {
							element.nextAll('.twitter-chooser-spin').css({
								opacity: 1
							});
						},
						response: function(event, ui) {
							element.nextAll('.twitter-chooser-spin').css({
								opacity: 0
							});
						}
					}).data('ui-autocomplete')._renderItem = function(ul, item) {
						return $('<li>').append(
							'<a><b>@' + $sanitize(item.screen_name) +
							'</b><br/><small><u>Name:</u> ' + $sanitize(item.name) +
							'<br/><u>From:</u> ' + $sanitize(item.location) +
							'<br/><img width="40" src="' + $sanitize(item.profile_image_url) +
							'"/></small></a>'
						).appendTo(ul);
					};
				}
			};
		}
	]);



	// see http://stackoverflow.com/questions/14965968/angularjs-browser-autofill-workaround-by-using-a-directive
	// TODO: but it still doesn't work, and angular doesn't handle autofill...
	bullyaware_app.directive('autoFillSync', function($timeout) {
		return {
			require: '?ngModel',
			link: function(scope, elem, attrs, ngModel) {
				var origVal = elem.val();
				$timeout(function() {
					var newVal = elem.val();
					if (ngModel.$pristine && origVal !== newVal) {
						ngModel.$setViewValue(newVal);
					}
				}, 500);
			}
		};
	});

	// general action log to save operations info
	bullyaware_app.factory('event_log', ['$http',
		function($http) {
			return function event_log(event, data) {
				// mixpanel.track(event, data);
				ga('send', 'event', 'general', event, data ? data.toString() : undefined);
				return $http({
					method: 'POST',
					url: '/api/event_log',
					data: {
						event: event,
						data: data
					}
				}).then(function(res) {
					console.log('EVENT LOGGED', event, data);
					return res;
				}, function(err) {
					console.error('EVENT LOG FAILED', err);
					throw err;
				});
			};
		}
	]);

	var HIGHLIGHT_EFFECT = {
		effect: 'highlight',
		color: '#08c',
		duration: 1000
	};

	function init_common_links($scope, $window, $location, event_log) {
		function make_redirect(path) {
			return function() {
				var duration = 200;
				$('body').children().not('.stable').fadeOut(duration);
				setTimeout(function() {
					$window.location = path;
				}, duration);
			};
		}
		$scope.on_main = $scope.on_main || make_redirect('/');
		$scope.on_whatis = $scope.on_whatis || make_redirect('/whatis');
		$scope.on_features = $scope.on_features || make_redirect('/features');
		$scope.on_about = $scope.on_about || make_redirect('/about');
		$scope.on_login = $scope.on_login || make_redirect('/login');
		$scope.on_getstarted = $scope.on_getstarted || make_redirect('/getstarted');
		$scope.on_settings = $scope.on_settings || make_redirect('/settings');
		$scope.on_demo = $scope.on_demo || make_redirect('/demo');
		$scope.on_contact_us = $scope.on_contact_us || make_redirect('/contact');

		$scope.on_yahoo_hackathon = $scope.on_yahoo_hackathon || function() {
			event_log('yahoo_hackathon');
			var url = 'http://yahoodevelopers.tumblr.com/post/64404445568/yahoo-hack-israel-winning-hacks';
			$window.open(url, '_blank');
		};

		$scope.on_send_mail = $scope.on_send_mail || function() {
			event_log('send_mail');
			var url = 'mailto:info@bullyaware.co?subject=Request for info';
			$window.open(url, '_blank');
		};

		$scope.on_support_call = $scope.on_support_call || function() {
			event_log('support_call');
			var url = 'mailto:info@bullyaware.co?subject=Support call';
			$window.open(url, '_blank');
		};

		$scope.on_follow_facebook = $scope.on_follow_facebook || function() {
			event_log('follow_facebook');
			var url = 'https://www.facebook.com/Bullyaware.co';
			$window.open(url, '_blank');
		};

		$scope.on_follow_twitter = $scope.on_follow_twitter || function() {
			event_log('follow_twitter');
			var url = 'https://twitter.com/bullyawareco';
			$window.open(url, '_blank');
		};

		$scope.on_terms_of_use = $scope.on_terms_of_use || function() {
			event_log('terms_of_use');
			alert('The terms of use are being finalized and will soon be available');
		};

		$scope.on_privacy_policy = $scope.on_privacy_policy || function() {
			event_log('privacy_policy');
			alert('The privacy policy is being finalized and will soon be available');
		};

		if (!$scope.page_loaded) {
			$scope.page_loaded = true;

			// start animations on page load
			$('.page_content').fadeIn(1000);

			event_log('page', $location.absUrl());
		}
	}

	function init_server_data($scope) {
		var server_data_raw = $('#server_data').html();
		$scope.server_data = server_data_raw ? JSON.parse(server_data_raw) : {};
		$scope.session_id = $scope.server_data.session;
		$scope.user = $scope.server_data.user;
		// console.log('USER', $scope.user, 'DATA', $scope.server_data);
		// init_intercom_io($scope.user);
	}

	function init_intercom_io(user) {
		window.intercomSettings = {
			// TODO: The current logged in user's email address.
			email: user ? user.email : 'guest@bullyaware.co',
			// TODO: The current logged in user's sign-up date as a Unix timestamp.
			created_at: 0,
			app_id: "3372acc94990a1532f4a3488f3c3fa49932b7ddf",
			"widget": {
				// "activator": "#IntercomDefaultWidget",
				"activator": "#Intercom",
			},
		};
		(function() {
			var w = window;
			var ic = w.Intercom;
			if (typeof ic === "function") {
				ic('reattach_activator');
				ic('update', intercomSettings);
			} else {
				var d = document;
				var i = function() {
					i.c(arguments);
				};
				i.q = [];
				i.c = function(args) {
					i.q.push(args);
				};
				w.Intercom = i;

				var l = function() {
					var s = d.createElement('script');
					s.type = 'text/javascript';
					s.async = true;
					s.src = 'https://static.intercomcdn.com/intercom.v1.js';
					var x = d.getElementsByTagName('script')[0];
					x.parentNode.insertBefore(s, x);
				};
				if (w.attachEvent) {
					w.attachEvent('onload', l);
				} else {
					w.addEventListener('load', l, false);
				}
			}
		})();
	}




	bullyaware_app.controller('MenuCtrl', [
		'$scope', '$http', '$q', '$timeout', '$window', '$location', 'event_log', MenuCtrl
	]);

	function MenuCtrl($scope, $http, $q, $timeout, $window, $location, event_log) {
		init_common_links($scope, $window, $location, event_log);
		$scope.active_link = function(link) {
			return (link === $window.location.pathname) ? 'active' : '';
		};
	}




	bullyaware_app.controller('MainCtrl', [
		'$scope', '$http', '$q', '$timeout', '$window', '$location', 'event_log', MainCtrl
	]);

	function MainCtrl($scope, $http, $q, $timeout, $window, $location, event_log) {
		init_common_links($scope, $window, $location, event_log);
		init_server_data($scope);

		$scope.is_signup = true;

		$scope.do_start = function() {
			event_log('main_start');
			if ($scope.user) {
				// TODO
			}
			$('#start_modal').modal();
		};

		$scope.do_learn = function() {
			event_log('main_learn');
		};

		$scope.toggle_login_signup = function(l) {
			var m = $('#start_modal');
			var signup = m.find('#signup_form');
			var login = m.find('#login_form');
			var effect = {
				effect: 'blind',
				duration: 400
			};
			if (l) {
				signup.hide(effect);
				login.show(effect);
			} else {
				signup.show(effect);
				login.hide(effect);
			}
		};

		$scope.do_login = function() {
			if (!$scope.login_email) {
				$("#login_email").effect(HIGHLIGHT_EFFECT).focus();
				return;
			}
			if (!$scope.login_password) {
				$("#login_password").effect(HIGHLIGHT_EFFECT).focus();
				return;
			}
			event_log('do_login', $scope.login_email);
			$http({
				method: 'POST',
				url: '/api/user/login',
				data: {
					email: $scope.login_email,
					password: $scope.login_password
				}
			}).then(function(res) {
				console.log('USER LOGIN DONE', res);
				$scope.on_getstarted();
			}, function(err) {
				console.error('USER LOGIN FAILED', err);
				alert('Login failed. Please try again later');
			});
		};

		$scope.do_signup = function() {
			if (!$scope.first_name) {
				$("#first_name").effect(HIGHLIGHT_EFFECT).focus();
				return;
			}
			if (!$scope.last_name) {
				$("#last_name").effect(HIGHLIGHT_EFFECT).focus();
				return;
			}
			if (!$scope.user_email) {
				$("#user_email").effect(HIGHLIGHT_EFFECT).focus();
				return;
			}
			if (!$scope.user_password) {
				$("#user_password").effect(HIGHLIGHT_EFFECT).focus();
				return;
			}
			if (!$scope.user_password2 || $scope.user_password2 !== $scope.user_password) {
				$("#user_password2").effect(HIGHLIGHT_EFFECT).focus();
				return;
			}
			// send action log async
			event_log('signup', $scope.user_email);
			return $http({
				method: 'POST',
				url: '/api/user/signup',
				data: {
					first_name: $scope.first_name,
					last_name: $scope.last_name,
					email: $scope.user_email,
					password: $scope.user_password
				}
			}).then(function(res) {
				console.log('USER CREATED', res);
				$scope.on_getstarted();
			}, function(err) {
				console.error('USER CREATE FAILED', err);
				alert('Signup failed. Please try again later');
			});
		};
	}




	bullyaware_app.controller('WelcomeCtrl', [
		'$scope', '$http', '$q', '$timeout', '$window', '$location', 'event_log', WelcomeCtrl
	]);

	function WelcomeCtrl($scope, $http, $q, $timeout, $window, $location, event_log) {
		init_common_links($scope, $window, $location, event_log);
		init_server_data($scope);
	}




	bullyaware_app.controller('WhatisCtrl', [
		'$scope', '$http', '$q', '$timeout', '$window', '$location', 'event_log', WhatisCtrl
	]);

	function WhatisCtrl($scope, $http, $q, $timeout, $window, $location, event_log) {
		init_common_links($scope, $window, $location, event_log);
		init_server_data($scope);

		// start animations on page load
		$('.poster_area').fadeIn(1000);
	}




	bullyaware_app.controller('FeaturesCtrl', [
		'$scope', '$http', '$q', '$timeout', '$window', '$location', 'event_log', FeaturesCtrl
	]);

	function FeaturesCtrl($scope, $http, $q, $timeout, $window, $location, event_log) {
		init_common_links($scope, $window, $location, event_log);
		init_server_data($scope);
	}




	bullyaware_app.controller('AboutCtrl', [
		'$scope', '$http', '$q', '$timeout', '$window', '$location', 'event_log', AboutCtrl
	]);

	function AboutCtrl($scope, $http, $q, $timeout, $window, $location, event_log) {
		init_common_links($scope, $window, $location, event_log);
		init_server_data($scope);
	}




	bullyaware_app.controller('ContactCtrl', [
		'$scope', '$http', '$q', '$timeout', '$window', '$location', 'event_log', ContactCtrl
	]);

	function ContactCtrl($scope, $http, $q, $timeout, $window, $location, event_log) {
		init_common_links($scope, $window, $location, event_log);
		init_server_data($scope);
	}




	bullyaware_app.controller('LoginCtrl', [
		'$scope', '$http', '$q', '$timeout', '$window', '$location', 'event_log', LoginCtrl
	]);

	function LoginCtrl($scope, $http, $q, $timeout, $window, $location, event_log) {
		init_common_links($scope, $window, $location, event_log);
		init_server_data($scope);

		$scope.do_login = function() {
			if (!$scope.user_email) {
				$("#user_email").effect(HIGHLIGHT_EFFECT).focus();
				return;
			}
			if (!$scope.user_password) {
				$("#user_password").effect(HIGHLIGHT_EFFECT).focus();
				return;
			}
			event_log('do_login', $scope.user_email);
			$http({
				method: 'POST',
				url: '/api/user/login',
				data: {
					email: $scope.user_email,
					password: $scope.user_password
				}
			}).then(function(res) {
				console.log('USER LOGIN DONE', res);
				$scope.on_getstarted();
			}, function(err) {
				console.error('USER LOGIN FAILED', err);
				alert('Login failed. Please try again later');
			});
		};
	}




	bullyaware_app.controller('SignupCtrl', [
		'$scope', '$http', '$q', '$timeout', '$window', '$location', 'event_log', SignupCtrl
	]);

	function SignupCtrl($scope, $http, $q, $timeout, $window, $location, event_log) {
		init_common_links($scope, $window, $location, event_log);
		init_server_data($scope);

		$scope.do_signup = function() {
			if (!$scope.user_email) {
				$("#user_email").effect(HIGHLIGHT_EFFECT).focus();
				return;
			}
			if (!$scope.user_password) {
				$("#user_password").effect(HIGHLIGHT_EFFECT).focus();
				return;
			}
			if (!$scope.user_password2 || $scope.user_password2 !== $scope.user_password) {
				$("#user_password2").effect(HIGHLIGHT_EFFECT).focus();
				return;
			}
			// send action log async
			event_log('signup', $scope.user_email);
			return $http({
				method: 'POST',
				url: '/api/user/signup',
				data: {
					email: $scope.user_email,
					password: $scope.user_password
				}
			}).then(function(res) {
				console.log('USER CREATED', res);
				$scope.on_getstarted();
			}, function(err) {
				console.error('USER CREATE FAILED', err);
				alert('Signup failed. Please try again later');
			});
		};
	}





	bullyaware_app.controller('SettingsCtrl', [
		'$scope', '$http', '$q', '$timeout', '$window', '$location', 'event_log', SettingsCtrl
	]);

	function SettingsCtrl($scope, $http, $q, $timeout, $window, $location, event_log) {
		init_common_links($scope, $window, $location, event_log);
		init_server_data($scope);

		function show_loading() {
			$('#loading_panel').show();
		}

		function hide_loading() {
			$('#loading_panel').hide();
		}

		function fetch_user_info() {
			show_loading();
			return $http({
				method: 'GET',
				url: '/api/user'
			}).then(function(res) {
				console.log('GOT USER', res.data);
				$scope.user_info = res.data;
				hide_loading();
			}, function(err) {
				console.error('FAILED GET USER', err);
				$timeout(fetch_user_info, 1000);
			});
		}
		fetch_user_info();

		$scope.add_person = function(name) {
			if (!name) {
				$("#new_person").effect(HIGHLIGHT_EFFECT).focus();
				return;
			}
			show_loading();
			event_log('add_person', name);
			$http({
				method: 'POST',
				url: '/api/person',
				data: {
					name: name
				}
			}).then(function(res) {
				console.log('ADD PERSON', res);
				$scope.new_person = '';
				return fetch_user_info();
			}, function(err) {
				console.error('FAILED ADD PERSON', err);
				hide_loading();
			});
		};

		$scope.del_person = function(person) {
			var q = 'Are you sure you want to remove the person "' +
				person.name + '" from your account?';
			if (!window.confirm(q)) {
				return;
			}
			show_loading();
			return $http({
				method: 'DELETE',
				url: '/api/person/' + person._id
			}).then(function(res) {
				console.log('DEL PERSON', res);
				return fetch_user_info();
			}, function(err) {
				console.error('FAILED DEL PERSON', err);
				hide_loading();
			});
		};

		$scope.active_path = function(path) {
			if ('/' + path === $location.path()) {
				return 'active';
			}
		};

		$scope.return_id = function(x) {
			return x._id;
		};
		$scope.return_arg = function(x) {
			return x;
		};

		$scope.identity_account_name = function(identity) {
			if (identity.type === 'twitter') {
				return '@' + identity.profile.screen_name;
			}
			return 'Unknown Type ' + identity.type;
		};
		$scope.identity_real_name = function(identity) {
			if (identity.type === 'twitter') {
				return identity.profile.name;
			}
			return '';
		};
		$scope.identity_location_info = function(identity) {
			if (identity.type === 'twitter') {
				return identity.profile.location;
			}
			return '';
		};
		$scope.identity_more_info = function(identity) {
			if (identity.type === 'twitter') {
				return identity.profile.description;
			}
			return '';
		};
		$scope.identity_link = function(identity) {
			if (identity.type === 'twitter') {
				return 'twitter.com/' + identity.profile.screen_name;
			}
			return '#';
		};

		$scope.show_add_twit = function(person) {
			var elem = $('#new_twit_id_' + person._id);
			person.ng_show_add_twit = true;
			elem.val('');
			$.when(elem.animate({
				opacity: 1,
				width: '200px'
			}, 200)).then(function() {
				elem.focus();
			});
		};

		$scope.hide_add_twit = function(person, force) {
			var elem = $('#new_twit_id_' + person._id);
			if (force !== 'force' && elem.val()) {
				elem.autocomplete('search');
				elem.effect(HIGHLIGHT_EFFECT).focus();
				return;
			}
			person.ng_show_add_twit = false;
			elem.val('');
			elem.animate({
				opacity: 0,
				width: 0
			}, 100);
		};

		$scope.toggle_add_twit = function(person) {
			if (!person.ng_show_add_twit) {
				$scope.show_add_twit(person);
			} else {
				$scope.hide_add_twit(person);
			}
		};

		$scope.add_twit_identity = function(person, twit_identity) {
			show_loading();
			event_log('add_twit_id', twit_identity.screen_name);
			$http({
				method: 'POST',
				url: '/api/person/' + person._id + '/identity',
				data: {
					type: 'twitter',
					sid: twit_identity.id_str
				}
			}).then(function(res) {
				console.log('ADD IDENTITY', res);
				$scope.hide_add_twit(person, 'force');
				return fetch_user_info();
			}, function(err) {
				console.error('FAILED ADD IDENTITY', err);
				hide_loading();
			});
		};

		$scope.del_identity = function(person, identity) {
			var q = 'Are you sure you want to remove "' + $scope.identity_account_name(identity) + '"?';
			if (!window.confirm(q)) {
				return;
			}
			show_loading();
			return $http({
				method: 'DELETE',
				url: '/api/person/' + person._id + '/identity/' + identity._id
			}).then(function(res) {
				console.log('DEL IDENTITY', res);
				return fetch_user_info();
			}, function(err) {
				console.error('FAILED DEL IDENTITY', err);
				hide_loading();
			});
		};

		$scope.do_report = function(person) {
			show_loading();
			return $http({
				method: 'POST',
				url: '/api/person/' + person._id + '/report'
			}).then(function(res) {
				console.log('MAKE REPORT', res);
				person.report = res.data;
				hide_loading();
			}, function(err) {
				console.error('FAILED MAKE REPORT', err);
				hide_loading();
			});
		};
	}






	bullyaware_app.controller('GetStartedCtrl', [
		'$scope', '$http', '$q', '$timeout', '$window', '$location', 'event_log', GetStartedCtrl
	]);

	function GetStartedCtrl($scope, $http, $q, $timeout, $window, $location, event_log) {
		init_common_links($scope, $window, $location, event_log);
		init_server_data($scope);

		function fetch_user_info() {
			$http({
				method: 'GET',
				url: '/api/user'
			}).then(function(res) {
				console.log('GOT USER', res.data);
				$scope.user_info = res.data;
				if ($scope.user_info.role) {
					$scope.user_role = $scope.user_info.role;
				}
				$('#loading_sign').hide();
				$('#getstarted_content').fadeIn(1000);
			}, function(err) {
				console.error('FAILED GET USER', err);
				$timeout(fetch_user_info, 1000);
			});
		}
		fetch_user_info();


		$scope.on_user_role = function(role) {
			if (role === $scope.user_role) {
				return;
			}
			event_log('user_role', role);
			/*
			$http({
				method: 'PUT',
				url: '/api/user',
				data: {
					role: role
				}
			}).then(function(res) {
				console.log('UPDATED ROLE', res);
				$scope.user_role = role;
			}, function(err) {
				console.error('FAILED UPDATE ROLE', err);
			});
			*/
			$scope.user_role = role;
		};


		$scope.account_types = [{
			name: 'Twitter',
			icon: 'fa-twitter-square',
			color: '#7af'
		}, {
			name: 'Facebook',
			icon: 'fa-facebook-square',
			color: '#66b'
		}, {
			name: 'Google+',
			icon: 'fa-google-plus-square',
			color: '#c33'
		}, {
			name: 'Youtube',
			icon: 'fa-youtube-square',
			color: '#a66'
		}, {
			name: 'Instagram',
			icon: 'fa-instagram',
			color: '#881'
		}, {
			name: 'Tumblr',
			icon: 'fa-tumblr-square',
			color: '#33b'
		}, {
			name: 'Flickr',
			icon: 'fa-flickr',
			color: '#b3b'
		}, {
			name: 'Pinterest',
			icon: 'fa-pinterest-square',
			color: '#b33'
		}, {
			name: 'Other',
			icon: 'fa-question-circle',
			color: '#777'
		}];


		// TODO sync with user object on server
		$scope.twitter_accounts = [];

		$scope.add_twitter = function() {
			var name = $scope.target_account;
			if (!name) {
				return;
			}
			event_log('add_twitter', name);
			if (name[0] !== '@') {
				name = '@' + name;
			}
			$scope.twitter_accounts.push(name);
			$scope.target_account = '';
		};
		$scope.help_find_twitter = function() {
			event_log('help_find_twitter');
			alert('Coming soon');
		};
		$scope.done_twitter = function() {
			event_log('done_twitter');
			$scope.is_done_twitter = true;
		};


		$scope.on_click_account_type = function(type, event) {
			$(event.target).effect({
				effect: 'pulsate',
				times: 2
			});
			type.checked = !type.checked;
			if (type.checked) {
				event_log('account_type_set', type.name);
			} else {
				event_log('account_type_unset', type.name);
			}
		};
		$scope.done_others = function() {
			event_log('done_others');
			$scope.is_done_others = true;
		};


		$scope.subscribe = function(time) {
			event_log('subscribe', time);
			alert('Thanks! We will contact you shortly');
		};
	}





	bullyaware_app.controller('DemoCtrl', [
		'$scope', '$http', '$q', '$timeout', '$window', '$location', 'event_log', DemoCtrl
	]);

	function DemoCtrl($scope, $http, $q, $timeout, $window, $location, event_log) {
		init_common_links($scope, $window, $location, event_log);
		init_server_data($scope);

		// $scope.target_account = 'elizabeth_tice';
		// $scope.target_account = 'yahoomail';
		// $scope.target_account = 'KarenGravanoVH1';
		// $scope.target_account = 'jenny_sad';
		// $scope.target_account = 'MileyCyrus';

		var DEMO_ACCOUNT = 'SomeSKANKinMI';
		$scope.target_account = DEMO_ACCOUNT;
		$scope.analyze = analyze;
		analyze();

		function analyze() {
			if (!$scope.target_account || $scope.target_account === DEMO_ACCOUNT) {
				event_log('analyze_demo', DEMO_ACCOUNT);
				$scope.target_account = DEMO_ACCOUNT;
			} else {
				event_log('analyze_try', $scope.target_account);
			}
			if ($scope.target_account[0] === '@') {
				$scope.last_query = $scope.target_account;
			} else {
				$scope.last_query = '@' + $scope.target_account;
			}
			$scope.last_result = '';
			$scope.last_error = null;
			return $http({
				method: 'POST',
				url: '/api/demo_query',
				data: {
					query: $scope.last_query
				}
			}).then(function(res) {
				$scope.last_result = res.data;
				$scope.safe_apply();
				fill_graph();
			}, function(err) {
				$scope.last_error = err;
			});
		}

		$scope.is_level_low = function(level) {
			return level < 0.4;
		};
		$scope.is_level_med = function(level) {
			return level >= 0.4 && level < 0.7;
		};
		$scope.is_level_high = function(level) {
			return level >= 0.7;
		};
		$scope.level_to_color = function(level) {
			if ($scope.is_level_low(level)) {
				return "rgb(80, 170, 80)";
			} else if ($scope.is_level_high(level)) {
				return "rgb(170, 80, 80)";
			} else {
				return "rgb(170, 170, 80)";
			}
		};

		function fill_graph() {
			if (!$scope.last_result) {
				return;
			}
			d3.select("#graph").select("svg").remove();
			var width = $("#graph").parent().parent().width() - 50;
			var height = 200;
			var pad = 25;
			var messages = $scope.last_result.messages;
			if (!messages || !messages.length) {
				return;
			}
			var first_id = messages[0].id;
			var last_id = messages[messages.length - 1].id;

			var svg = d3.select("#graph")
				.append("svg")
				.attr("width", width)
				.attr("height", height)
				.style('border', 'solid 1px black');

			var xscale = d3.scale.linear()
				.domain([first_id, last_id])
				.range([pad, width - pad - pad]);
			var xAxis = d3.svg.axis()
				.scale(xscale)
				.orient("bottom")
				.ticks(4)
				.tickFormat(function(x) {
					return '';
				});
			svg.append("g")
				.attr("class", "axis")
				.attr("transform", "translate(0," + (height - pad) + ")")
				.call(xAxis);

			var yscale = d3.scale.linear()
				.domain([1, 0])
				.range([pad, height - pad - pad]);

			var radius = function(msg) {
				return 7 + Math.min(msg.retweet_count, 5) * 2;
			};
			var circles = svg.selectAll("circle")
				.data(messages)
				.enter()
				.append("circle");
			circles.attr("cx", function(msg, i) {
				return xscale(msg.id);
			});
			circles.attr("r", radius);
			circles.attr("fill", function(msg) {
				return $scope.level_to_color(msg.level);
			});
			circles.attr("stroke", "rgba(255,255,255,0.5)");
			circles.attr("stroke-width", '2px');
			var y0 = yscale(0);
			circles.attr("cy", y0).transition().attr("cy", function(msg, i) {
				return yscale(msg.level);
			}).duration(2000).delay(750);
			circles.on('click', function(msg) {
				event_log('timeline_details', msg);
				alert('[Level ' + (msg.level * 100).toFixed(0) +
					'%] [Retweeted ' + msg.retweet_count + '] ' + msg.text);
			});
		}

	}






})();
