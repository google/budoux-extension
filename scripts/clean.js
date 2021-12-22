/**
 * @license
 * Copyright 2021 Google LLC
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

const fs = require('fs');
const glob = require('glob');

const dirs = ['build', 'dist'];
const patterns = ['*.crx', '*.zip', '**/Icon[\r]*', '**/desktop.ini'];

function logRemoving(file) {
  console.log(`Removing ${file} ...`);
}

function isDirectoryExists(dir) {
  try {
    return fs.statSync(dir).isDirectory();
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

for (const dir of dirs) {
  if (isDirectoryExists(dir)) {
    logRemoving(dir);
    (fs.rmSync || fs.rmdirSync)(dir, {recursive: true});
  }
}

for (const pattern of patterns) {
  glob(pattern, (err, files) => {
    if (err) throw err;
    for (const file of files) {
      logRemoving(file);
      fs.unlinkSync(file);
    }
  });
}
