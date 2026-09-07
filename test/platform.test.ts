import { describe, expect, it } from 'vitest';
import type { PlatformConfig } from 'homebridge';
import { NtfyPlatform } from '../src/platform.js';
import type { Message } from '../src/types.js';
import { createAccessory, createLog, createMockApi } from './helpers/homebridge-mock.js';

interface RunOptions {
  messages?: Message[];
  cached?: string[];
  [key: string]: unknown;
}

const run = ({ messages = [], cached = [], ...platformConfig }: RunOptions = {}) => {
  const { log, errors, infos } = createLog();
  const { api, registered, unregistered, launch } = createMockApi();

  const config = { platform: 'NtfyPlatform', name: 'Homebridge Ntfy', messages, ...platformConfig } as PlatformConfig;
  const platform = new NtfyPlatform(log, config, api);

  for (const uuid of cached) {
    platform.configureAccessory(createAccessory(uuid, uuid));
  }

  launch();

  return { errors, infos, registered, unregistered };
};

const serverInUse = (infos: string[]) => infos.find((line) => line.startsWith('Using ntfy server:'));

describe('server URL resolution', () => {
  it('defaults to the official server when none is configured', () => {
    expect(serverInUse(run().infos)).toBe('Using ntfy server: https://ntfy.sh');
  });

  it('uses a configured custom server', () => {
    const { infos } = run({ serverUrl: 'https://ntfy.home.lan' });
    expect(serverInUse(infos)).toBe('Using ntfy server: https://ntfy.home.lan');
  });

  it('normalizes a configured server', () => {
    const { infos } = run({ serverUrl: '  ntfy.home.lan/  ' });
    expect(serverInUse(infos)).toBe('Using ntfy server: https://ntfy.home.lan');
  });

  it('falls back to the official server and logs when the URL is unusable', () => {
    const { infos, errors } = run({ serverUrl: 'ftp://ntfy.home.lan' });

    expect(serverInUse(infos)).toBe('Using ntfy server: https://ntfy.sh');
    expect(errors.some((e) => e.includes('Invalid server URL'))).toBe(true);
  });

  it('does not warn about an empty server URL', () => {
    const { errors } = run({ serverUrl: '   ' });
    expect(errors.some((e) => e.includes('Invalid server URL'))).toBe(false);
  });
});

describe('authentication config', () => {
  it('accepts a complete token config without complaint', () => {
    const { errors } = run({ authType: 'token', accessToken: 'tk_secret' });
    expect(errors).toHaveLength(0);
  });

  it('accepts a complete basic config without complaint', () => {
    const { errors } = run({ authType: 'basic', username: 'evan', password: 'pw' });
    expect(errors).toHaveLength(0);
  });

  it('warns when a token is selected but missing', () => {
    const { errors } = run({ authType: 'token' });
    expect(errors.some((e) => e.includes('no access token is configured'))).toBe(true);
  });

  it('warns when basic credentials are incomplete', () => {
    const { errors } = run({ authType: 'basic', username: 'evan' });
    expect(errors.some((e) => e.includes('credentials are incomplete'))).toBe(true);
  });
});

describe('message validation', () => {
  it('registers an accessory per valid message', () => {
    const { registered, errors } = run({
      messages: [{ name: 'Doorbell', topic: 'door' }, { name: 'Alarm', topic: 'alarm' }],
    });

    expect(registered.map((a) => a.displayName)).toEqual(['Doorbell', 'Alarm']);
    expect(errors).toHaveLength(0);
  });

  it('skips a message with no name', () => {
    const { registered, errors } = run({ messages: [{ topic: 'orphan' } as Message] });

    expect(registered).toHaveLength(0);
    expect(errors.some((e) => e.includes('\'name\' is missing'))).toBe(true);
  });

  it('skips a message with no topic and does not call it a JSON problem', () => {
    const { registered, errors } = run({ messages: [{ name: 'No topic' }] });

    expect(registered).toHaveLength(0);
    expect(errors.some((e) => e.startsWith('Invalid message config - \'topic\' is missing'))).toBe(true);
    expect(errors.some((e) => e.includes('Invalid JSON message config'))).toBe(false);
  });

  it('skips a JSON message with no payload', () => {
    const { registered, errors } = run({ messages: [{ name: 'Empty', useJson: true }] });

    expect(registered).toHaveLength(0);
    expect(errors.some((e) => e.includes('\'json\' is missing'))).toBe(true);
  });

  it('skips a JSON message with a malformed payload', () => {
    const { registered, errors } = run({ messages: [{ name: 'Bad', useJson: true, json: '{oops' }] });

    expect(registered).toHaveLength(0);
    expect(errors.some((e) => e.includes('malformed'))).toBe(true);
  });

  it('keeps registering valid messages after an invalid one', () => {
    const { registered } = run({
      messages: [{ name: 'Bad' }, { name: 'Good', topic: 'ok' }],
    });

    expect(registered.map((a) => a.displayName)).toEqual(['Good']);
  });
});

describe('duplicate message names', () => {
  it('registers a duplicated name only once instead of colliding on UUID', () => {
    const { registered, errors } = run({
      messages: [{ name: 'Doorbell', topic: 'a' }, { name: 'Doorbell', topic: 'b' }],
    });

    expect(registered).toHaveLength(1);
    expect(errors.some((e) => e.includes('Duplicate message name'))).toBe(true);
  });
});

describe('accessory cache', () => {
  it('restores a cached accessory instead of registering it again', () => {
    const { registered } = run({
      messages: [{ name: 'Doorbell', topic: 'door' }],
      cached: ['uuid:Doorbell'],
    });

    expect(registered).toHaveLength(0);
  });

  it('removes cached accessories that are no longer configured', () => {
    const { unregistered } = run({
      messages: [{ name: 'Doorbell', topic: 'door' }],
      cached: ['uuid:Doorbell', 'uuid:Removed'],
    });

    expect(unregistered.map((a) => a.UUID)).toEqual(['uuid:Removed']);
  });
});
