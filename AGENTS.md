# AI Hints for pi-wakatime Development

## 1. Development Workflow

1. **Codebase Grounding**: Before proposing a solution, explore the existing codebase.
2. **Propose Changes**: Outline files to modify, code changes, new dependencies, and expected outcome.
3. **User Review**: Wait for developer approval before implementing.
4. **Implementation**: Follow Test-Driven Development (TDD) where appropriate.
5. **Verification**: Test changes by loading the extension in pi.

## 2. Project Goal & Scope

pi-wakatime is a WakaTime extension for the [pi coding agent](https://github.com/badlogic/pi-mono). It tracks AI-assisted coding activity in WakaTime, sending heartbeats for file operations and session activity.

### What It Tracks

- **Files** — Every file read/written/edited by the AI agent
- **Sessions** — Heartbeats on session start, each turn, and shutdown
- **Languages** — Auto-detected from 100+ file extensions
- **Projects** — Detected from current working directory
- **Branches** — Auto-detected from git
- **AI line changes** — Lines added/removed by AI operations
- **Model** — Which LLM model performed the work

## 3. Technology Stack

- **Language**: TypeScript
- **Runtime**: Node.js (via pi)
- **External dependency**: wakatime-cli
- **Framework**: pi Extension API

## 4. Code Organization

The extension is a single file (`index.ts`) following pi's extension conventions:

- Default export function receiving `ExtensionAPI`
- Event handlers for session/tool lifecycle
- Commands registered via `pi.registerCommand()`
- Configuration loaded from `~/.pi/agent/settings.json`

### Key Components

| Component | Description |
|-----------|-------------|
| `LANGUAGE_MAP` | Maps file extensions to WakaTime language names |
| `WakaTimeConfig` | Configuration interface with defaults |
| `HeartbeatOptions` | Options for wakatime-cli heartbeat calls |
| Event handlers | `session_start`, `model_select`, `turn_start`, `tool_result`, `session_shutdown` |
| Commands | `/wakatime` (status), `/wakatime-toggle` (enable/disable) |

## 5. Development Patterns

### Adding New Features

When adding features, consider:

1. **Does it need a new event handler?** Check pi's available events
2. **Does it need configuration?** Add to `WakaTimeConfig` interface and `defaultConfig`
3. **Does it need a command?** Register via `pi.registerCommand()`

### Adding Language Support

Add new entries to `LANGUAGE_MAP`:

```typescript
const LANGUAGE_MAP: Record<string, string> = {
  // extension: "WakaTime Language Name"
  newext: "New Language",
};
```

### Testing Changes

```bash
# Load extension explicitly to test
pi -e ./index.ts

# Enable debug output
DEBUG=1 pi -e ./index.ts
```

## 6. External Dependencies

### wakatime-cli

The extension delegates all API communication to wakatime-cli, which handles:
- Rate limiting (2 min between heartbeats for same file)
- Offline queueing (heartbeats saved locally when offline)
- API key management (`~/.wakatime.cfg`)

### pi Extension API

See [pi documentation](https://github.com/badlogic/pi-mono) for:
- Available events (`session_start`, `turn_start`, `tool_result`, etc.)
- Context object properties (`cwd`, `hasUI`, `ui`)
- Command registration
