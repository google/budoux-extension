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

import {Parser} from 'budoux';

const assert = console.assert;

const ZWSP = '\u200B'; // U+200B ZERO WIDTH SPACE

// Same as `Node.*`. Use our own definitions for node.js/jsdom.
const NodeType = {
  ELEMENT_NODE: 1,
  TEXT_NODE: 3,
};

const DomAction = {
  Inline: 0,
  Block: 1,
  Skip: 2,
  Break: 3,
} as const;
type DomAction = typeof DomAction[keyof typeof DomAction];

// Determines the action from the element name.
// See also `actionForElement()`.
// https://html.spec.whatwg.org/multipage/rendering.html
const domActions: {[name: string]: DomAction} = {
  // Hidden elements
  // https://html.spec.whatwg.org/multipage/rendering.html#hidden-elements
  AREA: DomAction.Skip,
  BASE: DomAction.Skip,
  BASEFONT: DomAction.Skip,
  DATALIST: DomAction.Skip,
  HEAD: DomAction.Skip,
  LINK: DomAction.Skip,
  META: DomAction.Skip,
  NOEMBED: DomAction.Skip,
  NOFRAMES: DomAction.Skip,
  PARAM: DomAction.Skip,
  RP: DomAction.Skip,
  SCRIPT: DomAction.Skip,
  STYLE: DomAction.Skip,
  TEMPLATE: DomAction.Skip,
  TITLE: DomAction.Skip,
  NOSCRIPT: DomAction.Skip,

  // Flow content
  // https://html.spec.whatwg.org/multipage/rendering.html#flow-content-3
  HR: DomAction.Break,
  // Disable if `white-space: pre`.
  LISTING: DomAction.Skip,
  PLAINTEXT: DomAction.Skip,
  PRE: DomAction.Skip,
  XMP: DomAction.Skip,

  // Phrasing content
  // https://html.spec.whatwg.org/multipage/rendering.html#phrasing-content-3
  BR: DomAction.Break,
  RT: DomAction.Skip,

  // Form controls
  // https://html.spec.whatwg.org/multipage/rendering.html#form-controls
  INPUT: DomAction.Skip,
  SELECT: DomAction.Skip,
  BUTTON: DomAction.Skip,
  TEXTAREA: DomAction.Skip,

  // Other elements where the phrase-based line breaking should be disabled.
  // https://github.com/google/budoux/blob/main/budoux/skip_nodes.json
  ABBR: DomAction.Skip,
  CODE: DomAction.Skip,
  IFRAME: DomAction.Skip,
  TIME: DomAction.Skip,
  VAR: DomAction.Skip,
};

// Determine the action for an element.
function actionForElement(element: Element) {
  const action = domActions[element.nodeName];
  if (action !== undefined) return action;

  const style = getComputedStyle(element);
  switch (style.whiteSpace) {
    case 'nowrap':
    case 'pre':
      return DomAction.Skip;
  }

  const display = style.display;
  assert(display);
  if (display === 'inline') return DomAction.Inline;
  return DomAction.Block;
}

class DomBlockContext {
  element: HTMLElement;
  textNodes: Text[] = [];

  constructor(element: HTMLElement) {
    this.element = element;
  }

  hasText() {
    return this.textNodes.length > 0;
  }
}

export class DomApplier {
  private parser_: Parser;
  separator: string = ZWSP;
  className?: string;

  constructor(parser: Parser) {
    this.parser_ = parser;
  }

  applyToElement(element: HTMLElement) {
    for (const block of this.getBlocks(element)) {
      assert(block.hasText());
      this.applyToBlockContext(block.element, block.textNodes);
    }
  }

  *getBlocks(
    element: HTMLElement,
    parentBlock?: DomBlockContext
  ): IterableIterator<DomBlockContext> {
    assert(element.nodeType === NodeType.ELEMENT_NODE);

    // Skip if it was once applied to this element.
    if (this.className && element.classList.contains(this.className)) return;

    const action = actionForElement(element);
    if (action === DomAction.Skip) return;

    if (action === DomAction.Break) {
      if (parentBlock && parentBlock.hasText()) {
        yield parentBlock;
        parentBlock.textNodes = [];
      }
      assert(!element.firstChild);
      return;
    }

    // Determine if this element creates a new inline formatting context, or if
    // this element belongs to the parent inline formatting context.
    const isNewBlock = !parentBlock || action === DomAction.Block;
    const block = isNewBlock ? new DomBlockContext(element) : parentBlock;
    assert(block);

    // Collect all text nodes in this inline formatting context, while searching
    // descendant elements recursively.
    for (const child of element.childNodes) {
      switch (child.nodeType) {
        case NodeType.ELEMENT_NODE:
          for (const childBlock of this.getBlocks(child as HTMLElement, block))
            yield childBlock;
          break;
        case NodeType.TEXT_NODE:
          block.textNodes.push(child as Text);
          break;
      }
    }

    // Apply if this is an inline formatting context.
    if (isNewBlock && block.hasText()) yield block;
  }

  applyToBlockContext(element: HTMLElement, textNodes: Text[]) {
    assert(textNodes.length > 0);
    const texts = textNodes.map(node => node.nodeValue);
    const text = texts.join('');
    // No changes if whitespace-only.
    if (/^\s*$/.test(text)) return;

    // Split the text into a list of phrases.
    const phrases = this.parser_.parse(text);
    assert(phrases.length > 0);
    assert(
      phrases.reduce((sum, phrase) => sum + phrase.length, 0) === text.length
    );
    // No changes if single phrase.
    if (phrases.length <= 1) return;

    // Compute the boundary indices from the list of phrase strings.
    const boundaries = [];
    let char_index = 0;
    for (const phrase of phrases) {
      assert(phrase.length > 0);
      char_index += phrase.length;
      boundaries.push(char_index);
    }

    // The break opportunity at the end of a block is not needed. Instead of
    // removing it, turn it to a sentinel for `splitTextNodesAtBoundaries` by
    // making it larger than the text length.
    assert(boundaries[0] > 0);
    assert(boundaries[boundaries.length - 1] === text.length);
    ++boundaries[boundaries.length - 1];
    assert(boundaries.length > 1);

    this.splitTextNodes(textNodes, boundaries);
    this.applyBlockStyle(element);
  }

  splitTextNodes(textNodes: Text[], boundaries: number[]) {
    assert(boundaries.length > 0);
    const textLen = textNodes.reduce(
      (sum, node) => sum + (node.nodeValue ? node.nodeValue.length : 0),
      0
    );
    // The last boundary must be a sentinel.
    assert(boundaries[boundaries.length - 1] > textLen);

    let boundary_index = 0;
    let boundary = boundaries[0];
    assert(boundary > 0);
    let nodeStart = 0; // the start index of the `nodeText` in the whole text.
    for (const node of textNodes) {
      const nodeText = node.nodeValue;
      if (!nodeText) continue;

      // Check if the next boundary is in this `node`.
      const nodeEnd = nodeStart + nodeText.length;
      if (boundary > nodeEnd) {
        nodeStart = nodeEnd;
        continue;
      }

      // Compute the boundary indices in the `nodeText`.
      const chunks = [];
      let chunkStartInNode = 0;
      while (boundary <= nodeEnd) {
        const boundaryInNode = boundary - nodeStart;
        assert(boundaryInNode > chunkStartInNode);
        chunks.push(nodeText.substring(chunkStartInNode, boundaryInNode));
        chunkStartInNode = boundaryInNode;
        ++boundary_index;
        assert(boundaries[boundary_index] > boundary);
        boundary = boundaries[boundary_index];
      }
      assert(chunks.length > 0);

      // Add the rest of the `nodeText` and split the `node`.
      chunks.push(nodeText.substring(chunkStartInNode));
      this.splitTextNode(node, chunks);

      nodeStart = nodeEnd;
    }

    // Check if all nodes and boundaries are consumed.
    assert(nodeStart === textLen);
    assert(boundary_index === boundaries.length - 1);
  }

  splitTextNode(node: Text, chunks: string[]) {
    assert(chunks.length > 1);
    assert(node.nodeValue === chunks.join(''));

    // If the `separator` string is specified, insert it at each boundary.
    if (this.separator) {
      node.nodeValue = chunks.join(this.separator);
      return;
    }

    // Otherwise create a `Text` node for each chunk, with `<wbr>` between them,
    // and replace the `node` with them.
    let nodes = [];
    for (const chunk of chunks) {
      nodes.push(document.createTextNode(chunk));
      nodes.push(null);
    }
    nodes.pop();
    nodes = nodes.map(n => (n ? n : document.createElement('wbr')));
    node.replaceWith(...nodes);
  }

  applyBlockStyle(element: HTMLElement) {
    if (this.className) {
      element.classList.add(this.className);
      return;
    }

    const style = element.style;
    style.wordBreak = 'keep-all';
    style.overflowWrap = 'break-word';
  }
}
