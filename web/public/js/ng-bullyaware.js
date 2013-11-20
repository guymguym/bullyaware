/* jshint browser:true, jquery:true, devel:true */
/* global angular:false */
/* global _:false */
/* global Backbone:false */
(function() {
	'use strict';

	// define the angular module
	var bullyaware_app = angular.module('bullyaware_app', ['ngSanitize', 'ngRoute', 'ngAnimate']);


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
						return $('<li>').append('<a style="border-bottom: 1px #eee solid">' +
							'<b>@' + $sanitize(item.screen_name) + '</b>' +
							'<img class="pull-right" width="40" src="' + $sanitize(item.profile_image_url) + '"/>' +
							'<br/><small>' + $sanitize(item.name) +
							(item.location ? '<br/>' + $sanitize(item.location) : '') +
							'</small></a>'
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
		effect: 'pulsate',
		// color: '#0c8',
		times: 2,
		duration: 500
	};





	bullyaware_app.controller('MainCtrl', [
		'$scope', '$http', '$q', '$timeout', '$window', '$location', 'event_log', MainCtrl
	]);


	function MainCtrl($scope, $http, $q, $timeout, $window, $location, event_log) {

		// utils to insert data directly into html
		$scope.return_id = function(x) {
			return x._id;
		};
		$scope.return_arg = function(x) {
			return x;
		};

		function make_redirect(path) {
			return function() {
				var duration = 100;
				$('.hide_on_unload').animate({
					opacity: 0
				}, duration);
				setTimeout(function() {
					$window.location = path;
				}, duration);
			};
		}

		$scope.goto_main = make_redirect('/');
		$scope.goto_signup = make_redirect('/signup');
		$scope.goto_create = make_redirect('/create');
		$scope.goto_user_home = make_redirect('/home');
		$scope.goto_login = make_redirect('/login');
		$scope.goto_logout = make_redirect('/api/user/logout');
		$scope.goto_info = make_redirect('/info');
		$scope.goto_contact_us = make_redirect('/contact');
		$scope.goto_whatis = make_redirect('/info#/whatis');
		$scope.goto_features = make_redirect('/info#/features');
		$scope.goto_about = make_redirect('/info#/about');
		$scope.goto_demo = make_redirect('/info#/demo');

		$scope.on_getstarted = function() {
			if ($scope.user) {
				$scope.goto_user_home();
			} else {
				$scope.goto_signup();
			}
		};

		$scope.open_login = function() {
			if ($scope.user) {
				$scope.goto_user_home();
				return;
			}
			var m = $('#login_modal');
			if (m.length && typeof m.modal === 'function') {
				m.modal();
			} else {
				$scope.goto_login();
			}
		};

		$scope.goto_yahoo_hackathon = function() {
			event_log('yahoo_hackathon');
			var url = 'http://yahoodevelopers.tumblr.com/post/64404445568/yahoo-hack-israel-winning-hacks';
			$window.open(url, '_blank');
		};

		$scope.goto_send_mail = function() {
			event_log('send_mail');
			var url = 'mailto:info@bullyaware.co?subject=Request for info';
			$window.open(url, '_blank');
		};

		$scope.goto_support_call = function() {
			event_log('support_call');
			var url = 'mailto:info@bullyaware.co?subject=Support call';
			$window.open(url, '_blank');
		};

		$scope.goto_follow_facebook = function() {
			event_log('follow_facebook');
			var url = 'https://www.facebook.com/Bullyaware.co';
			$window.open(url, '_blank');
		};

		$scope.goto_follow_twitter = function() {
			event_log('follow_twitter');
			var url = 'https://twitter.com/bullyawareco';
			$window.open(url, '_blank');
		};

		$scope.goto_terms_of_use = function() {
			event_log('terms_of_use');
			alert('The terms of use are being finalized and will soon be available');
		};

		$scope.goto_privacy_policy = function() {
			event_log('privacy_policy');
			alert('The privacy policy is being finalized and will soon be available');
		};

		$scope.active_link = function(link) {
			return (link === $window.location.pathname) ? 'active' : '';
		};
		$scope.active_link_hash = function(link) {
			return (link === $window.location.hash) ? 'active' : '';
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
				$scope.goto_user_home();
			}, function(err) {
				console.error('USER LOGIN FAILED', err);
				alert('Login failed. Please check your password and try again later');
			});
		};

		$scope.do_signup = function() {
			/*
			if (!$scope.signup_first_name) {
				$("#signup_first_name").effect(HIGHLIGHT_EFFECT).focus();
				return;
			}
			if (!$scope.signup_last_name) {
				$("#signup_last_name").effect(HIGHLIGHT_EFFECT).focus();
				return;
			}
			*/
			if (!$scope.signup_email) {
				$("#signup_email").effect(HIGHLIGHT_EFFECT).focus();
				return;
			}
			if (!$scope.signup_password) {
				$("#signup_password").effect(HIGHLIGHT_EFFECT).focus();
				return;
			}
			/*
			if (!$scope.signup_password2 || $scope.signup_password2 !== $scope.signup_password) {
				$("#signup_password2").effect(HIGHLIGHT_EFFECT).focus();
				return;
			}
			*/
			var btn = $(window.event.target);
			var loading = $('<i class="fa fa-spinner fa-spin fa-lg">').appendTo(btn);
			// send action log async
			event_log('signup', $scope.signup_email);
			return $http({
				method: 'POST',
				url: '/api/user/signup',
				data: {
					// first_name: $scope.signup_first_name,
					// last_name: $scope.signup_last_name,
					email: $scope.signup_email,
					password: $scope.signup_password
				}
			}).then(function(res) {
				console.log('SIGNUP', res);
				loading.remove();
				$scope.goto_create();
			}, function(err) {
				console.error('SIGNUP FAILED', err);
				loading.remove();
				if (err.status === 409) {
					alert('Email already exists. Please try to login');
				} else {
					alert('Signup failed. Please try again later');
				}
			});
		};

		function add_person(name) {
			event_log('add_person', name);
			return $http({
				method: 'POST',
				url: '/api/person',
				data: {
					name: name
				}
			}).then(function(res) {
				console.log('ADD PERSON', res);
				return res;
			}, function(err) {
				console.error('FAILED ADD PERSON', err);
				throw err;
			});
		}

		function add_identity(person_id, type, sid) {
			event_log('add_identity', type + ':' + sid);
			return $http({
				method: 'POST',
				url: '/api/person/' + person_id + '/identity',
				data: {
					type: type,
					sid: sid
				}
			}).then(function(res) {
				console.log('ADD IDENTITY', res);
				return res;
			}, function(err) {
				console.error('FAILED ADD IDENTITY', err);
				throw err;
			});
		}

		$scope.finish_create = function() {
			if (!$scope.create_person_name) {
				$("#create_person_name").effect(HIGHLIGHT_EFFECT).focus();
				return;
			}
			if (!$scope.create_twitter_identity || !$scope.create_twitter_identity.id_str) {
				$("#create_twitter_identity").effect(HIGHLIGHT_EFFECT).focus();
				return;
			}
			var btn = $(window.event.target);
			var loading = $('<i class="fa fa-spinner fa-spin fa-lg">').appendTo(btn);
			return add_person($scope.create_person_name).then(function(res) {
				return add_identity(res.data.id, 'twitter', $scope.create_twitter_identity.id_str);
			}, function(err) {
				loading.remove();
				if (err.status === 409) {
					alert('Person name already exists');
					return false;
				} else {
					throw err;
				}
			}).then(function(res) {
				loading.remove();
				if (res) {
					return $scope.goto_user_home();
				}
			}, function(err) {
				loading.remove();
				alert('Something didn\'t work');
			});
		};

		$scope.set_twitter_identity = function(item) {
			$scope.create_twitter_identity = item;
		};

		$scope.account_types = [
			/*{
			name: 'Twitter',
			icon: 'fa-twitter-square',
			color: '#7af'
			}, */
			{
				name: 'Facebook',
				icon: 'fa-facebook-square',
				color: '#46b'
			}, {
				name: 'Google+',
				icon: 'fa-google-plus-square',
				color: '#d44'
			}, {
				name: 'Youtube',
				icon: 'fa-youtube-square',
				color: '#d00'
			}, {
				name: 'Instagram',
				icon: 'fa-instagram',
				color: '#dd7'
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
			}
		];

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

		$scope.get_user_info = function() {
			return $http({
				method: 'GET',
				url: '/api/user'
			}).then(function(res) {
				console.log('GOT USER', res.data);
				$scope.user_info = res.data;
				$scope.user_info.person_map = _.indexBy($scope.user_info.persons, '_id');
				$scope.user_info.identity_map = _.indexBy($scope.user_info.identities, '_id');
				return res;
			}, function(err) {
				console.error('FAILED GET USER', err);
				return $timeout($scope.get_user_info, 1000);
			});
		};


		if (!$scope.page_loaded) {
			$scope.page_loaded = true;

			var server_data_raw = $('#server_data').html();
			$scope.server_data = server_data_raw ? JSON.parse(server_data_raw) : {};
			$scope.session_id = $scope.server_data.session;
			$scope.user = $scope.server_data.user;
			// console.log('USER', $scope.user, 'DATA', $scope.server_data);

			// start animations on page load
			$('.show_on_load').fadeIn(100);

			event_log('page', $location.absUrl());

			$scope.$on('$locationChangeSuccess', function(event) {
				event_log('page', $location.absUrl());
			});

			// init_intercom_io($scope.user);
		}
	}







	bullyaware_app.controller('UserHomeCtrl', [
		'$scope', '$http', '$q', '$timeout', '$window', '$location', 'event_log', '$route', UserHomeCtrl
	]);

	function UserHomeCtrl($scope, $http, $q, $timeout, $window, $location, event_log, $route) {

		function show_loading() {
			$('#loading_panel').show();
		}

		function hide_loading() {
			$('#loading_panel').hide();
		}

		function reset_person_route() {
			if (!$route.current) {
				return;
			}
			if (!($route.current.params.person_id in $scope.user_info.person_map)) {
				$location.hash('');
			}
			$route.reload();
		}

		function reload_user_info() {
			show_loading();
			return $scope.get_user_info().then(function() {
				reset_person_route();
				hide_loading();
			});
		}

		reset_person_route();
		reload_user_info();

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
				return reload_user_info();
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
				return reload_user_info();
			}, function(err) {
				console.error('FAILED DEL PERSON', err);
				hide_loading();
			});
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

		$scope.clear_add_twit = function(person) {
			var elem = $('#new_twit_id_' + person._id);
			elem.val('');
		};

		$scope.click_add_twit = function(person) {
			var elem = $('#new_twit_id_' + person._id);
			elem.autocomplete('search');
			elem.effect(HIGHLIGHT_EFFECT).focus();
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
				$scope.clear_add_twit(person);
				return reload_user_info();
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
				return reload_user_info();
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









	bullyaware_app.controller('DemoCtrl', [
		'$scope', '$http', '$q', '$timeout', '$window', '$location', 'event_log', DemoCtrl
	]);

	function DemoCtrl($scope, $http, $q, $timeout, $window, $location, event_log) {

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



})();
