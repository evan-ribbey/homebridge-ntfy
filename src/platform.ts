import type { API, Characteristic, DynamicPlatformPlugin, Logging, PlatformAccessory, PlatformConfig, Service } from 'homebridge';
import { SwitchAccessory } from './switch-accessory.js';
import { DEFAULT_SERVER_URL, PLATFORM_NAME, PLUGIN_NAME } from './const.js';
import type { Message, NtfyAuth, NtfyPlatformConfig } from './types.js';
import { NtfyClient } from './ntfy-client.js';
import { isValidJson, normalizeServerUrl } from './utils.js';

export class NtfyPlatform implements DynamicPlatformPlugin {
  readonly Service: typeof Service;
  readonly Characteristic: typeof Characteristic;

  private readonly accessories: Map<string, PlatformAccessory> = new Map();
  private readonly discoveredCacheUUIDs: string[] = [];

  constructor(
    readonly log: Logging,
    readonly config: PlatformConfig,
    readonly api: API,
  ) {
    this.Service = api.hap.Service;
    this.Characteristic = api.hap.Characteristic;

    this.log.debug('Finished initializing platform:', config.name);

    this.api.on('didFinishLaunching', () => {
      log.debug('Registering accessories...');
      this.registerAccessories();
    });
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.log.debug('Loading accessory from cache:', accessory.displayName);

    this.accessories.set(accessory.UUID, accessory);
  }

  private registerAccessories() {
    const config = this.config as NtfyPlatformConfig;

    const serverUrl = this.resolveServerUrl(config);

    this.log.info('Using ntfy server:', serverUrl);

    const ntfyClient = new NtfyClient(
      this.log,
      serverUrl,
      this.resolveAuth(config),
    );

    const configuredNames = new Set<string>();

    if (config.messages) {
      for (const message of config.messages) {
        if (!this.validateMessage(message)) {
          continue;
        }

        if (configuredNames.has(message.name)) {
          this.log.error('Duplicate message name - names must be unique, skipping:', message.name);
          continue;
        }
        configuredNames.add(message.name);

        const uuid = this.api.hap.uuid.generate(message.name);

        const existingAccessory = this.accessories.get(uuid);

        if (existingAccessory) {
          this.log.debug('Restoring existing accessory from cache:', existingAccessory.displayName);

          new SwitchAccessory(this, existingAccessory, ntfyClient, message);
        } else {
          this.log.debug('Adding new accessory:', message.name);

          const accessory = new this.api.platformAccessory(message.name, uuid);

          new SwitchAccessory(this, accessory, ntfyClient, message);

          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        }

        this.discoveredCacheUUIDs.push(uuid);
      }
    }

    for (const [uuid, accessory] of this.accessories) {
      if (!this.discoveredCacheUUIDs.includes(uuid)) {
        this.log.debug('Removing existing accessory from cache:', accessory.displayName);
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
    }
  }

  private resolveServerUrl(config: NtfyPlatformConfig): string {
    const serverUrl = normalizeServerUrl(config.serverUrl);

    if (config.serverUrl?.trim() && !serverUrl) {
      this.log.error(
        `Invalid server URL - falling back to ${DEFAULT_SERVER_URL}:`,
        config.serverUrl,
      );
    }

    return serverUrl ?? DEFAULT_SERVER_URL;
  }

  private resolveAuth(config: NtfyPlatformConfig): NtfyAuth | undefined {
    switch (config.authType) {
    case 'token':
      if (!config.accessToken) {
        this.log.error('Access token authentication is selected but no access token is configured. Sending requests unauthenticated.');
        return undefined;
      }
      return { type: 'token', accessToken: config.accessToken };

    case 'basic':
      if (!config.username || !config.password) {
        this.log.error('Username/password authentication is selected but the credentials are incomplete. Sending requests unauthenticated.');
        return undefined;
      }
      return { type: 'basic', username: config.username, password: config.password };

    default:
      return undefined;
    }
  }

  private validateMessage(message: Message): boolean {
    if (!message.name) {
      this.log.error('Invalid message config - \'name\' is missing:', JSON.stringify(message));
      return false;
    }

    let error;
    if (message.useJson) {
      if (!message.json) {
        error = 'Invalid JSON message config - \'json\' is missing:';
      } else if (!isValidJson(message.json)) {
        error = 'Invalid JSON message config - \'json\' is malformed:';
      }
    } else {
      if (!message.topic) {
        error = 'Invalid message config - \'topic\' is missing:';
      }
    }
    if (error) {
      this.log.error(error, message.name);
      return false;
    }
    return true;
  }
}
