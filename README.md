# Homebridge Ntfy

[![npm](https://img.shields.io/npm/v/@eribbey/homebridge-ntfy/latest?label=latest)](https://www.npmjs.com/package/@eribbey/homebridge-ntfy)
[![npm](https://img.shields.io/npm/dt/@eribbey/homebridge-ntfy)](https://www.npmjs.com/package/@eribbey/homebridge-ntfy)

> Maintained fork of [emilof/homebridge-ntfy](https://github.com/emilof/homebridge-ntfy), published as
> [`@eribbey/homebridge-ntfy`](https://www.npmjs.com/package/@eribbey/homebridge-ntfy). Adds support for custom
> (self-hosted or SaaS) ntfy servers and authentication. The upstream project is no longer actively maintained.

This plugin allows you to send notifications through ntfy (https://ntfy.sh) directly from HomeKit. It works by creating a momentary switch, that when turned on, sends a message via ntfy. Once the message has been sent, the switch automatically returns to its off state.

Messages are sent through the official ntfy.sh server by default, but you can point the plugin at your own self-hosted or SaaS ntfy server instead. See [Custom server](#custom-server).

This is especially useful if you want to send a notification to your device when a particular event occurs. Simply create a HomeKit automation that is triggered by the desired event or condition, and set the action to turn on the switch.

## Prerequisites

- Homebridge 2.0 or later, running on Node 22, 24 or 26
- The ntfy app installed on your device
- Optional: a self-hosted or SaaS ntfy server, if you'd rather not use the official ntfy.sh server

## Installation

### Option 1: Homebridge UI

Go to the 'Plugins' page, search for `@eribbey/homebridge-ntfy`, and click 'Install'.

### Option 2: Manually

Run the following command to install the plugin globally:

    $ sudo npm install @eribbey/homebridge-ntfy -g

### Migrating from `homebridge-ntfy`

This fork uses the same platform identifier (`NtfyPlatform`) as upstream, so your existing
`platforms` config block works unchanged. To switch over:

1. Uninstall `homebridge-ntfy`.
2. Install `@eribbey/homebridge-ntfy`.
3. Restart Homebridge.

Because Homebridge caches accessories per plugin, the switches are re-created under the new
plugin. They keep the same names, but any HomeKit automations referencing them may need to be
re-pointed at the new accessories.

## Configuration

### Option 1: Homebridge UI

The easiest way to configure the plugin is to use the config UI in Homebridge. It will be displayed automatically after you've installed the plugin. If not, it can be found under the 'More Menu' `⋮` for the 'Homebridge Ntfy' plugin.

### Option 2: Manually

An alternative is to edit the Homebridge JSON config file manually by adding the following config to the `platforms` array:

```json
{
  "platform": "NtfyPlatform",
  "messages": [
    {
      "name": "Send warning message",
      "topic": "my-private-topic-9yfxy",
      "message": "Warning message text"
    }
  ]
}
```

## Config Properties

| Property              | Type      | Required | Description                                                               |
| --------------------- | --------- | -------- | ------------------------------------------------------------------------- |
| `platform`            | `string`  | Yes      | Platform identifier. **Do not change this line**                          |
| `serverUrl`           | `string`  | No       | Base URL of the ntfy server to publish to. A base path is supported for servers behind a reverse proxy, e.g. `https://home.example.com/ntfy`. Default: **https://ntfy.sh**. |
| `authType`            | `string`  | No       | Authentication method to use when publishing: `none`, `token` or `basic`. Default: **none**. [[More info](https://docs.ntfy.sh/publish/#authentication)] |
| `accessToken`         | `string`  | Yes/No   | Required if `authType` is set to `token`. [[More info](https://docs.ntfy.sh/config/#access-tokens)] |
| `username`            | `string`  | Yes/No   | Required if `authType` is set to `basic`.                                 |
| `password`            | `string`  | Yes/No   | Required if `authType` is set to `basic`.                                 |
| `messages`            | `array`   | Yes      | List of messages/switch accessories to setup in HomeKit.                  |
| └&nbsp;`name`         | `string`  | Yes      | Name of the switch shown in the Home app.                                 |
| └&nbsp;`useJson`      | `boolean` | No       | Set to `true` to use ntfy JSON format. See parameter `json`. Default: **false**. |
| └&nbsp;`topic`        | `string`  | Yes/No   | Required if `useJson` is set to `false`.                                  |
| └&nbsp;`title`        | `string`  | No       | Title of the notification sent to the device.                             |
| └&nbsp;`message`      | `string`  | No       | Message text of the notification sent to the device.                      |
| └&nbsp;`priority`     | `string` \| `number` | No | Priority of the message, either a name (`max`, `high`, `default`, `low`, `min`) or ntfy's numeric equivalent (`5`-`1`). Default: **default**. [[More info](https://docs.ntfy.sh/publish/#message-priority)] |
| └&nbsp;`tags`         | `string`  | No       | Tag message with emoji or text tag. A comma-separated list of tag names. [[More info](https://docs.ntfy.sh/emojis)] |
| └&nbsp;`json`         | `string`  | Yes/No   | Required if `useJson` is set to `true`. For advanced users ONLY. The value must be a valid JSON string (escaped) and adhere to ntfy's JSON message format. [[More info](https://docs.ntfy.sh/subscribe/api/#json-message-format)] |
| └&nbsp;`cooldownTime` | `number`  | No       | Minimum time before this message can be sent again. Default: no cooldown. |

### Example config

In the example below, two switch accessories have been configured. The first one has high priority and the second one has a emoji (tag) and cooldown set.

```json
{
  "platform": "NtfyPlatform",
  "messages": [
    {
      "name": "Send warning message",
      "topic": "my-private-topic-9yfxy",
      "title": "Warning title",
      "message": "High priority warning message",
      "priority": "high"
    },
    {
      "name": "Send alert message",
      "topic": "my-private-topic-9yfxy",
      "title": "Alert title",
      "message": "Alert with emoji that can be triggered once every 10 seconds at most",
      "tags": "warning",
      "cooldownTime": 10000
    }
  ]
}
```

## Custom server

By default the plugin publishes to the official server at `https://ntfy.sh`. Set `serverUrl` to use your own self-hosted or SaaS server instead. The URL is the base address of the server, not a topic URL — the topic from each message is appended automatically.

```json
{
  "platform": "NtfyPlatform",
  "serverUrl": "https://ntfy.home.example.com",
  "messages": [
    {
      "name": "Send warning message",
      "topic": "home-alerts",
      "message": "Warning message text"
    }
  ]
}
```

If no protocol is given, `https` is assumed. A base path is kept, so a server behind a reverse proxy such as `https://home.example.com/ntfy` works too. If the URL can't be parsed, the plugin logs an error and falls back to `https://ntfy.sh`.

### Authentication

Self-hosted servers usually have access control enabled, and the official server needs authentication for protected topics. Set `authType` to `token` or `basic` and supply the matching credentials. ([Read more](https://docs.ntfy.sh/publish/#authentication))

Using an access token:

```json
{
  "platform": "NtfyPlatform",
  "serverUrl": "https://ntfy.home.example.com",
  "authType": "token",
  "accessToken": "tk_AgQdq7mVBoFD37zQVN29RhuMzNIz2",
  "messages": [
    {
      "name": "Send warning message",
      "topic": "home-alerts",
      "message": "Warning message text"
    }
  ]
}
```

Using a username and password:

```json
{
  "platform": "NtfyPlatform",
  "serverUrl": "https://ntfy.home.example.com",
  "authType": "basic",
  "username": "homebridge",
  "password": "your-password",
  "messages": [
    {
      "name": "Send warning message",
      "topic": "home-alerts",
      "message": "Warning message text"
    }
  ]
}
```

Credentials are sent as an `Authorization` header on every request, so use `https` for any server reachable outside your local network. If the credentials are incomplete, the plugin logs an error and sends requests unauthenticated. When the server rejects the credentials, the resulting `401`/`403` is reported in the Homebridge log.

Authentication applies to JSON format messages as well.

## JSON message config

When 'Use JSON format' is enabled, you have the ability to set a custom config (JSON) for your messages. Using this format will unlock more advanced features that cannot be configured using the standard Homebridge plugin config UI. The value must be a valid JSON string and adhere to ntfy's JSON message format. ([Read more](https://docs.ntfy.sh/subscribe/api/#json-message-format)). 

Note: Use the plugin config UI when setting the JSON message config. If you're editing the Homebridge config, the JSON message config (stored in `json`) must be escaped first.

### Example JSON message config

In the example below, a message has been configured to have two action buttons. Pressing the first one opens a webpage, and pressing the second one calls a server endpoint with a pre-configured payload.

```json
{
  "topic": "my-private-topic-9yfxy",
  "title": "Adjust A/C",
  "message": "You left the house. Turn down the A/C?",
  "actions": [
    {
      "action": "view",
      "label": "Open portal",
      "url": "https://home.nest.com/",
      "clear": true
    },
    {
      "action": "http",
      "label": "Turn down",
      "url": "https://api.nest.com/",
      "body": "{\"temperature\": 65}"
    }
  ]
}
```

## Development

    $ npm install

| Script                  | Description                                                              |
| ----------------------- | ------------------------------------------------------------------------ |
| `npm run build`         | Compile TypeScript into `dist`.                                          |
| `npm run lint`          | Run ESLint across the project.                                           |
| `npm run typecheck`     | Type check sources and tests without emitting.                           |
| `npm test`              | Run the test suite once.                                                 |
| `npm run test:watch`    | Run the test suite in watch mode.                                        |
| `npm run test:coverage` | Run the suite and report coverage.                                       |
| `npm run watch`         | Build, link the plugin and run Homebridge against `./.homebridge`.       |

Tests live in `test/` and run on [vitest](https://vitest.dev). The client is exercised against a
throwaway local HTTP server rather than a mocked HTTP layer, so request URLs, headers and status
handling are covered as they actually behave. The platform is exercised against a stand-in
Homebridge API that rejects duplicate accessory UUIDs the way HAP does.

CI runs lint, typecheck, tests, a build and a package check on Node 22, 24 and 26 through Gitea
Actions (`.gitea/workflows/ci.yml`), matching the runtimes Homebridge 2.x supports.
