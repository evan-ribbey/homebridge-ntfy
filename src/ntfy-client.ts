import axios from 'axios';
import type { Logging } from 'homebridge';
import type { NtfyAuth } from './types.js';

export interface MessageRequest {
    topic: string,
    message?: string;
    title?: string;
    tags?: string;
    priority?: number;
}

export class NtfyClient {
  private readonly authHeader?: string;

  constructor(
    private readonly log: Logging,
    private readonly serverAddress: string,
    auth?: NtfyAuth,
  ) {
    this.authHeader = this.buildAuthHeader(auth);
  }

  async sendMessage(request: MessageRequest | string) {
    if (this.isMessageRequest(request)) {
      return this.sendMessageRequest(request);
    } else if (typeof request === 'string') {
      return this.sendMessageJson(request);
    } else {
      this.log.error('Unknown request type:', request);
    }
  }

  private async sendMessageRequest(request: MessageRequest) {
    this.log.debug('Sending ntfy request:', request);

    const url = `${this.serverAddress}/${request.topic}`;

    const body = request.message;

    const headers: Record<string, string> = this.baseHeaders();
    if (request.title) {
      headers.Title = request.title;
    }
    if (request.priority) {
      headers.Priority = request.priority.toString();
    }
    if (request.tags) {
      headers.Tags = request.tags;
    }

    await axios.post(url, body, { headers })
      .then(response => {
        this.log.debug('Success! Result:', response.data);
      })
      .catch(error => {
        this.logRequestError(error);
      });
  }

  private async sendMessageJson(json: string) {
    this.log.debug('Sending ntfy JSON request:', JSON.parse(json));

    await axios.post(this.serverAddress, json, { headers: this.baseHeaders() })
      .then(response => {
        this.log.debug('Success! Result:', response.data);
      })
      .catch(error => {
        this.logRequestError(error);
      });
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
    return typeof (obj as { topic: unknown }).topic === 'string';
  }
}
