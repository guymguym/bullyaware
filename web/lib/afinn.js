/* jshint node:true */
/* jshint -W099 */
'use strict';

var fs = require('fs');
var path = require('path');

function text_to_json(text) {
	var words = {};
	var arr = text.toString().split('\n');
	for (var i = 0; i < arr.length; i++) {
		var line = arr[i].split('\t');
		words[line[0]] = parseInt(line[1], 10);
	}
	return words;
}

exports.words = text_to_json(fs.readFileSync(
	path.resolve(__dirname, '../../AFINN/AFINN-111.txt'), {
		encoding: 'utf8'
	}
));

exports.unknown_words = {};
