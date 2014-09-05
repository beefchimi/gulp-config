/* Variables / Environment Setup
---------------------------------------------------------------------------- */

// source / destination paths
var paths = {

	haml: {
		src: 'dev/haml/',
		dest: '/'
	},
	styles: {
		src: 'dev/styles/',
		dest: 'assets/'
	},
	scripts: {
		src: 'dev/scripts/*.js',
		dest: 'assets/'
	},
	images: {
		src: 'dev/media/images/*.{png,jpg,gif}',
		dest: 'assets/media/'
	},
	svg: {
		src: 'dev/media/svg/*.svg',
		dest: 'assets/media/'
	}

};

// gulp requires
var gulp       = require('gulp'),
	gutil      = require('gulp-util'),
	livereload = require('gulp-livereload'),
	pngcrush   = require('imagemin-pngcrush'),
	plugins    = require('gulp-load-plugins')({
		pattern: ['gulp-*', 'gulp.*'],
		replaceString: /\bgulp[\-.]/
	});


// run "gulp *task* --dev" for more verbose output
var isProduction = true,
	sassStyle    = 'compressed',
	sourceMap    = false;

if (gutil.env.dev === true) {
	isProduction = false;
	sassStyle    = 'expanded';
	sourceMap    = true;
}


// gulp utility output
var changeEvent = function(evt) {
	gutil.log('File', gutil.colors.cyan(evt.path.replace(new RegExp('/.*(?=/' + paths.src + ')/'), '')), 'was', gutil.colors.magenta(evt.type));
};


/* Gulp Tasks
---------------------------------------------------------------------------- */

// Delete all build files
gulp.task('rimraf', function() {
	return gulp.src(['assets/', 'index.html'], { read: false })
		.pipe(plugins.rimraf());
});


// Compile Haml with double quotes
gulp.task('haml', function() {

	gulp.src(paths.haml.src + 'main.html.haml') // , {read: false}
		.pipe(plugins.rubyHaml()) // {doubleQuote: true}
		.pipe(plugins.rename('index.html'))
		.pipe(gulp.dest('./'));

});


// Compile and Output Styles
gulp.task('styles', function() {

	gulp.src(paths.styles.src + 'styles.scss')
		.pipe(plugins.rubySass({
			style: sassStyle,
			sourcemap: sourceMap,
			precision: 2
		}))
		.pipe(plugins.concat('styles.css'))
		.pipe(plugins.autoprefixer('last 2 version'))
		.pipe(isProduction ? plugins.minifyCss() : gutil.noop())
		.pipe(gulp.dest(paths.styles.dest));

});


// Concat and Output Scripts
gulp.task('scripts', function() {

	gulp.src(paths.scripts.src)
		.pipe(plugins.concat('scripts.js'))
		// .pipe(plugins.jshint())
		// .pipe(plugins.jshint.reporter('default'))
		.pipe(isProduction ? plugins.uglify() : gutil.noop())
		.pipe(gulp.dest(paths.scripts.dest));

});


// Check for changed image files and compress them
gulp.task('images', function() {
	return gulp.src(paths.images.src)
		.pipe(plugins.changed(paths.images.dest))
		.pipe(plugins.imagemin({
			progressive: true,
			use: [pngcrush()]
		}))
		.pipe(gulp.dest(paths.images.dest));
});


// Compress all svg files, combine them into a single file, inject contents into index.html
// need to manually run each time haml file is updated until a sequence gets added to gulp
gulp.task('svg', function() {

	var svgOutput = gulp.src(paths.svg.src)
						.pipe(plugins.imagemin({
							svgoPlugins: [{
								removeViewBox: false,
								removeUselessStrokeAndFill: false
							}]
						}))
						.pipe(plugins.svgstore({
							// prefix: 'icon-',
							inlineSvg: true,
							transformSvg: function(svg, cb) {
								svg.attr({ style: 'display:none' });
								cb(null);
							}
						}));

	function fileContents(filePath, file) {
		return file.contents.toString('utf8');
	}

	return gulp.src('index.html')
				.pipe(plugins.inject(svgOutput, { transform: fileContents }))
				.pipe(gulp.dest('./'))

});


/*
gulp.task('deploy', function() {
	gulp.src('./')
		.pipe(rsync({
			root: 'build',
			hostname: 'example.com',
			destination: '/path/to/site'
		});
});
*/


// Watch over specified files and run corresponding tasks
gulp.task('watch', ['haml', 'styles', 'scripts'], function() {

	livereload.listen();

	gulp.watch(paths.haml.src + '*.haml', ['haml']).on('change', livereload.changed);

	gulp.watch(paths.styles.src + '*.scss', ['styles']).on('change', livereload.changed);

	gulp.watch(paths.scripts.src, ['scripts']).on('change', livereload.changed);

});


// Default gulp task
gulp.task('default', ['haml', 'styles', 'scripts']);