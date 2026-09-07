import { afterEach, describe, expect, it } from 'vitest';
import { NtfyClient } from '../src/ntfy-client.js';
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
