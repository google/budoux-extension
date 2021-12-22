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

import '@material/mwc-radio';
import '@material/mwc-button';
import '@material/mwc-formfield';
import '@material/mwc-textfield';
import {Radio} from '@material/mwc-radio';
import {TextField} from '@material/mwc-textfield';
import {Button} from '@material/mwc-button';

const zwsp = document.getElementById('zwsp') as Radio;
const idsp = document.getElementById('idsp') as Radio;
const space = document.getElementById('space') as Radio;
const presets = [zwsp, idsp, space];
const other = document.getElementById('other') as Radio;
const separatorText = document.getElementById('separatorText') as TextField;
const saveButton = document.getElementById('save') as Button;

function checkOtherIfNeeded() {
  if (separatorText.value) other.checked = true;
}

function getSeparator() {
  for (const preset of presets) {
    if (preset.checked) return preset.value;
  }
  return separatorText.value;
}

function setSeparator(separator: string) {
  for (const preset of presets) {
    if (separator === preset.value) {
      preset.checked = true;
      return;
    }
  }
  other.checked = true;
  separatorText.value = separator;
}

function saveOptions() {
  chrome.storage.sync.set({
    separator: getSeparator(),
  });
}

function restoreOptions() {
  chrome.storage.sync.get(
    {
      separator: '\u200B',
    },
    items => {
      setSeparator(items.separator);
    }
  );
}

document.addEventListener('DOMContentLoaded', restoreOptions);
saveButton.addEventListener('click', saveOptions);
separatorText.addEventListener('input', checkOtherIfNeeded);
