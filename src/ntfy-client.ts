import axios from 'axios';
import type { Logging } from 'homebridge';
import type { NtfyAuth } from './types.js';

export interface MessageRequest {
    topic: string,
    message?: string;
    title?: string;
    tags?: string;
    priority?: string | number;
}

/**
 * How long to wait for the ntfy server before giving up. Without a limit a
 * server that accepts the connection but never answers leaves the request
 * pending forever.
 */
export const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Node only allows latin-1 in header values: anything beyond it (emoji, most
 * scripts) makes the request throw, and latin-1 accents arrive at ntfy as
 * invalid UTF-8. ntfy decodes RFC 2047 encoded words on every header, so
 * non-ASCII values are sent as a base64 UTF-8 encoded word. Line breaks are
 * folded to spaces, matching what ntfy does with them anyway.
 */
export const encodeHeaderValue = (value: string): string => {
  const singleLine = value.replace(/[\r\n]+/g, ' ');
  if (/^[\x20-\x7e]*$/.test(singleLine)) {
    return singleLine;
  }
  return `=?UTF-8?B?${Buffer.from(singleLine, 'utf8').toString('base64')}?=`;
};

export class NtfyClient {
  private readonly authHeader?: string;

  constructor(
    private readonly log: Logging,
    private readonly serverAddress: string,
    auth?: NtfyAuth,
    private readonly timeoutMs = REQUEST_TIMEOUT_MS,
  ) {
    this.authHeader = this.buildAuthHeader(auth);
  }

  /**
   * Publishes a message. Resolves to true when the server accepted it, and to
   * false when it did not - failures are logged here rather than thrown, so
   * callers must check the result before reporting success.
   */
  async sendMessage(request: MessageRequest | string): Promise<boolean> {
    if (typeof request === 'string') {
      return this.sendMessageJson(request);
    } else if (this.isMessageRequest(request)) {
      return this.sendMessageRequest(request);
    }

    this.log.error('Unknown request type:', request);
    return false;
  }

  private async sendMessageRequest(request: MessageRequest): Promise<boolean> {
    this.log.debug('Sending ntfy request:', request);

    // Encoded so a stray '?', '#' or '/' cannot truncate or redirect the path
    const url = `${this.serverAddress}/${encodeURIComponent(request.topic)}`;

    const body = request.message;

    const headers: Record<string, string> = this.baseHeaders();
    if (request.title) {
      headers.Title = encodeHeaderValue(request.title);
    }
    if (request.priority !== undefined && request.priority !== '') {
      headers.Priority = encodeHeaderValue(request.priority.toString());
    }
    if (request.tags) {
      headers.Tags = encodeHeaderValue(request.tags);
    }

    try {
      const response = await axios.post(url, body, { headers, timeout: this.timeoutMs });
      this.log.debug('Success! Result:', response.data);
      return true;
    } catch (error) {
      this.logRequestError(error);
      return false;
    }
  }

  private async sendMessageJson(json: string): Promise<boolean> {
    this.log.debug('Sending ntfy JSON request:', json);

    try {
      // ntfy takes JSON publishes at its root path. The trailing slash keeps a
      // base path like https://host/ntfy pointing at /ntfy/ - without it a
      // reverse proxy may redirect, and redirected POSTs turn into GETs.
      const response = await axios.post(`${this.serverAddress}/`, json, {
        headers: this.baseHeaders(),
        timeout: this.timeoutMs,
      });
      this.log.debug('Success! Result:', response.data);
      return true;
    } catch (error) {
      this.logRequestError(error);
      return false;
    }
  }

  private baseHeaders(): Record<string, string> {
    return this.authHeader ? { Authorization: this.authHeader } : {};
  }

  private buildAuthHeader(auth?: NtfyAuth): string | undefined {
    if (!auth) {
      return undefined;
    }

    if (auth.type === 'token') {
      return `Bearer ${auth.accessToken}`;
    }

    const credentials = Buffer.from(`${auth.username}:${auth.password ?? ''}`).toString('base64');
    return `Basic ${credentials}`;
  }

  private logRequestError(error: unknown) {
    if (axios.isAxiosError(error) && error.response) {
      const { status, data } = error.response;
      const details = typeof data === 'string' ? data : JSON.stringify(data);

      if (status === 401 || status === 403) {
        this.log.error(
          `ntfy request failed: ${status} - the server rejected the credentials. `
          + 'Check the authentication settings and that the token or user is allowed to publish to this topic.',
          details,
        );
        return;
      }

      this.log.error(`ntfy request failed: ${status}`, details);
      return;
    }

    this.log.error('ntfy request failed:', error instanceof Error ? error.message : error);
  }

  private isMessageRequest(obj: unknown): obj is MessageRequest {
    return typeof obj === 'object' && obj !== null && typeof (obj as { topic: unknown }).topic === 'string';
  }
}
