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

import { sep } from 'path';
import {DocumentApplier} from '../src/document_applier';

const documentFromString = (html: string) => {
  return new DOMParser().parseFromString(html, 'text/html');
};

describe('DocumentApplier.fromDocument', () => {
  it('should get the same instance', () => {
    const doc = documentFromString('<html lang="ja"></html>');
    const applier = DocumentApplier.fromDocument(doc);
    expect(DocumentApplier.fromDocument(doc)).toEqual(applier);
  });

  it('should add a style element', async () => {
    const doc = documentFromString('<html lang="ja"></html>');
    const applier = DocumentApplier.fromDocument(doc);
    await applier.apply();
    const elements = doc.getElementsByTagName('style');
    expect(elements.length).toEqual(1);
    const element = elements[0];
    expect(element.textContent).toMatch(/^\.BudouX {.*}$/);
  });
});

describe('DocumentApplier.apply', () => {
  it('should apply', async () => {
    const doc = documentFromString(
      '<html lang="ja"><div>今日は良い天気です。</div></html>'
    );
    const applier = DocumentApplier.fromDocument(doc);
    await applier.apply();
    expect(doc.body.innerHTML).toEqual(
      '<div class="BudouX">今日は\u200B良い\u200B天気です。</div>'
    );
  });

  for (const separator of [' ', '|']) {
    it(`Use the customized separator "${separator}"`, async () => {
      const doc = documentFromString(
        '<html lang="ja"><div>今日は良い天気です。</div></html>'
      );
      class CustomSeparatedApplier extends DocumentApplier {
        async loadSettings() {
          this.separator = separator;
        }
      }
      const applier = new CustomSeparatedApplier(doc);
      await applier.apply();
      expect(doc.body.innerHTML).toEqual(
        `<div class="BudouX">今日は${separator}良い${separator}天気です。</div>`
      );
    });
  }
});

describe('DocumentApplier.normalizeLocale', () => {
  [
    [undefined, undefined],
    ['', undefined],
    // `ja` doesn't require the script.
    ['ja', 'ja'],
    ['ja-JP', 'ja'],
    // `zh` requires the script.
    ['zh', 'zh-hans'],
    ['zh-Hans', 'zh-hans'],
    ['zh-Hant', 'zh-hant'],
    // Check upper/lower cases.
    ['JA', 'ja'],
    ['ZH', 'zh-hans'],
    ['zh-hant', 'zh-hant'],
    ['zh-HanT', 'zh-hant'],
    // Check if the script matches the whole string, not substring.
    ['zh-zHant', 'zh-hans'],
    ['zh-Hantz', 'zh-hans'],
    // The default script from the region.
    ['zh-CN', 'zh-hans'],
    ['zh-HK', 'zh-hant'],
    ['zh-MO', 'zh-hant'],
    ['zh-TW', 'zh-hant'],
    ['zh-tw', 'zh-hant'],
    ['ZH-tw', 'zh-hant'],
    // Check if the region matches the whole string, not substring.
    ['zh-ztw', 'zh-hans'],
    ['zh-twz', 'zh-hans'],
    // If the script is given, the region should be ignored.
    ['zh-hant-CN', 'zh-hant'],
    ['zh-CN-hant', 'zh-hant'],
  ].forEach(args => {
    const [input, expected] = args;
    it(`Locale "${input}" should be normalized to "${expected}"`, () => {
      const result = DocumentApplier.normalizeLocale(input);
      expect(result).toEqual(expected);
    });
  });
});

describe('DocumentApplier.langFromElement', () => {
  [
    ['<html lang="ja"></html>', 'ja'],
    ['<html lang="ja"><body lang="zh"></body></html>', 'zh'],
  ].forEach(args => {
    const [html, expected] = args;
    it(`HTML "${html}" should have lang "${expected}"`, () => {
      const doc = documentFromString(html);
      const element = doc.body ?? doc.documentElement;
      expect(DocumentApplier.langFromElement(element)).toEqual(expected);
    });
  });
});
