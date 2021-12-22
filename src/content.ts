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

import {loadDefaultJapaneseParser} from 'budoux';
import {DomApplier} from './dom_applier';

// eslint-disable-next-line  @typescript-eslint/no-explicit-any
let logger: (...data: any[]) => void;
// logger = console.log;

// eslint-disable-next-line  @typescript-eslint/no-explicit-any
function logDebug(...args: any[]) {
  if (logger) logger(...args);
}

class DocumentApplier {
  static fromDocument(document: Document) {
    // @ts-expect-error Use a dynamic property of the document.
    let docApplier = document.budouX;
    logDebug('fromDocument: ', docApplier);
    if (!docApplier) {
      docApplier = new DocumentApplier();
      // @ts-expect-error Use a dynamic property of the document.
      document.budouX = docApplier;

      const style = document.createElement('style');
      style.textContent =
        '.budouX { word-break: keep-all; overflow-wrap: break-word; }';
      document.head.appendChild(style);
    }
    return docApplier;
  }

  async applyToDocument() {
    const parser = loadDefaultJapaneseParser();
    const domApplier = new DomApplier(parser);
    domApplier.className = 'budouX';

    if ('chrome' in window && 'storage' in chrome) {
      await new Promise<void>(resolve => {
        chrome.storage.sync.get(
          {
            separator: '\u200B',
          },
          items => {
            domApplier.separator = items.separator;
            resolve();
          }
        );
      });
    }

    await this.waitForDOMContentLoaded(document);

    domApplier.applyToElement(document.body);
  }

  async waitForDOMContentLoaded(document: Document) {
    logDebug('waitForDOMContentLoaded: ', document.readyState);
    if (document.readyState !== 'loading') return;
    await new Promise<void>(resolve => {
      document.addEventListener('DOMContentLoaded', () => resolve());
    });
    logDebug('DOMContentLoaded: ', document.readyState);
  }
}

DocumentApplier.fromDocument(document).applyToDocument();
