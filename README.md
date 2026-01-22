# pi-wakatime

[WakaTime](https://wakatime.com) extension for [pi coding agent](https://github.com/badlogic/pi-mono).

Track your AI-assisted coding time alongside your regular coding activity in WakaTime.

![WakaTime Dashboard](https://wakatime.com/static/img/ScreenShots/Screen-Shot-2016-03-21.png)

## Features

- 📁 **File tracking** — Tracks every file read/written/edited by the AI agent
- ⏱️ **Session tracking** — Heartbeats on session start, each turn, and shutdown
- 🔤 **Language detection** — Auto-detects 100+ programming languages
- 📂 **Project detection** — Auto-detects project from current working directory
- 🌿 **Branch detection** — Auto-detects git branch
- 🤖 **AI line changes** — Tracks lines added/removed by AI (uses WakaTime's `--ai-line-changes`)
- 🧠 **Model tracking** — Includes LLM model name in the plugin identifier
- 🏷️ **Category** — Uses `"ai coding"` category (WakaTime's built-in AI category)

## Requirements

1. **pi coding agent** — Install from [npm](https://www.npmjs.com/package/@mariozechner/pi-coding-agent) or [GitHub](https://github.com/badlogic/pi-mono)

2. **wakatime-cli** — Usually already installed if you use WakaTime in other editors. If not:
   ```bash
   # The CLI is typically at ~/.wakatime/wakatime-cli
   # Install instructions: https://wakatime.com/terminal
   ```

3. **WakaTime API key** — Configure in `~/.wakatime.cfg`:
   ```ini
   [settings]
   api_key = your-api-key-here
   ```
   Get your API key from: https://wakatime.com/settings/api-key

## Installation

### Option 1: Git clone (recommended)

Clone directly into your pi extensions directory:

```bash
git clone https://github.com/Istar-Eldritch/pi-wakatime ~/.pi/agent/extensions/wakatime
```

**Update anytime with:**
```bash
cd ~/.pi/agent/extensions/wakatime && git pull
```

### Option 2: Single file download

If you prefer not to use git:

```bash
mkdir -p ~/.pi/agent/extensions/wakatime
curl -o ~/.pi/agent/extensions/wakatime/index.ts \
  https://raw.githubusercontent.com/Istar-Eldritch/pi-wakatime/main/index.ts
```

### Option 3: Per-project installation

For project-specific use, clone into your project:

```bash
git clone https://github.com/Istar-Eldritch/pi-wakatime .pi/extensions/wakatime
```

### Option 4: Manual loading

Load explicitly when starting pi:

```bash
pi -e /path/to/pi-wakatime/index.ts
```

## Configuration

Add to `~/.pi/agent/settings.json`:

```json
{
  "wakatime": {
    "enabled": true,
    "trackFiles": true,
    "trackSessions": true,
    "category": "ai coding",
    "cliPath": "~/.wakatime/wakatime-cli"
  }
}
```

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `enabled` | `true` | Enable/disable tracking |
| `trackFiles` | `true` | Track individual file operations |
| `trackSessions` | `true` | Track session activity (turns) |
| `category` | `"ai coding"` | WakaTime category for heartbeats |
| `cliPath` | `~/.wakatime/wakatime-cli` | Path to wakatime-cli |

## Commands

The extension adds two commands to pi:

| Command | Description |
|---------|-------------|
| `/wakatime` | Show status (CLI availability, config, current session info) |
| `/wakatime-toggle` | Toggle tracking on/off for current session |

## What Gets Tracked

### In Your WakaTime Dashboard

- **Projects** — Your project directories (detected from cwd)
- **Files** — Each file the AI reads, writes, or edits
- **Languages** — Detected from file extensions
- **Categories** — Shows as "AI Coding"
- **Editors** — Shows as `pi-coding-agent/1.0.0` with model name (e.g., `anthropic/claude-sonnet-4`)
- **Branches** — Git branch (auto-detected)

### AI-Specific Metrics

WakaTime's dashboard shows AI-assisted coding separately when you use the "AI Coding" category. The extension also tracks:

- **AI line changes** — Lines added/removed by AI in write/edit operations
- **Model used** — Which LLM model performed the work

## How It Works

The extension hooks into pi's event system:

1. **`session_start`** — Sends initial heartbeat, detects project/branch
2. **`model_select`** — Tracks which model is being used
3. **`turn_start`** — Sends heartbeat for each agent turn
4. **`tool_result`** — Tracks file operations (read/write/edit)
5. **`session_shutdown`** — Sends final heartbeat

Heartbeats are sent via `wakatime-cli`, which handles:
- Rate limiting (2 min between heartbeats for same file)
- Offline queueing (heartbeats saved locally when offline)
- API communication

## Troubleshooting

### "WakaTime CLI not found"

Install wakatime-cli:
```bash
# Download latest release
curl -fsSL https://wakatime.com/terminal | sh
```

Or specify a custom path in settings:
```json
{
  "wakatime": {
    "cliPath": "/usr/local/bin/wakatime-cli"
  }
}
```

### Heartbeats not appearing in dashboard

1. Check CLI works: `~/.wakatime/wakatime-cli --today`
2. Check API key: `cat ~/.wakatime.cfg`
3. Enable debug mode: `DEBUG=1 pi` and look for `[wakatime]` messages
4. Check offline queue: `~/.wakatime/wakatime-cli --offline-count`

### Wrong project detected

Create a `.wakatime-project` file in your project root:
```
my-project-name
```

## Privacy

This extension sends the same data as any WakaTime editor plugin:
- File paths (can be obfuscated via wakatime-cli settings)
- Project names
- Language/editor info
- Timestamps

Review WakaTime's [privacy policy](https://wakatime.com/legal/privacy) for details.

To obfuscate file/project names, configure wakatime-cli:
```bash
~/.wakatime/wakatime-cli --config-write hide_file_names true
~/.wakatime/wakatime-cli --config-write hide_project_names true
```

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR on GitHub.

## See Also

- [pi coding agent](https://github.com/badlogic/pi-mono) — The AI coding agent
- [WakaTime](https://wakatime.com) — Developer time tracking
- [WakaTime API](https://wakatime.com/developers) — API documentation
- [Creating a WakaTime Plugin](https://wakatime.com/help/creating-plugin) — Plugin development guide
