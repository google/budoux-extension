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

const log = console.log;

function throwMissingArg(name: string): never {
  throw new Error(`Missing ${name}`);
}

class ChromeExtensionPackage {
  async run() {
    const program = new Command();
    program.option('-d, --dir <dir>', 'unpacked extension directory', 'dist');
    program.option('-z, --zip <zip>', 'ZIP file name', 'budoux.zip');
    program.parse(process.argv);
    const options = program.opts();
    const zip_path = options.zip ?? throwMissingArg('ZIP file name');
    const src_dir = options.dir ?? throwMissingArg('extension directory');
    await this.zip(src_dir, zip_path);
  }

  async zip(src_dir: string, zip_path: string) {
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
