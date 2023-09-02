/* eslint-disable prettier/prettier */
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

import * as archiver from 'archiver';
import {Command} from 'commander';
import * as fs from 'fs';
const {glob} = require('glob');
import * as path from 'path';

const log = console.log;

function throwMissingArg(name: string): never {
  throw new Error(`Missing ${name}`);
}

class ChromeExtensionPackage {
  async run() {
    const program = new Command();
    program.option('-d, --dir <dir>', 'unpacked extension directory');
    program.option('-j --js <dir>', 'JavaScript directory');
    program.option('-z, --zip <zip>', 'ZIP file name');
    program.parse(process.argv);
    const options = program.opts();
    const dist_dir = options.dir ?? throwMissingArg('extension directory');
    const js_dir = options.js;
    if (js_dir) {
      await this.copy(js_dir, dist_dir);
    }
    const zip_path = options.zip;
    if (zip_path) {
      await this.zip(dist_dir, zip_path);
    }
  }

  async copy(js_dir: string, dist_dir: string) {
    if (!fs.existsSync(dist_dir)) {
      await fs.promises.mkdir(dist_dir, {recursive: true});
    }
    // Bundles are copied from `js_dir` to the root of `dist_dir`.
    const bundles = ['background.js', 'content.js', 'options.js']
      .map(name => [path.join(js_dir, name), name]);
    // Resources are copied to the root of `dist_dir`.
    const resources = [
      'manifest.json',
      'src/options.html',
      'docs/icon128.png',
    ].map(name => [name, path.basename(name)]);
    // Locales are copied to the `dist_dir` keeping the tree structure.
    const locales: string[][] = (await glob('_locales/**/*.json'))
      .map((name: string) => [name, name]);
    const files = [...bundles, ...resources, ...locales]
      .map(([src, dest]) => [src, path.join(dist_dir, dest)]);
    for (const [, dest] of files) {
      const dir = path.dirname(dest);
      if (!fs.existsSync(dir)) await fs.promises.mkdir(dir, {recursive: true});
    }
    await Promise.all(
      files.map(([src, dest]) => {
        log(`Copying ${src} -> ${dest}`);
        return fs.promises.copyFile(src, dest);
      })
    );
  }

  async zip(src_dir: string, zip_path: string) {
    if (!fs.existsSync(src_dir)) {
      throw new Error(`Directory not found: ${src_dir}`);
    }
    const output = fs.createWriteStream(zip_path);
    const closed_or_ended = new Promise<void>(resolve => {
      output.on('close', resolve);
      output.on('end', resolve);
    });
    const archive = archiver('zip', {
      zlib: {level: 9},
    });
    archive.pipe(output);
    archive.directory(src_dir, false);
    await Promise.all([archive.finalize(), closed_or_ended]);
    log(`${zip_path}: ${archive.pointer()} bytes`);
  }
}

new ChromeExtensionPackage().run();
