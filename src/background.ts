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

const assert = console.assert;

async function applyBudouX(tab?: chrome.tabs.Tab, frameId?: number) {
  const tabId = tab?.id;
  assert(tabId !== undefined, tab);
  if (tabId === undefined) return;
  const target: chrome.scripting.InjectionTarget = {
    tabId: tabId,
    frameIds: frameId !== undefined ? [frameId] : undefined,
  };
  await chrome.scripting.executeScript({
    target: target,
    files: ['content.js'],
  });

  await chrome.action.setBadgeText({
    text: 'ON',
    tabId: tabId,
  });
  await chrome.action.setBadgeBackgroundColor({
    color: '#00c853',
    tabId: tabId,
  });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'BudouX',
    title: chrome.i18n.getMessage('applyMenuTitle'),
    contexts: ['all'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  await applyBudouX(tab, info.frameId);
});
chrome.action.onClicked.addListener(applyBudouX);
