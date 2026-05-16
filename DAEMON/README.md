# MCloud Daemon

The node-side daemon. Talks to Supabase Realtime — no inbound ports, no flaky raw WebSocket of its own.

## Channels

| Channel              | Direction | Events                                          |
|----------------------|-----------|-------------------------------------------------|
| `node:{node_id}`     | in        | `start`, `stop`, `restart`, `command`, `watch`  |
| `console:{srv_id}`   | out       | `line` `{ line, source, ts }`                   |
| `fm:{srv_id}`        | rpc       | `req` → `res` (file-manager request/response)   |

## File manager protocol

Client → daemon (`fm:{srv_id}` event `req`):
```json
{ "reqId": "uuid", "request": { "op": "list", "path": "/" } }
```

Daemon → client (`fm:{srv_id}` event `res`):
```json
{ "reqId": "uuid", "ok": true, "data": [...] }
```

Ops: `list`, `read`, `write`, `mkdir`, `delete`, `rename`.

## Hibernation

Every hour, for servers on this node:

- **Free tier + offline + idle ≥ 7 days** → status set to `hibernated`, allocation/node released. Files stay on disk.
- **Free tier + idle ≥ 30 days** → server row deleted, files wiped.

## Setup

```bash
cp .env.example .env  # fill values
npm install
npm run dev
```

Pre-stage server jars at `$SERVERS_DIR/_jars/{loader}-{version}.jar`.
