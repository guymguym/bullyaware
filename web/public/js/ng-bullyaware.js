(function() {

	// define the angular module
	var bullyaware_app = angular.module('bullyaware_app', []);


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


	bullyaware_app.controller('BullyCtrl', [
		'$scope', '$http', '$q', '$location', BullyCtrl
	]);

	function BullyCtrl($scope, $http, $q, $location) {
		$scope.location = $location;

		$scope.account_types = [{
			name: 'Twitter',
			icon: 'icon-twitter-sign',
			color: '#7af'
		}, {
			name: 'Facebook',
			icon: 'icon-facebook-sign',
			color: '#66b'
		}, {
			name: 'Tumblr',
			icon: 'icon-tumblr-sign',
			color: '#33b'
		}, {
			name: 'Flickr',
			icon: 'icon-flickr',
			color: '#b3b'
		}, {
			name: 'Pinterest',
			icon: 'icon-pinterest-sign',
			color: '#b33'
		}];
		$scope.choose_account_type = function(type) {
			$scope.account_type = type;
		};
		$scope.account_type = $scope.account_types[0];


		// $scope.target_account = 'elizabeth_tice';
		// $scope.target_account = 'yahoomail';
		// $scope.target_account = 'KarenGravanoVH1';
		// $scope.target_account = 'jenny_sad';
		// $scope.target_account = 'MileyCyrus';


		$scope.check = function() {
			if (!$scope.target_account) {
				$("#target_account").effect('highlight', 1000).focus().parent().addClass('has-error');
				return;
			}
			$("#target_account").parent().removeClass('has-error');

			if (!$scope.user_email) {
				$("#user_email").effect('highlight', 1000).focus().parent().addClass('has-error');
				return;
			}
			$("#user_email").parent().removeClass('has-error');

			$q.when(signup()).then(analyze);
		};


		function signup() {
			return $http({
				method: 'POST',
				url: '/api/signup',
				data: {
					email: $scope.user_email
				}
			});
		}

		function analyze() {
			d3.select("#graph").select("svg").remove();
			$scope.last_query = '@' + $scope.target_account;
			$scope.last_result = '';
			$scope.last_error = null;
			return $http({
				method: 'POST',
				url: '/api/analyze',
				data: {
					query: $scope.last_query
				}
			}).then(function(res) {
				$scope.last_result = res.data;
				$scope.safe_apply();
				var width = $("#graph").parent().parent().width() - 40;
				var height = 300;
				var pad = 25;
				var messages = res.data.messages;
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
					return msg.retweet_count >= 10 ? 50 : ((msg.retweet_count + 1) * 50 / 10);
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
					return "rgba(" + (msg.level * 250) + ", 150, 220, 0.8)";
				});
				circles.attr("stroke", "rgba(100, 220, 50, 0.40)");
				circles.attr("stroke-width", function(msg) {
					return radius(msg) / 2;
				});
				var y0 = yscale(0);
				circles.attr("cy", y0).transition().attr("cy", function(msg, i) {
					return yscale(msg.level);
				}).duration(2000).delay(750);
				circles.on('click', function(msg) {
					alert('(Bully-level ' + (msg.level * 100).toFixed(0) +
						'% Retweeted ' + msg.retweet_count + ') ' + msg.text);
				});
			}, function(err) {
				$scope.last_error = err;
			});
		}

		$scope.stringify = function(o) {
			return JSON.stringify(o);
		};

	}

})();
