(function() {

	// define the angular module
	var bullyalert_app = angular.module('bullyalert_app', []);


	bullyalert_app.controller('BullyCtrl', [
		'$scope', '$http', '$location', BullyCtrl
	]);

	function BullyCtrl($scope, $http, $location) {
		$scope.location = $location;

		// $scope.query = '@elizabeth_tice';
		// $scope.query = '@yahoomail';
		$scope.query = '@KarenGravanoVH1';
		// $scope.query = '@jenny_sad';
		// $scope.query = '@MileyCyrus';

		$scope.analyze = function() {
			d3.select("#graph").select("svg").remove();
			$scope.last_query = $scope.query;
			$scope.last_result = '';
			$scope.last_error = null;
			$http({
				method: 'POST',
				url: '/api/analyze',
				data: {
					query: $scope.last_query
				}
			}).then(function(res) {
				$scope.last_result = res.data;
				var width = 900;
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
		};

		$scope.stringify = function(o) {
			return JSON.stringify(o);
		};

	}

})();