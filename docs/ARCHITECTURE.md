# Chat2Chat — Architecture

## Technology Stack

### Mobile (primary client)

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | **React Native + Expo** | QR scanning, deep links (`chat2chat://`), Bluetooth LE (expo-bluetooth / react-native-ble-plx), single codebase for iOS/Android |
| Language | **TypeScript** | Shared types with desktop and server |
| E2E crypto | **libsignal-client** (via `@signalapp/libsignal-client` native bindings) | Audited Double Ratchet + X3DH |
| Identity / seed | **`@chat2chat/crypto`** (shared) | BIP39 + Ed25519/X25519 via `@scure/bip39`, `@noble/curves` |
| Local storage | **SQLCipher** via `op-sqlite` or `react-native-quick-sqlite` + app-layer AES | Encrypted at rest, Keychain/Keystore for DB key |
| Secure storage | **expo-secure-store** / Keychain / Android Keystore | Ratchet session state never in plaintext |
| Transport | **`@chat2chat/transport`** over WebSocket | Same protocol as desktop |

### Desktop (secondary client)

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Shell | **Tauri 2** (Rust shell + WebView) | Smaller attack surface than Electron; native Bluetooth on pairing |
| UI | **React + TypeScript** | Reuse components and shared packages |
| E2E / storage / transport | Same shared packages as mobile | One crypto implementation |
| Pairing | QR login + initial **Bluetooth** key transfer (Tauri BLE plugin) | Phone is source of truth |

### Server (zero-storage relay)

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Runtime | **Node.js 20+** | `@signalapp/libsignal-client` bindings, fast iteration |
| HTTP / WS | **Fastify** + `@fastify/websocket` | Low overhead, typed plugins |
| Ephemeral queue | **In-memory Map** (dev) → **Redis with TTL** (prod) | Messages exist only until delivery ACK |
| File relay | Separate **S3-compatible presigned** or dedicated blob endpoint | Does not block text message queue |
| Language | **TypeScript** | Shared protocol types with clients |

### Shared core (monorepo packages)

```
packages/crypto     — Identity, seed, fingerprints, libsignal session wrapper
packages/storage    — Encrypted SQLite abstraction
packages/protocol   — Wire format, message envelopes, sealed-sender stubs
packages/transport  — WebSocket client, send/receive/ACK flow
```

## Repository Layout

**Monorepo** (pnpm workspaces) — one repo, shared TypeScript packages, separate app shells.

```
chat2chat/
├── apps/
│   ├── server/          # Zero-storage relay
│   ├── mobile/          # React Native (Expo) — shell
│   ├── desktop/         # Tauri — shell
│   └── demo/            # CLI demo of identity + messaging
├── packages/
│   ├── crypto/
│   ├── storage/
│   ├── protocol/
│   └── transport/
└── docs/
```

## Layer Separation (§8)

```
┌─────────────────────────────────────────────────────────┐
│  UI (mobile / desktop apps)                             │
├─────────────────────────────────────────────────────────┤
│  Multi-device sync (phone ↔ desktop)     [future]     │
├─────────────────────────────────────────────────────────┤
│  @chat2chat/transport — delivery, ACK, sealed sender  │
├─────────────────────────────────────────────────────────┤
│  @chat2chat/crypto — Double Ratchet, identity, seed     │
├─────────────────────────────────────────────────────────┤
│  @chat2chat/storage — encrypted local message DB        │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
                   Relay server (no persistence)
```

## Identity Model

1. Generate BIP39 mnemonic (12 words default, 24 optional).
2. Derive 64-byte seed via PBKDF2 (BIP39 standard).
3. Derive Ed25519 signing key + X25519 DH key from seed (HKDF-SHA256 domains).
4. User ID = `c2c_` + base64url(Ed25519 pubkey) + base64url(X25519 pubkey) + 4-char CRC32 checksum (~97 chars).
5. Security fingerprint = first 60 hex chars of SHA-256(full public key material) — for MITM verification.

**Recovery:** seed restores keys and ID only — not message history.

## Message Lifecycle (zero-storage)

```
Sender                    Server                     Recipient
  │ encrypt (ratchet)       │                            │
  │──── sealed envelope ───►│ store in ephemeral queue   │
  │                         │──── push via WebSocket ───►│
  │                         │                            │ decrypt + save local DB
  │                         │◄──── delivery ACK ─────────│
  │                         │ delete message             │
```

## What Is Implemented in v0.1

- [x] Identity generation (seed → keys → ID → fingerprint)
- [x] Seed confirmation flow types
- [x] Encrypted local storage (AES-256-GCM + SQLite)
- [x] Minimal relay server (in-memory queue, delete on ACK)
- [x] Transport client (WebSocket connect, send, receive, ACK)
- [x] Protocol envelopes with padding + sealed-sender fields
- [x] Photo/video via separate HTTP blob channel (`PUT/GET /blob`, `blob_ack`)
- [ ] Full libsignal Double Ratchet sessions (wrapper stubbed, integration next)
- [ ] Mobile / desktop UI
- [ ] Bluetooth pairing

## Running

```bash
pnpm install
pnpm build
pnpm dev:server    # relay on :3847
pnpm demo           # two CLI identities exchange a message
```
