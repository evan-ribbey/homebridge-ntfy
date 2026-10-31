import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { NtfyClient, encodeHeaderValue } from '../src/ntfy-client.js';
import { createLog } from './helpers/homebridge-mock.js';
import { startServer, type TestServer } from './helpers/test-server.js';

let servers: TestServer[] = [];

const server = async (status?: number, body?: string) => {
  const started = await startServer(status, body);
  servers.push(started);
  return started;
};

afterEach(async () => {
  await Promise.all(servers.map((s) => s.close()));
  servers = [];
});

describe('request shape', () => {
  it('appends the topic to the configured server address', async () => {
    const target = await server();
    await new NtfyClient(createLog().log, target.url).sendMessage({ topic: 'my-topic', message: 'hi' });

    expect(target.lastRequest().url).toBe('/my-topic');
    expect(target.lastRequest().method).toBe('POST');
    expect(target.lastRequest().body).toBe('hi');
  });

  it('preserves a base path when appending the topic', async () => {
    const target = await server();
    await new NtfyClient(createLog().log, `${target.url}/ntfy`).sendMessage({ topic: 'my-topic' });

    expect(target.lastRequest().url).toBe('/ntfy/my-topic');
  });

  it('maps optional fields onto ntfy headers', async () => {
    const target = await server();
    await new NtfyClient(createLog().log, target.url).sendMessage({
      topic: 'a', title: 'Title', tags: 'warning', priority: 'high',
    });

    const { headers } = target.lastRequest();
    expect(headers.title).toBe('Title');
    expect(headers.tags).toBe('warning');
    expect(headers.priority).toBe('high');
  });

  it('omits headers for fields that were not configured', async () => {
    const target = await server();
    await new NtfyClient(createLog().log, target.url).sendMessage({ topic: 'a' });

    const { headers } = target.lastRequest();
    expect(headers.title).toBeUndefined();
    expect(headers.tags).toBeUndefined();
    expect(headers.priority).toBeUndefined();
  });

  it('posts a JSON message to the server root rather than a topic path', async () => {
    const target = await server();
    await new NtfyClient(createLog().log, target.url).sendMessage('{"topic":"a","message":"hi"}');

    expect(target.lastRequest().url).toBe('/');
    expect(target.lastRequest().body).toBe('{"topic":"a","message":"hi"}');
  });
  it('posts a JSON message under the base path when one is configured', async () => {
    const target = await server();
    await new NtfyClient(createLog().log, `${target.url}/ntfy`).sendMessage('{"topic":"a"}');

    expect(target.lastRequest().url).toBe('/ntfy/');
  });

  it('percent-encodes the topic so it cannot alter the request path', async () => {
    const target = await server();
    await new NtfyClient(createLog().log, target.url).sendMessage({ topic: 'a?b#c/../d' });

    expect(target.lastRequest().url).toBe('/a%3Fb%23c%2F..%2Fd');
  });
});

describe('header encoding', () => {
  const decode = (value: string | string[] | undefined) => {
    const match = /^=\?UTF-8\?B\?(.*)\?=$/.exec(String(value));
    return match ? Buffer.from(match[1], 'base64').toString('utf8') : undefined;
  };

  it('leaves plain ASCII values untouched', async () => {
    const target = await server();
    await new NtfyClient(createLog().log, target.url).sendMessage({ topic: 'a', title: 'Door opened', tags: 'door,bell' });

    expect(target.lastRequest().headers.title).toBe('Door opened');
    expect(target.lastRequest().headers.tags).toBe('door,bell');
  });

  it('sends an emoji title instead of failing the request', async () => {
    const target = await server();
    const sent = await new NtfyClient(createLog().log, target.url).sendMessage({ topic: 'a', title: '🚪 Door opened' });

    expect(sent).toBe(true);
    expect(decode(target.lastRequest().headers.title)).toBe('🚪 Door opened');
  });

  it('sends accented text as UTF-8 rather than latin-1', async () => {
    const target = await server();
    await new NtfyClient(createLog().log, target.url).sendMessage({ topic: 'a', title: 'Café', tags: 'Äpfel' });

    expect(decode(target.lastRequest().headers.title)).toBe('Café');
    expect(decode(target.lastRequest().headers.tags)).toBe('Äpfel');
  });

  it('folds line breaks rather than letting the request throw', () => {
    expect(encodeHeaderValue('line one\r\nline two')).toBe('line one line two');
  });
});

describe('priority', () => {
  it('accepts the named priorities offered by the config UI', async () => {
    const target = await server();
    await new NtfyClient(createLog().log, target.url).sendMessage({ topic: 'a', priority: 'max' });

    expect(target.lastRequest().headers.priority).toBe('max');
  });

  it('accepts ntfy numeric priorities', async () => {
    const target = await server();
    await new NtfyClient(createLog().log, target.url).sendMessage({ topic: 'a', priority: 4 });

    expect(target.lastRequest().headers.priority).toBe('4');
  });

  it('omits the header when priority is left empty', async () => {
    const target = await server();
    await new NtfyClient(createLog().log, target.url).sendMessage({ topic: 'a', priority: '' });

    expect(target.lastRequest().headers.priority).toBeUndefined();
  });
});

describe('authentication', () => {
  it('sends no Authorization header when unauthenticated', async () => {
    const target = await server();
    await new NtfyClient(createLog().log, target.url).sendMessage({ topic: 'a' });

    expect(target.lastRequest().headers.authorization).toBeUndefined();
  });

  it('sends a bearer token', async () => {
    const target = await server();
    await new NtfyClient(createLog().log, target.url, { type: 'token', accessToken: 'tk_secret' })
      .sendMessage({ topic: 'a' });

    expect(target.lastRequest().headers.authorization).toBe('Bearer tk_secret');
  });

  it('sends base64 encoded basic credentials', async () => {
    const target = await server();
    await new NtfyClient(createLog().log, target.url, { type: 'basic', username: 'evan', password: 'pw' })
      .sendMessage({ topic: 'a' });

    const expected = Buffer.from('evan:pw').toString('base64');
    expect(target.lastRequest().headers.authorization).toBe(`Basic ${expected}`);
  });

  it('authenticates JSON messages too', async () => {
    const target = await server();
    await new NtfyClient(createLog().log, target.url, { type: 'token', accessToken: 'tk_secret' })
      .sendMessage('{"topic":"a"}');

    expect(target.lastRequest().headers.authorization).toBe('Bearer tk_secret');
  });
});

describe('result reporting', () => {
  it('resolves true when the server accepts the message', async () => {
    const target = await server();
    await expect(new NtfyClient(createLog().log, target.url).sendMessage({ topic: 'a' })).resolves.toBe(true);
  });

  it('resolves false when the server rejects the message', async () => {
    const target = await server(403, '{"error":"forbidden"}');
    await expect(new NtfyClient(createLog().log, target.url).sendMessage({ topic: 'a' })).resolves.toBe(false);
  });

  it('resolves false when the server is unreachable', async () => {
    await expect(new NtfyClient(createLog().log, 'http://127.0.0.1:1').sendMessage({ topic: 'a' })).resolves.toBe(false);
  });

  it('resolves false for a rejected JSON message', async () => {
    const target = await server(403, '{"error":"forbidden"}');
    await expect(new NtfyClient(createLog().log, target.url).sendMessage('{"topic":"a"}')).resolves.toBe(false);
  });

  it('resolves false without throwing on a request that is neither an object nor a string', async () => {
    const target = await server();
    const client = new NtfyClient(createLog().log, target.url);

    await expect(client.sendMessage(null as never)).resolves.toBe(false);
    await expect(client.sendMessage(42 as never)).resolves.toBe(false);
    await expect(client.sendMessage({} as never)).resolves.toBe(false);
  });
});

describe('error logging', () => {
  it('explains a 401 as a credentials problem', async () => {
    const target = await server(401, '{"error":"unauthorized"}');
    const { log, errors } = createLog();
    await new NtfyClient(log, target.url, { type: 'token', accessToken: 'bad' }).sendMessage({ topic: 'a' });

    expect(errors.some((e) => e.includes('401') && e.includes('rejected the credentials'))).toBe(true);
  });

  it('explains a 403 as a credentials problem', async () => {
    const target = await server(403, '{"error":"forbidden"}');
    const { log, errors } = createLog();
    await new NtfyClient(log, target.url).sendMessage({ topic: 'a' });

    expect(errors.some((e) => e.includes('403') && e.includes('rejected the credentials'))).toBe(true);
  });

  it('reports the status and body for other failures', async () => {
    const target = await server(500, '{"error":"boom"}');
    const { log, errors } = createLog();
    await new NtfyClient(log, target.url).sendMessage({ topic: 'a' });

    expect(errors.some((e) => e.includes('500') && e.includes('boom'))).toBe(true);
    expect(errors.some((e) => e.includes('rejected the credentials'))).toBe(false);
  });

  it('reports a transport failure without a response', async () => {
    const { log, errors } = createLog();
    await new NtfyClient(log, 'http://127.0.0.1:1').sendMessage({ topic: 'a' });

    expect(errors.some((e) => e.includes('ntfy request failed'))).toBe(true);
  });
});

describe('timeouts', () => {
  it('gives up on a server that never answers', async () => {
    const silent = http.createServer(() => {});
    await new Promise<void>((resolve) => silent.listen(0, '127.0.0.1', resolve));
    const { port } = silent.address() as AddressInfo;
    const { log, errors } = createLog();

    try {
      const sent = await new NtfyClient(log, `http://127.0.0.1:${port}`, undefined, 100).sendMessage({ topic: 'a' });

      expect(sent).toBe(false);
      expect(errors.some((e) => e.includes('timeout'))).toBe(true);
    } finally {
      silent.closeAllConnections();
      await new Promise<void>((resolve) => silent.close(() => resolve()));
    }
  });
});
