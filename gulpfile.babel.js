import autoprefixer from "autoprefixer";
import browserSync from "browser-sync";
import { spawn } from "child_process";
import cssnano from "cssnano";
import { dest, series, src, task, watch} from "gulp";
import gulpif from "gulp-if";
import postcss from "gulp-postcss";
import purgecss from "gulp-purgecss";
import rename from "gulp-rename";
import sourcemaps from "gulp-sourcemaps";
import atimport from "postcss-import";
import tailwindcss from "tailwindcss";
import precss from "precss";
import colorFunction from "postcss-color-function";
import cssvariables from "postcss-css-variables";




const rawStylesheet = "src/**/*.pcss";
const siteRoot = "_site";
const vendor  = `${siteRoot}/vendor/`;
const assets  = `${siteRoot}/assets/`;
const tailwindConfig = "tailwind.config.js";

const devBuild =
  (process.env.NODE_ENV || "development").trim().toLowerCase() ===
  "development";

// Fix for Windows compatibility
const jekyll = process.platform === "win32" ? "jekyll.bat" : "jekyll";

// Custom PurgeCSS Extractor
// https://github.com/FullHuman/purgecss
class TailwindExtractor {
  static extract(content) {
    return content.match(/[A-z0-9-:\/]+/g) || [];
  }
}

task("copyVendor", () => {
  return src('src/vendor/*')
    .pipe(dest(vendor));
});
task("copyAssets", () => {
  return src('src/assets/**/*')
    .pipe(dest(assets));
});

task("buildJekyll", () => {
  browserSync.notify("Building Jekyll site...");

  const args = ["exec", jekyll, "build"];

  if (devBuild) {
    args.push("--incremental");
    args.push("--trace");
  }

  return spawn("bundle", args, { stdio: "inherit" });
});

task("processStyles", done => {
  browserSync.notify("Compiling styles...");

  return src(rawStylesheet)
    .pipe(postcss([atimport(), cssvariables(), tailwindcss(tailwindConfig), colorFunction(), precss()]))
    .pipe(gulpif(devBuild, sourcemaps.init()))
    .pipe(gulpif(!devBuild, postcss([autoprefixer(), cssnano({
        discardComments: {removeAll: true}
      }
    )])))
    .pipe(
      // gulpif(
      //   !devBuild,
        new purgecss({
          content: ["_site/**/*.html"],
          extractors: [
            {
              extractor: TailwindExtractor,
              extensions: ["html", "js"]
            }
          ]
        })
      // )
    )
    .pipe(gulpif(devBuild, sourcemaps.write("")))
    .pipe(rename(function(path) {
      path.extname = ".css";
    }))
    .pipe(dest(assets));
});

task("startServer", () => {
  browserSync.init({
    files: [siteRoot + "/**"],
    open: "local",
    port: 4000,
    server: {
      baseDir: siteRoot,
      serveStaticOptions: {
        extensions: ["html"]
      }
    }
  });

  watch(
    [
      "**/*.css",
      "**/*.pcss",
      "**/*.html",
      "**/*.hbs",
      "**/*.js",
      "**/*.md",
      "**/*.markdown",
      "!_site/**/*",
      "!node_modules/**/*"
    ],
    { interval: 500 },
    buildSite
  );
});

const buildSite = series("buildJekyll", "processStyles", "copyVendor", "copyAssets");

exports.serve = series(buildSite, "startServer");
exports.default = series(buildSite);
