import { PlatformConfig } from 'homebridge';

export interface NtfyPlatformConfig extends PlatformConfig {
  messages: Message[]
}

export interface Message {
  name: string,
  topic?: string,
  title?: string,
  message?: string,
  priority?: number,
  tags?: string,
  useJson?: boolean,
  json?: string;
  cooldownTime?: number,
}
