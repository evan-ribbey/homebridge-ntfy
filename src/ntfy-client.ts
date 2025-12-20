import axios from 'axios';
import type { Logging } from 'homebridge';

export interface MessageRequest {
    topic: string,
    message?: string;
    title?: string;
    tags?: string;
    priority?: number;
}

export class NtfyClient {
  constructor(
    private readonly log: Logging,
    private readonly serverAddress: string,
  ) {}

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

    const headers: Record<string, string> = {};
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
        this.log.error('ntfy request failed:', error.message);
      });
  }

  private async sendMessageJson(json: string) {
    this.log.debug('Sending ntfy JSON request:', JSON.parse(json));

    await axios.post(this.serverAddress, json)
      .then(response => {
        this.log.debug('Success! Result:', response.data);
      })
      .catch(error => {
        this.log.error('ntfy request failed:', error.message);
      });
  }
 
  private isMessageRequest(obj: unknown): obj is MessageRequest {
    return typeof (obj as { topic: unknown }).topic === 'string';
  }
}