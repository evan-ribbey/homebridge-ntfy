import type { Characteristic, CharacteristicValue, Logger, PlatformAccessory, Service } from 'homebridge';
import type { NtfyClient } from './ntfy-client.js';
import type { NtfyPlatform } from './platform.js';
import type { Message } from './types.js';
import { wait } from './utils.js';

export class SwitchAccessory {
  private log: Logger;
  private service: Service;
  private onCharacteristic: Characteristic;

  private isOn = false;
  private inCooldown = false;

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

    if (this.inCooldown) {
      this.log.info('Still in cooldown:', this.message.name);
      await wait(250);
      this.resetSwitch();
      return;
    }

    if (this.isOn) {
      this.triggerCooldown(this.message.cooldownTime);
      await this.sendMessage();
      this.resetSwitch();
    }
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
    
    await this.ntfyClient.sendMessage(request);
    
    this.log.info('Message sent:', this.message.name);
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
