var afinn = require('./afinn'); // needed here just to load the afinn data
var _ = require('underscore');
var S = require('string');

// console.log('afinn.words: ', afinn.words)
console.log('afinn.unknown_words: ', afinn.unknown_words);
var phrase = 'beautiful bitch pah pah ppppppp';
console.log('get_text_score(phrase): ', get_text_score(phrase));
var phrase = 'beautiful beautiful  ppppppp';
console.log('get_text_score(phrase): ', get_text_score(phrase));
console.log('afinn.unknown_words: ', afinn.unknown_words);

// console.log('afinn.words: ', afinn.words);
// console.log(get_text_score('ab . adsf. afds QWEvd 3dsd ? 2eeds'));

function get_text_score(text) {
	var punctuationless = text.replace(/[\.,-\/#!$%\^&\*;:{}=\-_`~()]/g, " ");
	// S(text).stripPunctuation().s; //My string full of punct
	var words = punctuationless.toLowerCase().split(' ');
	var sum = 0;
	// var unknown_words = [];
	_.each(words, function(word) {
		if (word in afinn.words) {
			sum += afinn.words[word];
		} else {
			// unknown_words.push(word);
		}
	});
	console.log('SCORE', text, sum);

	/*
	unknown_words = _.uniq(unknown_words);

	_.each(unknown_words, function(unknown_word) {
		// console.log('afinn.unknown_words: ',afinn.unknown_words);
		if (afinn.unknown_words.hasOwnProperty(unknown_word)) {
			console.log('HAS PROPERTY: ', unknown_word);
			afinn.unknown_words[unknown_word].push(sum);
		} else {
			console.log('NO PROPERTY: ', unknown_word);
			afinn.unknown_words[unknown_word] = [sum];
			console.log('unknown_words: ', unknown_words);
		}
	});
	*/
	return sum;
}

function score_is_problematic(score) {
	if (score < -2) {
		return true;
	}
	return false;
}

function get_tweet_score(tweet, scanned_user_screen_name) {
	var score = get_text_score(tweet.text);

	// if (tweet.text.screen_name !== scanned_user_screen_name && score_is_problematic(score)) {
	// score *= tweet.user.followers_count;
	// }

	if (score >= 0) {
		tweet.level = 0;
	} else {
		if (tweet.retweet_count >= 10) {
			score *= 2;
		}
		if (score < -15) {
			score = -15;
		}
		tweet.level = -score / 15;
	}
}

exports.get_tweet_score = get_tweet_score;