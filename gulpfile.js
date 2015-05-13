var gulp = require('gulp');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var wrap = require('gulp-wrap-umd');
var runSequence = require('run-sequence');

gulp.task('scripts', function () {
    return gulp.src(['src/router.js'])
        .pipe(concat('router.js'))
        .pipe(wrap({namespace: 'Router', exports: 'Router'}))
        .pipe(gulp.dest('./bin'));
});

gulp.task('compress', function () {
    return gulp.src('./bin/router.js')
        .pipe(concat('router.min.js'))
        .pipe(uglify())
        .pipe(gulp.dest('./bin'));
});

gulp.task('default', function () {
    runSequence('scripts', 'compress');
});