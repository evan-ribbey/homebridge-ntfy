import { describe, expect, it, vi } from 'vitest';
import type { NtfyClient } from '../src/ntfy-client.js';
import { SwitchAccessory } from '../src/switch-accessory.js';
import type { Message } from '../src/types.js';
import { createLog, createSwitchHarness } from './helpers/homebridge-mock.js';

const build = (message: Message, sendResult = true) => {
  const { log, errors, infos } = createLog();
  const harness = createSwitchHarness(message.name, log);
  const sendMessage = vi.fn().mockResolvedValue(sendResult);
  const client = { sendMessage } as unknown as NtfyClient;

  const accessory = new SwitchAccessory(harness.platform, harness.accessory, client, message);

  // The send runs in the background so HomeKit gets an immediate reply; wait
  // for it here so assertions see the finished result.
  const setOn = async (value: boolean) => {
    await harness.setOn(value);
    await accessory.pendingSend;
  };

  return { ...harness, setOn, sendMessage, errors, infos };
};

describe('sending', () => {
  it('builds a request from a plain message', async () => {
    const { setOn, sendMessage } = build({
      name: 'Doorbell', topic: 'door', title: 'T', message: 'M', priority: 'high', tags: 'bell',
    });

    await setOn(true);

    expect(sendMessage).toHaveBeenCalledWith({
      topic: 'door', title: 'T', message: 'M', priority: 'high', tags: 'bell',
    });
  });

  it('passes the raw payload through for a JSON message', async () => {
    const json = '{"topic":"door","message":"hi"}';
    const { setOn, sendMessage } = build({ name: 'Doorbell', useJson: true, json });

    await setOn(true);

    expect(sendMessage).toHaveBeenCalledWith(json);
  });

  it('sends nothing when turned off', async () => {
    const { setOn, sendMessage } = build({ name: 'Doorbell', topic: 'door' });

    await setOn(false);

    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('reports a misconfigured message instead of sending', async () => {
    const { setOn, sendMessage, infos } = build({ name: 'Broken' });

    await setOn(true);

    expect(sendMessage).not.toHaveBeenCalled();
    expect(infos.some((i) => i.includes('Nothing to send'))).toBe(true);
  });
});

describe('result reporting', () => {
  it('logs success only when the message was accepted', async () => {
    const { setOn, infos, errors } = build({ name: 'Doorbell', topic: 'door' }, true);

    await setOn(true);

    expect(infos.some((i) => i.includes('Message sent'))).toBe(true);
    expect(errors).toHaveLength(0);
  });

  it('logs a failure rather than claiming the message was sent', async () => {
    const { setOn, infos, errors } = build({ name: 'Doorbell', topic: 'door' }, false);

    await setOn(true);

    expect(errors.some((e) => e.includes('Failed to send message'))).toBe(true);
    expect(infos.some((i) => i.includes('Message sent'))).toBe(false);
  });
});

describe('momentary behaviour', () => {
  it('returns the switch to off after firing', async () => {
    const { setOn, values } = build({ name: 'Doorbell', topic: 'door' });

    await setOn(true);

    expect(values[0]).toBe(true);
    expect(values[values.length - 1]).toBe(false);
  });
});

describe('responsiveness', () => {
  it('returns to HomeKit without waiting for the server, then resets once the send finishes', async () => {
    const { log } = createLog();
    const harness = createSwitchHarness('Doorbell', log);
    let finish: (sent: boolean) => void = () => {};
    const sendMessage = vi.fn(() => new Promise<boolean>((resolve) => {
      finish = resolve;
    }));
    const accessory = new SwitchAccessory(
      harness.platform, harness.accessory, { sendMessage } as unknown as NtfyClient, { name: 'Doorbell', topic: 'door' },
    );

    await harness.setOn(true);

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(harness.values[harness.values.length - 1]).toBe(true);

    finish(true);
    await accessory.pendingSend;

    expect(harness.values[harness.values.length - 1]).toBe(false);
  });
});

describe('cooldown', () => {
  it('suppresses a second trigger inside the cooldown window', async () => {
    const { setOn, sendMessage, infos } = build({ name: 'Doorbell', topic: 'door', cooldownTime: 500 });

    await setOn(true);
    await setOn(true);

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(infos.some((i) => i.includes('Still in cooldown'))).toBe(true);
  });

  it('does not treat switching off during the cooldown as a suppressed trigger', async () => {
    const { setOn, sendMessage, infos } = build({ name: 'Doorbell', topic: 'door', cooldownTime: 500 });

    await setOn(true);
    await setOn(false);

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(infos.some((i) => i.includes('Still in cooldown'))).toBe(false);
  });

  it('allows the next trigger once the cooldown has elapsed', async () => {
    const { setOn, sendMessage } = build({ name: 'Doorbell', topic: 'door', cooldownTime: 20 });

    await setOn(true);
    await new Promise((resolve) => setTimeout(resolve, 60));
    await setOn(true);

    expect(sendMessage).toHaveBeenCalledTimes(2);
  });

  it('does not rate limit when no cooldown is configured', async () => {
    const { setOn, sendMessage } = build({ name: 'Doorbell', topic: 'door' });

    await setOn(true);
    await setOn(true);

    expect(sendMessage).toHaveBeenCalledTimes(2);
  });
});
