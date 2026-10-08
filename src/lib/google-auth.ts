/**
 * Google Auth helpers – custom JWT for service accounts (no googleapis).
 *
 * This module builds an RS256 JWT for a Google service account and exchanges it
 * for an access token using the OAuth2 JWT bearer flow.
 *
 * It is compatible with both:
 * - Node (Astro dev/build)
 * - Cloudflare Workers (crypto.subtle)
 */

import type { APIContext } from 'astro';
import { getGoogleCredentials } from './google-sheets';

export interface GoogleServiceAccount {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

const DEFAULT_TOKEN_URI = 'https://oauth2.googleapis.com/token';

function base64UrlEncode(buffer: ArrayBuffer | Uint8Array | string): string {
  let bytes: Uint8Array;
  if (typeof buffer === 'string') {
    bytes = new TextEncoder().encode(buffer);
  } else if (buffer instanceof Uint8Array) {
    bytes = buffer;
  } else {
    bytes = new Uint8Array(buffer);
  }
  let str = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const lines = pem.trim().split('\n');
  const base64 = lines
    .filter((l) => !l.startsWith('-----'))
    .join('')
    .replace(/\s+/g, '');
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function signJwtWebCrypto(data: string, privateKeyPem: string): Promise<string> {
  const keyData = pemToArrayBuffer(privateKeyPem);
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(data));
  return base64UrlEncode(signature);
}

async function signJwtNode(data: string, privateKeyPem: string): Promise<string> {
  const { createSign } = await import('node:crypto');
  const sign = createSign('RSA-SHA256');
  sign.update(data);
  sign.end();
  const signature = sign.sign(privateKeyPem);
  return base64UrlEncode(signature);
}

async function signJwtRS256(payload: Record<string, unknown>, privateKeyPem: string): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;

  // Prefer WebCrypto (Cloudflare Workers / modern Node)
  if (typeof crypto !== 'undefined' && (crypto as Crypto).subtle) {
    const sig = await signJwtWebCrypto(data, privateKeyPem);
    return `${data}.${sig}`;
  }

  // Fallback to Node's crypto
  if (typeof process !== 'undefined') {
    const sig = await signJwtNode(data, privateKeyPem);
    return `${data}.${sig}`;
  }

  throw new Error('No suitable crypto implementation available for JWT signing');
}

/**
 * Get a typed Google service account from GOOGLE_SERVICE_ACCOUNT_JSON.
 */
export async function getServiceAccount(context: APIContext): Promise<GoogleServiceAccount | null> {
  const raw = await getGoogleCredentials(context);
  if (!raw) return null;
  const clientEmail = (raw as any).client_email as string | undefined;
  const privateKey = (raw as any).private_key as string | undefined;
  const tokenUri = (raw as any).token_uri as string | undefined;
  if (!clientEmail || !privateKey) {
    console.error('[google-auth] Missing client_email or private_key in GOOGLE_SERVICE_ACCOUNT_JSON');
    return null;
  }
  return {
    client_email: clientEmail,
    private_key: privateKey,
    token_uri: tokenUri || DEFAULT_TOKEN_URI,
  };
}

/**
 * Exchange a signed JWT for an access token using Google's OAuth2 JWT bearer flow.
 */
export async function getAccessTokenFromServiceAccount(
  serviceAccount: GoogleServiceAccount,
  scopes: string[]
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const tokenUri = serviceAccount.token_uri || DEFAULT_TOKEN_URI;

  const claims = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    scope: scopes.join(' '),
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  };

  const assertion = await signJwtRS256(claims, serviceAccount.private_key);

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });

  const response = await fetch(tokenUri, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`[google-auth] Token request failed: ${response.status} ${text}`);
  }

  const json = (await response.json()) as { access_token?: string; error?: string };
  if (!json.access_token) {
    throw new Error(`[google-auth] No access_token in response: ${JSON.stringify(json)}`);
  }
  return json.access_token;
}

