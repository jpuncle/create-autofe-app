const fs = require('fs-extra');
const paths = require('./paths');

const config = {
  externals: {},
};

const configExists = fs.pathExistsSync(paths.appConfig);
if (configExists) {
  Object.assign(config, require(paths.appConfig));
}

module.exports = config;