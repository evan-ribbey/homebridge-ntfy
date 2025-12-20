# Homebridge Ntfy

[![npm](https://img.shields.io/npm/v/homebridge-ntfy/latest?label=latest)](https://www.npmjs.com/package/homebridge-ntfy)
[![npm](https://img.shields.io/npm/dt/homebridge-ntfy)](https://www.npmjs.com/package/homebridge-ntfy)

This plugin allows you to send notifications through ntfy.sh (https://ntfy.sh) directly from HomeKit. It works by creating a momentary switch, that when turned on, sends a message via ntfy.sh. Once the message has been sent, the switch automatically returns to its off state.

This is especially useful if you want to send a notification to your device when a particular event occurs. Simply create a HomeKit automation that is triggered by the desired event or condition, and set the action to turn on the switch.

## Prerequisites

- Homebridge installed
- The ntfy app installed on your device

## Installation

### Option 1: Homebridge UI

Go to the 'Plugins' page, search for `homebridge-ntfy`, and click 'Install'.

### Option 2: Manually

Run the following command to install the plugin globally:

    $ sudo npm install homebridge-ntfy -g

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
| `messages`            | `array`   | Yes      | List of messages/switch accessories to setup in HomeKit.                  |
| └&nbsp;`name`         | `string`  | Yes      | Name of the switch shown in the Home app.                                 |
| └&nbsp;`useJson`      | `boolean` | No       | Set to `true` to use ntfy JSON format. See parameter `json`. Default: **false**. |
| └&nbsp;`topic`        | `string`  | Yes/No   | Required if `useJson` is set to `false`.                                  |
| └&nbsp;`title`        | `string`  | No       | Title of the notification sent to the device.                             |
| └&nbsp;`message`      | `string`  | No       | Message text of the notification sent to the device.                      |
| └&nbsp;`priority`     | `string`  | No       | Priority of the message. Default: **default**. [[More info](https://docs.ntfy.sh/publish/#message-priority)] |
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

## Future Plans

- Custom server - Support for configuring a custom server URL, allowing use of a SaaS or self-hosted server instead of the default ntfy.sh server.
- Authentication - Configure auth credentials (username/password or access token) to be used with servers that have access control enabled.