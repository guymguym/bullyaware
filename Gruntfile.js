var http = require('http');
var fs = require('fs');

module.exports = function(grunt) {

	// Default tasks
	grunt.registerTask('default', [
		'bower',
		'jshint'
		// 'concat',
		// 'uglify'
	]);

	grunt.registerTask('nodeunit', [
		'nodeunit'
	]);


	// Project configuration.
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		bower: {
			install: true
		},
		jshint: {
			files: [
				'Gruntfile.js',
				'web/**/*.js'
			],
			options: {
				ignores: ['web/public/js/d3.v3.min.js']
			}
		},
	});

	// Load the plugins
	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-contrib-concat');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-nodeunit');


	// Define custom tasks
	grunt.task.registerMultiTask('bower', 'Bower', function() {
		// Force task into async mode and grab a handle to the "done" function.
		var done = this.async();
		grunt.util.spawn({
			cmd: './node_modules/.bin/bower',
			args: [this.target]
		}, done);
	});
};