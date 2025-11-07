# Somnia Service Usage Guide

This service provides simple HTTP and WebSocket endpoints for working with Somnia Streams: registering schemas, publishing typed data, reading data back, and subscribing to updates. It’s designed to be consumed by the Unreal project in this repo or any HTTP client.

## Prerequisites
- Node.js 18+ installed
- .env file in somnia-service with:
  - CHAIN_ID (optional, defaults to 50312 for Somnia Testnet)
  - RPC_URL (optional, defaults to https://dream-rpc.somnia.network)
  - PRIVATE_KEY (required for write operations)

Example .env:
```
CHAIN_ID=50312
RPC_URL=https://dream-rpc.somnia.network
PRIVATE_KEY=0x<your_private_key>
```
Important: Never commit or share your PRIVATE_KEY. Keep .env out of version control.

## Install & Run
- Install dependencies:
  - `npm install`
- Development (auto reload):
  - `npm run dev`
- Production build:
  - `npm run build`
  - `npm start`

When running, the service listens on: `http://localhost:3000`

## Quick Health & Status
- Health: `GET /health` → `{ "status": "ok" }`
- Runtime status: `GET /status` → `{ chainId, rpcUrl, hasWallet }`
- Publisher address (checksummed): `GET /publisher` → `{ ok: true, address: "0x..." }`

## Schemas
Schemas define the typed fields used for encoding/decoding data.

- Register a schema:
  - `POST /schemas/register`
  - Body: `{ "label": "chat", "schema": "uint64 timestamp, string message, address sender" }`
  - Response: `{ ok: true, label, schemaId }`
- List all schemas:
  - `GET /schemas` → `{ ok: true, schemas: { [label]: { schemaId, schema, parentSchemaId } } }`
- Get one schema by label:
  - `GET /schemas/:label`
- Encode values (object-shaped values are supported):
  - `POST /schemas/encode`
  - Body: `{ "label": "chat", "values": { "timestamp": 1762545795960, "message": "hi", "sender": "0x..." } }`
  - Response: `{ ok: true, schema, schemaId, data: "0x..." }`

### Versioning (optional)
- Register version: `POST /schemas/registerVersion` with `{ label, version, schema }`
- Set latest version: `POST /schemas/setLatest` with `{ label, version }`
- List versions: `GET /schemas/versions/:label`
- Get specific version: `GET /schemas/version/:label/:version`
- Deprecate a version: `POST /schemas/deprecate` with `{ label, version, deprecated: true }`

## Publishing Data
Publishes encoded data on-chain using the configured wallet.

- `POST /data/publish`
- Body can specify `label`, or `schema`/`schemaId` explicitly. Example:
```
{
  "label": "chat",
  "values": {
    "timestamp": 1762545795960,
    "message": "hello somnia",
    "sender": "0x<checksummed_publisher_address>"
  }
}
```
Notes:
- `timestamp` should be an integer (ms since epoch) for `uint64`.
- Use a checksummed address (fetch via `GET /publisher`).
- Optional fields: `version`, `allowDeprecated`, `dataId`.
- Response: `{ ok: true, schemaId, dataId, result: "0x..." }`

## Reading Data by Key
Reads previously published data by `(schemaId, publisher, dataId)`.

- `POST /data/getByKey`
- Body:
```
{
  "schemaId": "0x...",
  "publisher": "0x...",
  "dataId": "0x..."
}
```
- Response: `{ ok: true, data: [...decoded entries...] }`
- BigInt fields are serialized as strings to avoid JSON issues.

## WebSocket & Subscriptions
- Connect WebSocket: `ws://localhost:3000/ws`
- Create subscription via HTTP:
  - `POST /subscribe` with `{ eventId, context, onlyPushChanges, latestOnly, excludeDeprecated, labels }`
  - All events received for the subscription are forwarded to connected WebSocket clients.
- Alias routes exist under `/streams/*` for SDK-like usage (`POST /streams/subscribe`, `POST /streams/emit`).

## Example: Publish & Read Script (PowerShell)
There is a helper script that publishes a chat message and immediately reads it back:
- Path: `scripts/publish.ps1`
- Run: `powershell -NoProfile -File "D:\Github\SDSUnreal\somnia-service\scripts\publish.ps1"`
- It will print the request, publish response, read response, and a verification line.

## Troubleshooting
- Address invalid:
  - Ensure you are using the checksummed address from `GET /publisher`.
- `uint64` errors:
  - Use integer millisecond timestamps (no decimals).
- JSON BigInt errors:
  - The service converts BigInt values to strings. Ensure your client expects strings for large integers.
- Deprecated version:
  - If a schema version is deprecated, either switch to latest or set `allowDeprecated: true` when publishing.

## Unreal Integration
The Unreal project includes Blueprint async nodes that call these endpoints (base URL defaults to `http://localhost:3000`). You can call Health, Status, Schemas*, DataPublish, DataGetByKey, and subscribe to streams, then receive push data via `/ws`.

## Security
- Treat your PRIVATE_KEY as a secret. Do not commit `.env` to version control.
- Rotate keys and use test keys for development.