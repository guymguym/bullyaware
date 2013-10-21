exports.signup = function(req, res) {
	// TODO.....
	console.log('SIGNUP', req.body);
	res.json(200, {
		user: {
			info: req.body
		}
	});
};
