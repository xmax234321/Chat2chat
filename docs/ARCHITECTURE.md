# Chat2Chat — Architecture

## Technology Stack

### Mobile (primary client)

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | **React Native + Capacitor** | Shared web UI in native shells, QR, deep links (`chat2chat://`) |
| Language | **TypeScript** | Shared types with desktop and packages |
| E2E crypto | **libsignal-client** (via `@signalapp/libsignal-client` native bindings) | Audited Double Ratchet + X3DH |
| Identity / seed | **`@chat2chat/crypto`** (shared) | BIP39 + Ed25519/X25519 via `@scure/bip39`, `@noble/curves` |
| Local storage | **SQLCipher** via `op-sqlite` or `react-native-quick-sqlite` + app-layer AES | Encrypted at rest, Keychain/Keystore for DB key |
| Secure storage | **expo-secure-store** / Keychain / Android Keystore | Ratchet session state never in plaintext |
| Transport | **`@chat2chat/transport`** over WebSocket | Shared protocol with desktop and web |

### Web client

| Layer | Choice |
|-------|--------|
| UI | **React + Vite + React Router** |
| Crypto / protocol / transport | Same `@chat2chat/*` packages (browser entry where needed) |
| Relay | Production `https://api.chat2chat.org` / `wss://api.chat2chat.org/ws`; optional dev overrides via env |

### Desktop (secondary client)

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Shell | **Electron** (macOS) | Reuse web UI; native packaging |
| UI | **React + TypeScript** | Shared with web and mobile shells |
| E2E / storage / transport | Same shared packages as mobile | One crypto implementation |
| Pairing | QR login + phone as source of truth | Desktop recover / link flows |

### Relay (external)

Clients talk to the **Chat2Chat relay** over HTTPS and WebSocket. The relay queues encrypted envelopes until delivery ACK; it does not store conversation history. Relay implementation and hosting are **not** part of this repository.

### Shared core (monorepo packages)

```
packages/crypto     — Identity, seed, fingerprints, libsignal session wrapper
packages/storage    — Encrypted SQLite abstraction
packages/protocol   — Wire format, message envelopes, sealed-sender stubs
packages/transport  — WebSocket client, send/receive/ACK flow
```

## Repository Layout

**Monorepo** (pnpm workspaces) — client apps and shared TypeScript packages.

```
chat2chat/
├── apps/
│   ├── web/           # Web UI (also embedded in mobile)
│   ├── mobile/        # Capacitor iOS / Android
│   ├── desktop/       # Electron macOS
│   ├── demo/          # CLI demo
│   └── website/       # Marketing site source
├── packages/
│   ├── crypto/
│   ├── storage/
│   ├── protocol/
│   └── transport/
└── docs/
```

## Layer Separation

```
┌─────────────────────────────────────────────────────────┐
│  UI (mobile / web / desktop apps)                       │
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
              Chat2Chat relay (encrypted transit only)
```

## Identity Model

1. Generate BIP39 mnemonic (12 words default, 24 optional).
2. Derive 64-byte seed via PBKDF2 (BIP39 standard).
3. Derive Ed25519 signing key + X25519 DH key from seed (HKDF-SHA256 domains).
4. User ID = `c2c_` + base64url(Ed25519 pubkey) + base64url(X25519 pubkey) + 4-char CRC32 checksum (~97 chars).
5. Security fingerprint = first 60 hex chars of SHA-256(full public key material) — for MITM verification.

**Recovery:** seed restores keys and ID only — not message history.

## Message Lifecycle (zero-storage on relay)

```
Sender                    Relay                      Recipient
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
- [x] Transport client (WebSocket connect, send, receive, ACK)
- [x] Protocol envelopes with padding + sealed-sender fields
- [x] Photo/video via separate HTTP blob channel
- [ ] Full libsignal Double Ratchet sessions (wrapper stubbed, integration next)
- [ ] Bluetooth pairing

## Running clients

```bash
pnpm install
pnpm build
pnpm dev:web      # browser UI (production relay by default)
pnpm demo         # CLI identities via relay (see CHAT2CHAT_SERVER)
```
