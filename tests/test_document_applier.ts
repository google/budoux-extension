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

import {DocumentApplier} from '../src/document_applier';

const documentFromString = (html: string) => {
  return new DOMParser().parseFromString(html, 'text/html');
};

describe('DocumentApplier.fromDocument', () => {
  it('should get the same instance', () => {
    const doc = documentFromString('');
    const applier = DocumentApplier.fromDocument(doc);
    expect(DocumentApplier.fromDocument(doc)).toEqual(applier);
  });

  it('should add a style element', () => {
    const doc = documentFromString('');
    DocumentApplier.fromDocument(doc);
    const elements = doc.getElementsByTagName('style');
    expect(elements.length).toEqual(1);
    const element = elements[0];
    expect(element.textContent).toMatch(/^\.BudouX {.*}$/);
  });
});
