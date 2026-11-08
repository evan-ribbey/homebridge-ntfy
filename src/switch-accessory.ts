import type { Characteristic, CharacteristicValue, Logging, PlatformAccessory, Service } from 'homebridge';
import type { NtfyClient } from './ntfy-client.js';
import type { NtfyPlatform } from './platform.js';
import type { Message } from './types.js';
import { wait } from './utils.js';

export class SwitchAccessory {
  private log: Logging;
  private service: Service;
  private onCharacteristic: Characteristic;

  private isOn = false;
  private inCooldown = false;

  /** The send started by the most recent trigger, exposed for tests. */
  pendingSend: Promise<void> = Promise.resolve();

  constructor(
    private readonly platform: NtfyPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly ntfyClient: NtfyClient,
    private readonly message: Message,
  ) {
    this.log = platform.log;

    // Set accessory information
    const infoService = this.accessory.getService(this.platform.Service.AccessoryInformation);
    if (infoService) {
      infoService
        .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Homebridge Ntfy')
        .setCharacteristic(this.platform.Characteristic.Model, 'Notification Switch')
        .setCharacteristic(this.platform.Characteristic.SerialNumber, 'N/A');
    }

    this.service = this.accessory.getService(this.platform.Service.Switch) || this.accessory.addService(this.platform.Service.Switch);

    this.service.setCharacteristic(this.platform.Characteristic.Name, this.message.name);

    this.onCharacteristic = this.service.getCharacteristic(this.platform.Characteristic.On);

    // Register handlers for the On/Off Characteristic
    this.onCharacteristic
      .onSet(this.setOn.bind(this))
      .onGet(this.getOn.bind(this));
  }

  private async setOn(value: CharacteristicValue) {
    this.log.debug('setOn:', value);

    this.isOn = value as boolean;
    this.onCharacteristic.updateValue(this.isOn);

    // Only turning the switch on triggers anything; switching it off (by hand,
    // or by an automation) is not a suppressed trigger even during cooldown
    if (!this.isOn) {
      return;
    }

    if (this.inCooldown) {
      this.log.info('Still in cooldown:', this.message.name);
      await wait(250);
      this.resetSwitch();
      return;
    }

    void this.triggerCooldown(this.message.cooldownTime);
    // Not awaited: HomeKit expects onSet to return promptly, and a slow or
    // unreachable ntfy server would otherwise leave the switch unresponsive
    // and trip Homebridge's slow-plugin warnings. The switch stays on while
    // the message is in flight, then resets.
    this.pendingSend = this.sendMessage()
      .catch((error: unknown) => this.log.error('Failed to send message:', this.message.name, error))
      .finally(() => this.resetSwitch());
  }

  private async getOn(): Promise<CharacteristicValue> {
    return this.isOn;
  }

  private async sendMessage() {
    let request;
    if (!this.message.useJson && this.message.topic) {
      request = {
        topic: this.message.topic,
        title: this.message.title,
        message: this.message.message,
        priority: this.message.priority,
        tags: this.message.tags,
      };
    } else if (this.message.useJson && this.message.json) {
      request = this.message.json;
    } else {
      this.log.info('Nothing to send. Check configuration for:', this.message.name);
      return;
    }
    
    const sent = await this.ntfyClient.sendMessage(request);

    if (sent) {
      this.log.info('Message sent:', this.message.name);
    } else {
      this.log.error('Failed to send message:', this.message.name);
    }
  }

  private async triggerCooldown(cooldownTime = 0) {
    if (cooldownTime <= 0) {
      return;
    }

    this.log.debug('Entering cooldown:', this.message.name);
    this.inCooldown = true;
    await wait(cooldownTime);
    this.inCooldown = false;
    this.log.debug('Exited cooldown:', this.message.name);
  }

  private resetSwitch() {
    this.log.debug('Resetting switch:', this.message.name);

    this.isOn = false;
    this.onCharacteristic.updateValue(this.isOn);
  }
}
