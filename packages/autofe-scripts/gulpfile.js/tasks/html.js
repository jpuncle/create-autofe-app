'use strict';

const gulp = require('gulp');
const config = require('../config');
const browserSync = require('../lib/browserSync');
// const render = require('gulp-nunjucks-render');
const render = require('../lib/nunjucks-render');
const data = require('gulp-data');
const path = require('path');
const PluginError = require('plugin-error');

const isProd = process.env.NODE_ENV === 'production';

const isRelative = function (url) {
  if (url.indexOf('./') == 0 || url.indexOf('../') === 0) {
    return true;
  }
  return false;
}

const manageEnvironment = function (env) {
  // IncludePrettyExtension
  function IncludePrettyExtension() {
    const tagName = 'includePretty';

    this.realpath = [];
    this.tags = [tagName];
    this.parse = function (parse, nodes) {
      const tag = parse.peekToken();
      if (!parse.skipSymbol(tagName)) {
        parse.fail(`parseTemplateRef: expected ${tagName}`);
      }

      let indent = 0;
      const colno = tag.colno;
      // 回到行首
      parse.tokens.backN(colno + tagName.length);
      // 找到该行第一个字符的索引
      try {
        let str = parse.tokens.currentStr();
        for (; indent < colno; indent++) {
          if (str.charAt(indent) !== ' ') {
            break;
          }
        }
      } catch (e) {
        // 假定开头内容为 {% includePretty
        indent = colno - 3;
      }
      // 回到原位置
      parse.tokens.forwardN(colno + tagName.length);

      const args = parse.parseSignature(null, true);

      // var node = new nodes.Include(tag.lineno, tag.colno);
      // node.template = parse.parseExpression();

      parse.advanceAfterBlockEnd(tag.value);

      const indentValue = new nodes.Output(0, 0, [new nodes.TemplateData(0, 0, indent)]);

      const node = new nodes.CallExtension(this, 'run', args, [indentValue]);

      return node;
    };
    this.run = function (context, url, indentValue) {
      let output = '';
      const indentWidth = indentValue();
      const indentFilter = env.getFilter('indent');
      const trimFilter = env.getFilter('trim');
      const safeFilter = env.getFilter('safe');

      var realpath = this.realpath[0] || context.ctx.__ctx_file.path;

      if (isRelative(url)) {
        this.realpath.unshift(path.resolve(path.dirname(realpath), url));
      } else {
        this.realpath.unshift(path.resolve(config.src, url));
      }

      try {
        const tmpl = env.getTemplate(url, false, realpath);
        let result = tmpl.render(context.getVariables());
        if (indentWidth > 0) {
          result = indentFilter(result, indentWidth);
        }
        result = trimFilter(result);
        output = result;
      } catch (e) {
        throw e;
      }

      this.realpath.shift();

      return safeFilter(output);
    };
  }
  env.addExtension('IncludePrettyExtension', new IncludePrettyExtension());

  // Filter: assets
  env.addFilter('assets', function (assetpath) {
    const url = path.join(this.ctx.__ctx_file.prefix || '', assetpath);
    return url;
  });
};

const options = {
  path: [config.src],
  manageEnv: manageEnvironment,
};

const htmlTask = function () {
  return gulp.src([config.html.src, config.html.exclude])
    .pipe(data((file) => {
      const obj = {
        path: file.path,
        relative: file.relative,
        base: file.base,
        prefix: path.relative(path.resolve(file.path, '..'), file.base),
      };
      return {
        __ctx_file: obj,
      };
    }))
    .pipe(render(options))
    .on('error', function (error) {
      const message = new PluginError('nunjucks', error).toString();
      process.stderr.write(`${message}\n`);

      if (isProd) {
        process.exit(1);
      } else {
        this.emit('end');
      }
    })
    .pipe(gulp.dest(config.html.dest))
    .on('end', browserSync.reload);
};

gulp.task('html', htmlTask);
module.exports = htmlTask;
