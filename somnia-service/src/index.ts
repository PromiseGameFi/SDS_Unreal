import 'dotenv/config'
import Fastify from 'fastify'
import websocket from '@fastify/websocket'
import { SDK, zeroBytes32, SchemaEncoder } from '@somnia-chain/streams'
import { createPublicClient, createWalletClient, http, defineChain } from 'viem'
import crypto from 'node:crypto'
import { privateKeyToAccount } from 'viem/accounts'
import path from 'node:path'
import { promises as fs } from 'node:fs'

// Simple chain config via env; defaults to Somnia Testnet per docs
const CHAIN_ID = Number(process.env.CHAIN_ID || 50312)
const RPC_URL = process.env.RPC_URL || 'https://dream-rpc.somnia.network'

// viem chain definition placeholder; replace with Somnia chain params from docs
const chain = defineChain({
  id: CHAIN_ID,
  name: CHAIN_ID === 50312 ? 'Somnia Testnet' : 'Somnia',
  network: CHAIN_ID === 50312 ? 'somnia-testnet' : 'somnia',
  nativeCurrency: { name: CHAIN_ID === 50312 ? 'STT' : 'SOM', symbol: CHAIN_ID === 50312 ? 'STT' : 'SOM', decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] }, public: { http: [RPC_URL] } },
})

const publicClient = createPublicClient({ chain, transport: http(RPC_URL) })

// Wallet optional for write operations; use PRIVATE_KEY if provided
const PRIVATE_KEY = process.env.PRIVATE_KEY
const walletClient = PRIVATE_KEY
  ? createWalletClient({
      chain,
      transport: http(RPC_URL),
      account: privateKeyToAccount((PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY : (`0x${PRIVATE_KEY}`)) as `0x${string}`),
    })
  : undefined

const sdk = new SDK({ public: publicClient, wallet: walletClient })

const app = Fastify({ logger: true })
await app.register(websocket)

// In-memory subscription registry
const subs = new Map<string, { unsubscribe: () => void }>()

app.get('/health', async () => ({ status: 'ok' }))

app.get('/status', async () => ({
  chainId: CHAIN_ID,
  rpcUrl: RPC_URL,
  hasWallet: Boolean(walletClient),
}))

// WebSocket endpoint for push updates; Unreal connects here
app.register(async function (fastify) {
  fastify.get('/ws', { websocket: true }, (connection /*, req*/) => {
    connection.socket.send(JSON.stringify({ type: 'welcome' }))
    // We’ll forward subscription events to this socket when created via /subscribe
    // For demo, keep it simple; production might manage per-client routing keys
  })
})

// Create subscription via SDK and echo data to all connected WS clients
app.post('/subscribe', async (req, reply) => {
  const body = (req.body ?? {}) as any
  const { eventId, context = 'data', onlyPushChanges = true, latestOnly = false, excludeDeprecated = false, labels = [] } = body

  const latestSet = latestOnly ? buildLatestSchemaIdSet(labels) : undefined
  const forward = (payload: any) => {
    // Filter by schemaId if available
    const sid = (payload?.schemaId || payload?.stream?.schemaId || payload?.data?.schemaId) as string | undefined
    if (sid) {
      if (excludeDeprecated && isSchemaIdDeprecated(sid)) return
      if (latestSet && !latestSet.has(String(sid))) return
    }
    for (const client of (app.websocketServer?.clients ?? [])) {
      try { (client as any).send(JSON.stringify({ type: 'event', data: payload })) } catch {}
    }
  }

  const initParams: any = {
    somniaStreamsEventId: eventId ?? null,
    ethCalls: [],
    context,
    onData: (data: any) => forward(data),
    onlyPushChanges,
  }

  const subscription = await (sdk as any).streams.subscribe(initParams)
  const id = crypto.randomUUID()
  subs.set(id, { unsubscribe: () => subscription.unsubscribe() })

  return reply.send({ subscriptionId: id })
})

// Emit data/events on-chain and trigger subscriptions
app.post('/emit', async (req, reply) => {
  const body = (req.body ?? {}) as any
  const { dataStreams = [], eventStreams = [] } = body

  try {
    const result = await (sdk as any).streams.setAndEmitEvents(dataStreams, eventStreams)
    return reply.send({ ok: true, result })
  } catch (e: any) {
    return reply.status(500).send({ ok: false, error: e?.message || String(e) })
  }
})

// List active subscriptions
app.get('/subscriptions', async () => ({
  subscriptions: Array.from(subs.keys()),
}))

// Unsubscribe from a subscription by ID
app.post('/unsubscribe', async (req, reply) => {
  const body = (req.body ?? {}) as any
  const { subscriptionId } = body
  const sub = subs.get(subscriptionId)
  if (!sub) return reply.status(404).send({ ok: false, error: 'not_found' })
  try {
    sub.unsubscribe()
    subs.delete(subscriptionId)
    return reply.send({ ok: true })
  } catch (e: any) {
    return reply.status(500).send({ ok: false, error: e?.message || String(e) })
  }
})

// Alias routes under /streams/* to mirror SDK basic usage
app.post('/streams/subscribe', async (req, reply) => {
  const body = (req.body ?? {}) as any
  const { somniaStreamsEventId, ethCalls = [], context = 'data', onlyPushChanges = true, latestOnly = false, excludeDeprecated = false, labels = [] } = body

  const latestSet = latestOnly ? buildLatestSchemaIdSet(labels) : undefined
  const forward = (payload: any) => {
    const sid = (payload?.schemaId || payload?.stream?.schemaId || payload?.data?.schemaId) as string | undefined
    if (sid) {
      if (excludeDeprecated && isSchemaIdDeprecated(sid)) return
      if (latestSet && !latestSet.has(String(sid))) return
    }
    for (const client of (app.websocketServer?.clients ?? [])) {
      try { (client as any).send(JSON.stringify({ type: 'event', data: payload })) } catch {}
    }
  }

  const initParams: any = {
    somniaStreamsEventId: somniaStreamsEventId ?? null,
    ethCalls,
    context,
    onData: (data: any) => forward(data),
    onlyPushChanges,
  }
  const subscription = await (sdk as any).streams.subscribe(initParams)
  const id = crypto.randomUUID()
  subs.set(id, { unsubscribe: () => subscription.unsubscribe() })
  return reply.send({ subscriptionId: id })
})
app.post('/streams/emit', async (req, reply) => {
  const body = (req.body ?? {}) as any
  const { dataStreams = [], eventStreams = [] } = body
  try {
    const result = await (sdk as any).streams.setAndEmitEvents(dataStreams, eventStreams)
    return reply.send({ ok: true, result })
  } catch (e: any) {
    return reply.status(500).send({ ok: false, error: e?.message || String(e) })
  }
})

// Persistent schema store (label -> { schemaId, schema, parentSchemaId })
const schemasStorePath = path.join(process.cwd(), 'data', 'schemas.json')
let schemasCache: Record<string, { schemaId: `0x${string}`, schema: string, parentSchemaId: `0x${string}` }> = {}
async function loadSchemas() {
  try {
    const buf = await fs.readFile(schemasStorePath, 'utf-8')
    schemasCache = JSON.parse(buf)
  } catch {
    await fs.mkdir(path.dirname(schemasStorePath), { recursive: true })
    await fs.writeFile(schemasStorePath, '{}', 'utf-8')
    schemasCache = {}
  }
}
async function saveSchemas() {
  await fs.writeFile(schemasStorePath, JSON.stringify(schemasCache, null, 2), 'utf-8')
}
await loadSchemas()

// Versioned schema store (label -> [{ version, schemaId, schema, parentSchemaId, createdAt }])
const schemasVersionsStorePath = path.join(process.cwd(), 'data', 'schemas.versions.json')
let schemasVersionsCache: Record<string, Array<{ version: string, schemaId: `0x${string}`, schema: string, parentSchemaId: `0x${string}`, createdAt: number, deprecated?: boolean, deprecatedAt?: number }>> = {}
async function loadSchemaVersions() {
  try {
    const buf = await fs.readFile(schemasVersionsStorePath, 'utf-8')
    schemasVersionsCache = JSON.parse(buf)
  } catch {
    await fs.mkdir(path.dirname(schemasVersionsStorePath), { recursive: true })
    await fs.writeFile(schemasVersionsStorePath, '{}', 'utf-8')
    schemasVersionsCache = {}
  }
}
async function saveSchemaVersions() {
  await fs.writeFile(schemasVersionsStorePath, JSON.stringify(schemasVersionsCache, null, 2), 'utf-8')
}
await loadSchemaVersions()

// Helper to parse simple "type name" comma-separated schema strings
function parseSchemaStr(s: string): Record<string, string> {
  const map: Record<string, string> = {}
  for (const token of s.split(',').map(t => t.trim()).filter(Boolean)) {
    const m = token.match(/^([^:\s]+)[\s:]+(.+)$/)
    if (!m) continue
    const type = m[1].trim()
    const name = m[2].trim()
    if (!type || !name) continue
    map[name] = type
  }
  return map
}

// Helpers for schemaId filtering
function buildLatestSchemaIdSet(labels?: string[]): Set<string> {
  const set = new Set<string>()
  const sourceLabels = labels && labels.length ? labels : Object.keys(schemasCache)
  for (const lbl of sourceLabels) {
    const sid = schemasCache[lbl]?.schemaId
    if (sid) set.add(String(sid))
  }
  return set
}
function isSchemaIdDeprecated(sid: string): boolean {
  for (const arr of Object.values(schemasVersionsCache)) {
    for (const v of arr) {
      if (String(v.schemaId).toLowerCase() === String(sid).toLowerCase()) {
        return !!v.deprecated
      }
    }
  }
  return false
}

// Compute schemaId from a raw schema string
app.post('/schemas/compute', async (req, reply) => {
  const { schema } = (req.body ?? {}) as any
  if (!schema) return reply.status(400).send({ ok: false, error: 'schema_required' })
  try {
    const schemaId = await (sdk as any).streams.computeSchemaId(schema)
    return reply.send({ ok: true, schemaId })
  } catch (e: any) {
    return reply.status(500).send({ ok: false, error: e?.message || String(e) })
  }
})

// Register schema on-chain and save for reuse
app.post('/schemas/register', async (req, reply) => {
  const { label, schema, parentSchemaId, ignoreIfRegistered = true } = (req.body ?? {}) as any
  if (!label || !schema) return reply.status(400).send({ ok: false, error: 'label_and_schema_required' })
  try {
    const computedId = await (sdk as any).streams.computeSchemaId(schema)
    await (sdk as any).streams.registerDataSchemas([
      { id: label, schema, parentSchemaId: (parentSchemaId ?? zeroBytes32) },
    ], ignoreIfRegistered)
    schemasCache[label] = { schemaId: computedId, schema, parentSchemaId: (parentSchemaId ?? zeroBytes32) }
    await saveSchemas()
    return reply.send({ ok: true, label, schemaId: computedId })
  } catch (e: any) {
    return reply.status(500).send({ ok: false, error: e?.message || String(e) })
  }
})

// List all saved schemas
app.get('/schemas', async () => ({ ok: true, schemas: schemasCache }))

// Get one schema by label
app.get('/schemas/:label', async (req, reply) => {
  const { label } = (req.params ?? {}) as any
  const entry = schemasCache[label]
  if (!entry) return reply.status(404).send({ ok: false, error: 'not_found' })
  return reply.send({ ok: true, label, ...entry })
})

// List versions for a label
app.get('/schemas/versions/:label', async (req, reply) => {
  const { label } = (req.params ?? {}) as any
  const versions = schemasVersionsCache[label] || []
  return reply.send({ ok: true, label, versions })
})

// Get one specific version of a schema
app.get('/schemas/version/:label/:version', async (req, reply) => {
  const { label, version } = (req.params ?? {}) as any
  const versions = schemasVersionsCache[label] || []
  const entry = versions.find(v => v.version === version)
  if (!entry) return reply.status(404).send({ ok: false, error: 'not_found' })
  return reply.send({ ok: true, label, ...entry })
})

// Compute diff between two schemas (by raw schema or label+version)
app.post('/schemas/diff', async (req, reply) => {
  const { left = {}, right = {} } = (req.body ?? {}) as any
  const leftSchema: string | undefined = left.schema ?? (left.label && left.version ? (schemasVersionsCache[left.label] || []).find((v: any) => v.version === left.version)?.schema : schemasCache[left.label]?.schema)
  const rightSchema: string | undefined = right.schema ?? (right.label && right.version ? (schemasVersionsCache[right.label] || []).find((v: any) => v.version === right.version)?.schema : schemasCache[right.label]?.schema)
  if (!leftSchema || !rightSchema) return reply.status(400).send({ ok: false, error: 'left_and_right_schema_required' })
  const l = parseSchemaStr(leftSchema)
  const r = parseSchemaStr(rightSchema)
  const added: Array<{ name: string, type: string }> = []
  const removed: Array<{ name: string, type: string }> = []
  const changed: Array<{ name: string, leftType: string, rightType: string }> = []
  for (const [name, type] of Object.entries(r)) {
    if (!(name in l)) added.push({ name, type })
    else if (l[name] !== type) changed.push({ name, leftType: l[name], rightType: type })
  }
  for (const [name, type] of Object.entries(l)) {
    if (!(name in r)) removed.push({ name, type })
  }
  return reply.send({ ok: true, left: { schema: leftSchema }, right: { schema: rightSchema }, diff: { added, removed, changed } })
})

// Deprecate or restore a specific schema version
app.post('/schemas/deprecate', async (req, reply) => {
  const { label, version, deprecated = true } = (req.body ?? {}) as any
  if (!label || !version) return reply.status(400).send({ ok: false, error: 'label_and_version_required' })
  const arr = schemasVersionsCache[label] || []
  const entry = arr.find(v => v.version === version)
  if (!entry) return reply.status(404).send({ ok: false, error: 'version_not_found' })
  entry.deprecated = !!deprecated
  entry.deprecatedAt = deprecated ? Date.now() : undefined
  // persist changes
  schemasVersionsCache[label] = arr
  await saveSchemaVersions()
  return reply.send({ ok: true, label, version, deprecated: entry.deprecated })
})

// Register a new schema version, without changing the latest (unless label not set yet)
app.post('/schemas/registerVersion', async (req, reply) => {
  const { label, version, schema, parentSchemaId, ignoreIfRegistered = true } = (req.body ?? {}) as any
  if (!label || !version || !schema) return reply.status(400).send({ ok: false, error: 'label_version_schema_required' })
  try {
    const computedId = await (sdk as any).streams.computeSchemaId(schema)
    await (sdk as any).streams.registerDataSchemas([
      { id: `${label}:${version}`, schema, parentSchemaId: (parentSchemaId ?? zeroBytes32) },
    ], ignoreIfRegistered)
    const entry = { version, schemaId: computedId, schema, parentSchemaId: (parentSchemaId ?? zeroBytes32), createdAt: Date.now() }
    const arr = schemasVersionsCache[label] || []
    // Replace existing version if present
    const existingIdx = arr.findIndex(v => v.version === version)
    if (existingIdx >= 0) arr[existingIdx] = entry; else arr.push(entry)
    schemasVersionsCache[label] = arr
    await saveSchemaVersions()
    // If no latest set yet for this label, set this as latest for convenience
    if (!schemasCache[label]) {
      schemasCache[label] = { schemaId: computedId, schema, parentSchemaId: (parentSchemaId ?? zeroBytes32) }
      await saveSchemas()
    }
    return reply.send({ ok: true, label, version, schemaId: computedId })
  } catch (e: any) {
    return reply.status(500).send({ ok: false, error: e?.message || String(e) })
  }
})

// Promote a specific version to be the latest for a label
app.post('/schemas/setLatest', async (req, reply) => {
  const { label, version } = (req.body ?? {}) as any
  if (!label || !version) return reply.status(400).send({ ok: false, error: 'label_and_version_required' })
  const arr = schemasVersionsCache[label] || []
  const entry = arr.find(v => v.version === version)
  if (!entry) return reply.status(404).send({ ok: false, error: 'version_not_found' })
  schemasCache[label] = { schemaId: entry.schemaId, schema: entry.schema, parentSchemaId: entry.parentSchemaId }
  await saveSchemas()
  return reply.send({ ok: true, label, version, schemaId: entry.schemaId })
})

// Encode typed values given a label or raw schema
app.post('/schemas/encode', async (req, reply) => {
  const { label, schema, values, version } = (req.body ?? {}) as any
  const versionEntry = (label && version) ? (schemasVersionsCache[label] || []).find(v => v.version === version) : undefined
  const effectiveSchema = schema ?? versionEntry?.schema ?? schemasCache[label]?.schema
  if (!effectiveSchema) return reply.status(400).send({ ok: false, error: 'schema_or_label_required' })
  if (values == null) return reply.status(400).send({ ok: false, error: 'values_required' })
  try {
    const encoder = new SchemaEncoder(effectiveSchema)
    let encoded: any
    try {
      encoded = (encoder as any).encode?.(values)
    } catch (err) {
      if (Array.isArray(values) && (encoder as any).encodeData) {
        encoded = (encoder as any).encodeData(values)
      } else {
        throw err
      }
    }
    const schemaId = await (sdk as any).streams.computeSchemaId(effectiveSchema)
    return reply.send({ ok: true, schema: effectiveSchema, schemaId, encoded })
  } catch (e: any) {
    return reply.status(500).send({ ok: false, error: e?.message || String(e) })
  }
})

// Publish typed data: encode and call setAndEmitEvents
app.post('/data/publish', async (req, reply) => {
  const { label, schema, schemaId: schemaIdIn, values, dataId, parentSchemaId, version, allowDeprecated = false } = (req.body ?? {}) as any
  if (!walletClient) return reply.status(400).send({ ok: false, error: 'wallet_required_set_operations' })
  const versionEntry = (label && version) ? (schemasVersionsCache[label] || []).find(v => v.version === version) : undefined
  if (versionEntry?.deprecated && !allowDeprecated) {
    return reply.status(400).send({ ok: false, error: 'version_deprecated' })
  }
  const effectiveSchema = schema ?? versionEntry?.schema ?? schemasCache[label]?.schema
  const effectiveSchemaId = schemaIdIn ?? versionEntry?.schemaId ?? schemasCache[label]?.schemaId
  if (!effectiveSchema && !effectiveSchemaId) {
    return reply.status(400).send({ ok: false, error: 'schema_or_label_or_schemaId_required' })
  }
  if (values == null) return reply.status(400).send({ ok: false, error: 'values_required' })
  try {
    const schemaToUse = effectiveSchema ?? (schemasCache[label]?.schema)
    const encoder = new SchemaEncoder(schemaToUse as string)
    let encoded: any
    try {
      encoded = (encoder as any).encode?.(values)
    } catch (err) {
      if (Array.isArray(values) && (encoder as any).encodeData) {
        encoded = (encoder as any).encodeData(values)
      } else {
        throw err
      }
    }
    const finalSchemaId = effectiveSchemaId ?? await (sdk as any).streams.computeSchemaId(schemaToUse as string)
    const finalDataId = (dataId as `0x${string}`) ?? (('0x' + crypto.randomBytes(32).toString('hex')) as `0x${string}`)
    const ds = [{ schemaId: finalSchemaId, dataId: finalDataId, value: encoded, parentSchemaId: (parentSchemaId ?? zeroBytes32) }]
    const result = await (sdk as any).streams.setAndEmitEvents(ds, [])
    return reply.send({ ok: true, schemaId: finalSchemaId, dataId: finalDataId, result })
  } catch (e: any) {
    return reply.status(500).send({ ok: false, error: e?.message || String(e) })
  }
})

// Retrieve data by key, using either a label or explicit schemaId
app.post('/data/getByKey', async (req, reply) => {
  const { label, schemaId, publisher, dataId } = (req.body ?? {}) as any
  const finalSchemaId = (schemaId ?? schemasCache[label]?.schemaId)
  if (!finalSchemaId || !publisher || !dataId) {
    return reply.status(400).send({ ok: false, error: 'schemaId_or_label_publisher_dataId_required' })
  }
  try {
    const data = await (sdk as any).streams.getByKey(finalSchemaId, publisher, dataId)
    return reply.send({ ok: true, data })
  } catch (e: any) {
    return reply.status(500).send({ ok: false, error: e?.message || String(e) })
  }
})

// Publisher address helper
app.get('/publisher', async () => ({ ok: true, address: (walletClient as any)?.account?.address ?? null }))

// Simple test endpoints to validate WS broadcasting without SDK
app.get('/test/ping', async () => ({ ok: true, ts: Date.now() }))
app.post('/test/emit', async (req, reply) => {
  const body = (req.body ?? {}) as any
  const payload = body?.data ?? { hello: 'world', ts: Date.now() }
  // Broadcast to all ws clients to validate Unreal-side reception
  for (const client of (app.websocketServer?.clients ?? [])) {
    try { (client as any).send(JSON.stringify({ type: 'event', data: payload })) } catch {}
  }
  return reply.send({ ok: true })
})

const port = Number(process.env.PORT || 3000)
app.listen({ port, host: '0.0.0.0' }).then(() => {
  console.log(`Somnia service listening on http://localhost:${port}`)
})