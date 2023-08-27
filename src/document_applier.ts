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

import {
  loadDefaultJapaneseParser,
  loadDefaultParsers,
  HTMLProcessor,
  Parser,
} from 'budoux';

// eslint-disable-next-line  @typescript-eslint/no-explicit-any
let logger: (...data: any[]) => void;
// logger = console.log;

// eslint-disable-next-line  @typescript-eslint/no-explicit-any
function logDebug(...args: any[]) {
  if (logger) logger(...args);
}

const className = 'BudouX';

export class DocumentApplier {
  private document: Document;

  constructor(document: Document) {
    this.document = document;
  }

  static fromDocument(document: Document): DocumentApplier {
    // @ts-expect-error Use a dynamic property of the document.
    let docApplier = document.budouX;
    logDebug('fromDocument: ', docApplier);
    if (!docApplier) {
      docApplier = new DocumentApplier(document);
      // @ts-expect-error Use a dynamic property of the document.
      document.budouX = docApplier;
      docApplier.defineClassAs(className);
    }
    return docApplier;
  }

  /**
   * Append a `<style>` element that defines the default styles as a class.
   * @param document The document to append to.
   * @param className The CSS class name.
   */
  private defineClassAs(className: string): void {
    const document = this.document;
    const style = document.createElement('style');
    style.textContent = `.${className} { word-break: keep-all; overflow-wrap: anywhere; }`;
    document.head.appendChild(style);
  }

  async apply() {
    const parser = this.loadParser();
    const applier = new HTMLProcessor(parser);
    applier.className = className;

    if ('chrome' in window && 'storage' in chrome) {
      await new Promise<void>(resolve => {
        chrome.storage.sync.get(
          {
            separator: '\u200B',
          },
          items => {
            applier.separator = items.separator;
            resolve();
          }
        );
      });
    }

    const document = this.document;
    await this.waitForDOMContentLoaded(document);

    applier.applyToElement(document.body);
  }

  private loadParser(): Parser {
    const document = this.document;
    const element = document.body ?? document.documentElement;
    let lang = DocumentApplier.langFromElement(element);
    lang = DocumentApplier.normalizeLocale(lang);
    if (lang) {
      const parsers = loadDefaultParsers();
      const parser = parsers.get(lang);
      if (parser) return parser;
    }
    console.warn(`No parser for "${lang}", using the Japanese parser.`);
    return loadDefaultJapaneseParser();
  }

  static normalizeLocale(locale?: string): string | undefined {
    if (!locale) return undefined;
    let subtags = locale.split('-');
    if (!subtags.length) return undefined;
    const lang = subtags[0];
    if (lang === 'zh') {
      // `zh` requires the script subtag.
      subtags = subtags.slice(1);
      for (const subtag of subtags) {
        if (subtag.match(/^han[st]$/i))
          return `${lang}-${subtag.toLowerCase()}`;
      }
      // If neither `hans` nor `hant`, check the region or the macrolanguage.
      for (const subtag of subtags) {
        if (subtag.match(/^(hk|mo|tw|hak|lzh|nan|yue)$/i)) return 'zh-hant';
      }
      return 'zh-hans';
    }
    return lang;
  }

  static langFromElement(element: HTMLElement | null): string | undefined {
    for (; element; element = element.parentElement) {
      const lang = element.lang;
      if (lang) return lang;
    }
    return undefined;
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
