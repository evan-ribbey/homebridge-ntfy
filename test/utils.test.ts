import { describe, expect, it } from 'vitest';
import { isValidJson, normalizeServerUrl, wait } from '../src/utils.js';

describe('normalizeServerUrl', () => {
  it('passes through a well formed URL', () => {
    expect(normalizeServerUrl('https://ntfy.sh')).toBe('https://ntfy.sh');
  });

  it('strips trailing slashes', () => {
    expect(normalizeServerUrl('https://ntfy.home.lan/')).toBe('https://ntfy.home.lan');
    expect(normalizeServerUrl('https://ntfy.home.lan///')).toBe('https://ntfy.home.lan');
  });

  it('assumes https when no protocol is given', () => {
    expect(normalizeServerUrl('ntfy.home.lan')).toBe('https://ntfy.home.lan');
  });

  it('keeps an explicit http protocol and port', () => {
    expect(normalizeServerUrl('http://192.168.1.50:8080')).toBe('http://192.168.1.50:8080');
  });

  it('keeps a base path for reverse proxied servers', () => {
    expect(normalizeServerUrl('https://home.example.com/ntfy/')).toBe('https://home.example.com/ntfy');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeServerUrl('  https://ntfy.home.lan  ')).toBe('https://ntfy.home.lan');
  });

  it('returns undefined for empty or missing input', () => {
    expect(normalizeServerUrl('')).toBeUndefined();
    expect(normalizeServerUrl('   ')).toBeUndefined();
    expect(normalizeServerUrl(undefined)).toBeUndefined();
  });

  it('rejects protocols ntfy cannot be published to', () => {
    expect(normalizeServerUrl('ftp://ntfy.home.lan')).toBeUndefined();
    expect(normalizeServerUrl('file:///etc/passwd')).toBeUndefined();
  });

  it('rejects input that cannot be parsed as a URL', () => {
    expect(normalizeServerUrl('http://')).toBeUndefined();
  });
});

describe('isValidJson', () => {
  it('accepts well formed JSON', () => {
    expect(isValidJson('{"topic":"a"}')).toBe(true);
  });

  it('rejects malformed JSON', () => {
    expect(isValidJson('{oops')).toBe(false);
    expect(isValidJson('')).toBe(false);
  });
});

describe('wait', () => {
  it('resolves after the requested delay', async () => {
    const started = Date.now();
    await wait(20);
    expect(Date.now() - started).toBeGreaterThanOrEqual(15);
  });
});
