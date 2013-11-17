/* jshint node:true */
'use strict';

// Convinient callback maker for handling the reply of async control flows.
// Example usage:
//		async.waterfall([
//			...
//		], reply_callback(req, res, debug_info));

function reply_callback(req, res, debug_info) {
	return function(err, reply) {
		if (err) {
			var status = err.status || err.statusCode;
			var data = err.data || err.message;
			console.log(status === 200 ? 'COMPLETED' : 'FAILED', debug_info, ':', err);
			if (typeof status === 'number' &&
				status >= 100 &&
				status < 600
			) {
				return res.json(status, data);
			} else {
				return res.json(500, data);
			}
		}
		if (!res.headerSent) {
			console.log('COMPLETED', debug_info);
			return res.json(200, reply);
		}
	};
}

exports.reply_callback = reply_callback;
