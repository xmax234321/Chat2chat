# Chat2Chat iOS (Capacitor)

Native iOS shell around the phone UI from `apps/web`.

## Requirements

- macOS with **Xcode 15+**
- Apple Developer account (for device / TestFlight)
- Node 20+, pnpm

## Run on simulator

```bash
# from repo root
pnpm install
pnpm ios
```

This builds the web app, syncs to `ios/`, and opens Xcode. Press **Run** (▶) in Xcode.

Or one command:

```bash
pnpm ios:run
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm ios` | Build web → sync → open Xcode |
| `pnpm ios:run` | Build web → sync → run on simulator |
| `pnpm --filter @chat2chat/mobile sync` | Re-sync after web changes |

## Account creation

**Only on phone/iOS.** Desktop (Electron / computer layout) shows recover + link only.

## Relay server

Default production relay: `https://api.chat2chat.org` (set in `build:web` script).

For local dev relay, set `VITE_CHAT2CHAT_DEV_RELAY_HTTP` / `VITE_CHAT2CHAT_DEV_RELAY_WS` in `apps/web/.env.development`.

## Deep links

URL scheme: `chat2chat://` (configured in Xcode after `cap sync`).
