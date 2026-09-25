/* eslint-disable prettier/prettier */
/**
 * @license
 * Copyright 2026 Google LLC
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

import {Command} from 'commander';
import * as crypto from 'crypto';
import * as fs from 'fs';

const log = console.log;
const DEFAULT_EXTENSION_ID = 'dnonkmkecnbciehcnmhngnihgmenfmph';
const CWS_SCOPE = 'https://www.googleapis.com/auth/chromewebstore';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

interface CwsUploadResponse {
  name?: string;
  itemId?: string;
  crxVersion?: string;
  uploadState?:
    | 'UPLOAD_STATE_UNSPECIFIED'
    | 'SUCCEEDED'
    | 'IN_PROGRESS'
    | 'UPLOAD_IN_PROGRESS'
    | 'FAILED';
}

interface CwsPublishResponse {
  name?: string;
  itemId?: string;
  state?: string;
}

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

class ChromeWebStorePublisher {
  async run() {
    const program = new Command();
    program.option('-z, --zip <zip>', 'ZIP file to upload', 'budoux.zip');
    program.option(
      '-p, --publisher-id <id>',
      'Chrome Web Store Publisher ID (defaults to CWS_PUBLISHER_ID)'
    );
    program.option(
      '-e, --extension-id <id>',
      'Chrome Web Store Extension ID (defaults to CWS_EXTENSION_ID)'
    );
    program.option(
      '-t, --publish-type <type>',
      'Publish type: DEFAULT_PUBLISH, STAGED_PUBLISH, or UPLOAD_ONLY'
    );
    program.parse(process.argv);
    const options = program.opts();

    const publisherId = (
      options.publisherId ??
      process.env.CWS_PUBLISHER_ID ??
      ''
    ).trim();
    if (!publisherId) {
      log('CWS_PUBLISHER_ID is not set; skipping Chrome Web Store publish.');
      return;
    }

    const extensionId =
      (options.extensionId ?? process.env.CWS_EXTENSION_ID)?.trim() ||
      DEFAULT_EXTENSION_ID;
    const publishType =
      (options.publishType ?? process.env.CWS_PUBLISH_TYPE)?.trim() ||
      'DEFAULT_PUBLISH';
    const zipPath = options.zip;

    if (!fs.existsSync(zipPath)) {
      throw new Error(`ZIP file not found: ${zipPath}`);
    }

    const token = await this.getAccessToken();
    await this.uploadPackage(publisherId, extensionId, zipPath, token);

    if (publishType === 'UPLOAD_ONLY') {
      log('UPLOAD_ONLY specified; skipping publish step.');
      return;
    }

    await this.publishItem(publisherId, extensionId, publishType, token);
  }

  async getAccessToken(): Promise<string> {
    if (process.env.CWS_ACCESS_TOKEN) {
      return process.env.CWS_ACCESS_TOKEN.trim();
    }

    const saKeyRaw = process.env.CWS_SERVICE_ACCOUNT_KEY?.trim();
    const saKeyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
    if (saKeyRaw || saKeyPath) {
      const jsonStr =
        saKeyRaw || (await fs.promises.readFile(saKeyPath!, 'utf8'));
      const creds = JSON.parse(jsonStr) as ServiceAccountCredentials;
      return this.getAccessTokenFromServiceAccount(creds);
    }

    const clientId = process.env.CWS_CLIENT_ID?.trim();
    const clientSecret = process.env.CWS_CLIENT_SECRET?.trim();
    const refreshToken = process.env.CWS_REFRESH_TOKEN?.trim();
    if (clientId && clientSecret && refreshToken) {
      return this.getAccessTokenFromRefreshToken(
        clientId,
        clientSecret,
        refreshToken
      );
    }

    throw new Error(
      'Missing Chrome Web Store credentials. Set CWS_SERVICE_ACCOUNT_KEY ' +
        '(or GOOGLE_APPLICATION_CREDENTIALS) or CWS_CLIENT_ID, ' +
        'CWS_CLIENT_SECRET, and CWS_REFRESH_TOKEN.'
    );
  }

  async getAccessTokenFromServiceAccount(
    creds: ServiceAccountCredentials
  ): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const tokenUri = creds.token_uri || TOKEN_URL;
    const header = base64UrlEncode(JSON.stringify({alg: 'RS256', typ: 'JWT'}));
    const claimSet = base64UrlEncode(
      JSON.stringify({
        iss: creds.client_email,
        scope: CWS_SCOPE,
        aud: tokenUri,
        iat: now,
        exp: now + 3600,
      })
    );
    const unsignedJwt = `${header}.${claimSet}`;
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(unsignedJwt);
    const signature = base64UrlEncode(signer.sign(creds.private_key));
    const assertion = `${unsignedJwt}.${signature}`;

    const res = await fetch(tokenUri, {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    });
    if (!res.ok) {
      throw new Error(
        `Failed to obtain service account token (${res.status}): ${await res.text()}`
      );
    }
    const data = (await res.json()) as {access_token: string};
    return data.access_token;
  }

  async getAccessTokenFromRefreshToken(
    clientId: string,
    clientSecret: string,
    refreshToken: string
  ): Promise<string> {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    if (!res.ok) {
      throw new Error(
        `Failed to refresh OAuth token (${res.status}): ${await res.text()}`
      );
    }
    const data = (await res.json()) as {access_token: string};
    return data.access_token;
  }

  async uploadPackage(
    publisherId: string,
    extensionId: string,
    zipPath: string,
    token: string
  ) {
    const url = `https://chromewebstore.googleapis.com/upload/v2/publishers/${publisherId}/items/${extensionId}:upload`;
    const zipBuffer = await fs.promises.readFile(zipPath);
    log(`Uploading ${zipPath} (${zipBuffer.length} bytes) to CWS...`);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/zip',
      },
      body: zipBuffer,
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`CWS upload failed (${res.status}): ${text}`);
    }
    let status = JSON.parse(text) as CwsUploadResponse;
    log(
      `Upload response: state=${status.uploadState}, version=${status.crxVersion ?? 'unknown'}`
    );

    const statusUrl = `https://chromewebstore.googleapis.com/v2/publishers/${publisherId}/items/${extensionId}:fetchStatus`;
    for (
      let attempt = 0;
      attempt < 12 &&
      (status.uploadState === 'IN_PROGRESS' ||
        status.uploadState === 'UPLOAD_IN_PROGRESS');
      attempt++
    ) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      const pollRes = await fetch(statusUrl, {
        headers: {Authorization: `Bearer ${token}`},
      });
      if (!pollRes.ok) {
        throw new Error(
          `CWS fetchStatus failed (${pollRes.status}): ${await pollRes.text()}`
        );
      }
      const pollData = (await pollRes.json()) as {
        lastAsyncUploadState?: CwsUploadResponse['uploadState'];
      };
      status = {uploadState: pollData.lastAsyncUploadState};
      log(`Polled upload state: ${status.uploadState}`);
    }

    if (status.uploadState && status.uploadState !== 'SUCCEEDED') {
      throw new Error(
        `CWS upload did not succeed: state=${status.uploadState}`
      );
    }
  }

  async publishItem(
    publisherId: string,
    extensionId: string,
    publishType: string,
    token: string
  ) {
    const url = `https://chromewebstore.googleapis.com/v2/publishers/${publisherId}/items/${extensionId}:publish`;
    log(`Publishing item ${extensionId} (${publishType})...`);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({publishType}),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`CWS publish failed (${res.status}): ${text}`);
    }
    const result = JSON.parse(text) as CwsPublishResponse;
    log(`Published successfully: state=${result.state}`);
  }
}

new ChromeWebStorePublisher().run();
