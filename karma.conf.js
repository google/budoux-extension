/**
 * @license
 * Copyright 2023 Google LLC
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const webpackConfig = require('./webpack.config');

module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', 'webpack'],
    files: ['tests/**/test_*.ts'],
    preprocessors: {
      'tests/**/test_*.ts': ['webpack'],
    },
    reporters: ['progress'],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: true,
    browsers: ['ChromeHeadless'],
    singleRun: false,
    concurrency: Infinity,
    webpack: {
      module: webpackConfig.module,
      resolve: webpackConfig.resolve,
    },
  });
};
