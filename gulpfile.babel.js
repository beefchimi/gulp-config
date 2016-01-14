"use strict";

// Environment Setup
// -----------------------------------------------------------------------------
import gulp        from "gulp";
import babelify    from "babelify";
import browserify  from "browserify";
import browsersync from "browser-sync";
import vinylbuffer from "vinyl-buffer";
import vinylsource from "vinyl-source-stream";
import sequence    from "run-sequence";
import pngcrush    from "imagemin-pngcrush";
import plugins     from "gulp-load-plugins";

// initialize constants for convienent prefixes
const BS  = browsersync.create(),
      GLP = plugins();

// source / destination paths
const PATHS = {
  HAML: {
    SRC  : "dev/haml/",
    DEST : "build/"
  },
  STYLES: {
    SRC  : "dev/styles/",
    DEST : "build/assets/css/"
  },
  SCRIPTS: {
    SRC  : "dev/scripts/",
    DEST : "build/assets/js/"
  },
  IMAGES: {
    SRC  : "dev/media/images/*.{png,jpg,gif}",
    DEST : "build/assets/img/"
  },
  AUDIO: {
    SRC  : "dev/media/audio/*.*",
    DEST : "build/assets/aud/"
  },
  VIDEOS: {
    SRC  : "dev/media/videos/*.*",
    DEST : "build/assets/vid/"
  },
  SVG: {
    SRC    : "dev/media/svg/*.svg",
    DEST   : "build/assets/img/svg.svg"
  },
  MISC: {
    ROOT : "dev/extra/root/",
    DEST : "build/"
  },
  FONTS: {
    SRC  : "dev/extra/fonts/*",
    DEST : "build/assets/fonts/"
  }
};

// Compress (if changed) all of our images
// -----------------------------------------------------------------------------
gulp.task("images", () => {
  return gulp.src(PATHS.IMAGES.SRC)
    .pipe(GLP.changed(PATHS.IMAGES.DEST))
    .pipe(GLP.imagemin({
      optimizationLevel: 7,
      progressive: true,
      use: [pngcrush()]
    }))
    .pipe(gulp.dest(PATHS.IMAGES.DEST));
});

// Compress and build SVG sprite (make ready for injection)
// -----------------------------------------------------------------------------
gulp.task("svg", () => {
  return gulp.src(PATHS.SVG.SRC)
    .pipe(GLP.imagemin({
      svgoPlugins: [{
        removeViewBox: false,
        removeUselessStrokeAndFill: false
      }]
    }))
    .pipe(GLP.svgstore({
      inlineSvg: true
    }))
    .pipe(gulp.dest(PATHS.IMAGES.DEST));
});

// Compile and output styles
// -----------------------------------------------------------------------------
gulp.task("styles", () => {
  return gulp.src(`${PATHS.STYLES.SRC}styles.scss`)
    .pipe(GLP.sourcemaps.init())
      .pipe(GLP.sass({
        outputStyle: "compact"
      }).on("error", GLP.sass.logError))
      .pipe(GLP.autoprefixer({
        browsers: ["last 3 version", "ios 6", "android 4"]
      }))
      // UPDATE THIS TO USE CSSNANO INSTEAD
      .pipe(GLP.minifyCss({
        // required to prevent merging selectors to share styles...
        // less efficient output but resolves heirarchy/specificity issues
        advanced: false
      }))
      .pipe(GLP.rename({
        suffix: ".min"
      }))
    .pipe(GLP.sourcemaps.write("../maps"))
    .pipe(gulp.dest(PATHS.STYLES.DEST))
    .pipe(BS.stream({match: "**/*.css"}));
});

// Compile only main HAML files (ignore partials - included via the main files), then inject SVG sprite
// -----------------------------------------------------------------------------
gulp.task("haml", () => {
  // would be ideal to only inject / compile changed files
  var srcSVG = gulp.src(PATHS.SVG.DEST);
  function fileContents(filePath, file) {
    return file.contents.toString();
  }
  return gulp.src(PATHS.HAML.SRC + "*.haml")
    .pipe(GLP.rubyHaml())
    .pipe(GLP.inject(srcSVG, {
      transform: fileContents
    }))
    .pipe(gulp.dest(PATHS.HAML.DEST));
});

// Watch over HAML files and reload the browser upon compilation
// this can be refactored in gulp v4
// -----------------------------------------------------------------------------
gulp.task("watch-haml", ["haml"], () => {
  // recommended method only works once:
  // gulp.task("watch-haml", ["haml"], BS.reload);
  BS.reload();
});

// Copy (if changed) all of our fonts to build/assets/fonts
// -----------------------------------------------------------------------------
gulp.task("fonts", () => {
  return gulp.src(PATHS.FONTS.SRC)
    .pipe(GLP.changed(PATHS.FONTS.DEST))
    .pipe(gulp.dest(PATHS.FONTS.DEST));
});

// Copy (if changed) all of our audio to build/assets/aud
// -----------------------------------------------------------------------------
gulp.task("audio", () => {
  return gulp.src(PATHS.AUDIO.SRC)
    .pipe(GLP.changed(PATHS.AUDIO.DEST))
    .pipe(gulp.dest(PATHS.AUDIO.DEST));
});

// Copy (if changed) all of our videos to build/assets/vid
// -----------------------------------------------------------------------------
gulp.task("videos", () => {
  return gulp.src(PATHS.VIDEOS.SRC)
    .pipe(GLP.changed(PATHS.VIDEOS.DEST))
    .pipe(gulp.dest(PATHS.VIDEOS.DEST));
});

// Copy (if changed) all of our miscellaneous files to the build folder
// -----------------------------------------------------------------------------
gulp.task("misc", ["fonts", "audio", "videos"], () => {
  return gulp.src([`${PATHS.MISC.ROOT}*`, `${PATHS.MISC.ROOT}.htaccess`])
    .pipe(GLP.changed(PATHS.MISC.DEST))
    .pipe(gulp.dest(PATHS.MISC.DEST));
});

// Compile ES2015 javascript
// -----------------------------------------------------------------------------
gulp.task("scripts", () => {
/*
  // this will run once because we set watch to false
  return buildScript("scripts.js", false);
*/
  console.log("Scripts have been disabled for now");
});

// Watch over Javascript files and reload the browser upon compilation
// this can be refactored in gulp v4
// -----------------------------------------------------------------------------
gulp.task("watch-scripts", ["scripts"], () => {
  // recommended method only works once:
  // gulp.task("watch-scripts", ["scripts"], BS.reload);
  BS.reload();
});

// Error handling
// -----------------------------------------------------------------------------
function handleErrors() {
  var args = Array.prototype.slice.call(arguments);
  GLP.notify.onError({
    title: "Compile Error",
    message: "<%= error.message %>"
  }).apply(this, args);
  // keep gulp from hanging on this task
  this.emit("end");
}

// Javascript building
// -----------------------------------------------------------------------------
function buildScript(file, watch) {

  var props = {
    entries: `${PATHS.SCRIPTS.SRC}${file}`,
    debug: true,
    cache: {},
    packageCache: {},
    transform: [babelify.configure({ presets: ["es2015", "stage-0"] })]
  };

  // watchify() if watch requested, otherwise run browserify() once
  var bundler = watch ? watchify(browserify(props), {poll:true}) : browserify(props);

  function rebundle() {
    var stream = bundler.bundle();
    return stream
      .on("error", handleErrors)
      .pipe(vinylsource(file))
      .pipe(vinylbuffer())
      .pipe(GLP.sourcemaps.init({loadMaps:true}))
        .pipe(GLP.uglify()) // Sourcemaps: FF doesn't play nice, but Chrome is fine
        // .pipe(GLP.streamify(GLP.uglify()).on('error', GLP.util.log))
        .pipe(GLP.rename({
          suffix: ".min"
        }))
      .pipe(GLP.sourcemaps.write("../maps"))
      .pipe(gulp.dest(PATHS.SCRIPTS.DEST));
  }

  // listen for an update and run rebundle
  bundler.on("update", () => {
    rebundle();
    GLP.util.log("Rebundle...");
  });

  // run it once the first time buildScript is called
  return rebundle();

}

// Spin up a Browser Sync server in our build folder and watch dev files
// -----------------------------------------------------------------------------
gulp.task("watch", () => {
  // configure browserSync
  BS.init({
    open: false,
    server: "build",
    ghostMode: {
      clicks: false,
      forms: false,
      scroll: false
    }
  });
  // inject updated styles into browser
  gulp.watch(`${PATHS.STYLES.SRC}*.scss`, ["styles"]);
  // reload browser on .js changes
  gulp.watch(`${PATHS.SCRIPTS.SRC}**/*.js`, ["watch-scripts"]);
  // reload browser on .html changes (multiple files, so wait until all have been compiled)
  gulp.watch(`${PATHS.HAML.SRC}**/*.haml`, ["watch-haml"]);
});

// Default gulp task
// -----------------------------------------------------------------------------
gulp.task("default", () => {
  // consider deleting all files first using npm del
  sequence("svg", ["styles", "scripts", "misc", "haml"], "watch"); // removed "images" task as it takes LONG
});
