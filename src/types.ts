import { PlatformConfig } from 'homebridge';

export type AuthType = 'none' | 'token' | 'basic';

export interface NtfyPlatformConfig extends PlatformConfig {
  serverUrl?: string,
  authType?: AuthType,
  accessToken?: string,
  username?: string,
  password?: string,
  messages: Message[]
}

export interface NtfyAuth {
  type: Exclude<AuthType, 'none'>,
  accessToken?: string,
  username?: string,
  password?: string,
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
