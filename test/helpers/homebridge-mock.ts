import type { API, Logging, PlatformAccessory } from 'homebridge';
import type { NtfyPlatform } from '../../src/platform.js';

export interface RecordingLog {
  log: Logging;
  errors: string[];
  infos: string[];
}

export const createLog = (): RecordingLog => {
  const errors: string[] = [];
  const infos: string[] = [];

  const stringify = (args: unknown[]) => args.map((a) => String(a)).join(' ');

  const log = Object.assign(() => {}, {
    prefix: 'test',
    info: (...args: unknown[]) => {
      infos.push(stringify(args));
    },
    error: (...args: unknown[]) => {
      errors.push(stringify(args));
    },
    success: () => {},
    warn: () => {},
    debug: () => {},
    log: () => {},
  }) as unknown as Logging;

  return { log, errors, infos };
};

const characteristic = {
  onSet: () => characteristic,
  onGet: () => characteristic,
  updateValue: () => characteristic,
};

const service = {
  setCharacteristic: () => service,
  getCharacteristic: () => characteristic,
};

class MockAccessory {
  readonly displayName: string;
  readonly UUID: string;

  constructor(displayName: string, uuid: string) {
    this.displayName = displayName;
    this.UUID = uuid;
  }

  getService() {
    return service;
  }

  addService() {
    return service;
  }
}

/** An accessory as Homebridge would hand it back from its cache. */
export const createAccessory = (displayName: string, uuid: string): PlatformAccessory =>
  new MockAccessory(displayName, uuid) as unknown as PlatformAccessory;

export interface MockApi {
  api: API;
  registered: PlatformAccessory[];
  unregistered: PlatformAccessory[];
  launch: () => void;
}

/**
 * Minimal stand-in for the Homebridge API. registerPlatformAccessories throws
 * on a repeated UUID, mirroring what HAP does, so a duplicate-accessory
 * regression fails the test rather than passing silently.
 */
export const createMockApi = (): MockApi => {
  const registered: PlatformAccessory[] = [];
  const unregistered: PlatformAccessory[] = [];
  let launch = () => {};

  const api = {
    hap: {
      Service: { AccessoryInformation: 'AccessoryInformation', Switch: 'Switch' },
      Characteristic: {
        Manufacturer: 'Manufacturer',
        Model: 'Model',
        SerialNumber: 'SerialNumber',
        Name: 'Name',
        On: 'On',
      },
      uuid: { generate: (input: string) => `uuid:${input}` },
    },
    on: (event: string, callback: () => void) => {
      if (event === 'didFinishLaunching') {
        launch = callback;
      }
    },
    platformAccessory: MockAccessory,
    registerPlatformAccessories: (_plugin: string, _platform: string, accessories: PlatformAccessory[]) => {
      for (const accessory of accessories) {
        if (registered.some((existing) => existing.UUID === accessory.UUID)) {
          throw new Error(`HAP rejects a duplicate accessory UUID: ${accessory.UUID}`);
        }
        registered.push(accessory);
      }
    },
    unregisterPlatformAccessories: (_plugin: string, _platform: string, accessories: PlatformAccessory[]) => {
      unregistered.push(...accessories);
    },
  } as unknown as API;

  return { api, registered, unregistered, launch: () => launch() };
};

export interface SwitchHarness {
  accessory: PlatformAccessory;
  platform: NtfyPlatform;
  /** Invokes the handler the accessory registered for the On characteristic. */
  setOn: (value: boolean) => Promise<void>;
  /** Every value pushed back to HomeKit via updateValue, in order. */
  values: boolean[];
}

/**
 * Wires up just enough of a platform and accessory to drive SwitchAccessory's
 * On handler directly, capturing what it reports back to HomeKit.
 */
export const createSwitchHarness = (displayName: string, log: Logging): SwitchHarness => {
  const values: boolean[] = [];
  let onSetHandler: (value: boolean) => Promise<void> = async () => {};

  const onCharacteristic = {
    onSet: (handler: (value: boolean) => Promise<void>) => {
      onSetHandler = handler;
      return onCharacteristic;
    },
    onGet: () => onCharacteristic,
    updateValue: (value: boolean) => {
      values.push(value);
      return onCharacteristic;
    },
  };

  const switchService = {
    setCharacteristic: () => switchService,
    getCharacteristic: () => onCharacteristic,
  };

  const accessory = {
    displayName,
    UUID: `uuid:${displayName}`,
    getService: (requested: string) => (requested === 'AccessoryInformation' ? service : switchService),
    addService: () => switchService,
  } as unknown as PlatformAccessory;

  const platform = {
    log,
    Service: { AccessoryInformation: 'AccessoryInformation', Switch: 'Switch' },
    Characteristic: {
      Manufacturer: 'Manufacturer',
      Model: 'Model',
      SerialNumber: 'SerialNumber',
      Name: 'Name',
      On: 'On',
    },
  } as unknown as NtfyPlatform;

  return { accessory, platform, setOn: (value) => onSetHandler(value), values };
};
