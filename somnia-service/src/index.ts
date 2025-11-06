import 'dotenv/config'
import Fastify from 'fastify'
import websocket from '@fastify/websocket'
import { SDK } from '@somnia-chain/streams'
import { createPublicClient, createWalletClient, http, defineChain } from 'viem'
import crypto from 'node:crypto'

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
  const { eventId, context = 'data', onlyPushChanges = true } = body

  // Minimal params mapping; extend based on your needs
  const initParams: any = {
    somniaStreamsEventId: eventId ?? null,
    ethCalls: [],
    context,
    onData: (data: any) => {
      // Broadcast to all ws clients
      for (const client of (app.websocketServer?.clients ?? [])) {
        try { (client as any).send(JSON.stringify({ type: 'event', data })) } catch {}
      }
    },
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
  const { somniaStreamsEventId, ethCalls = [], context = 'data', onlyPushChanges = true } = body
  const initParams: any = {
    somniaStreamsEventId: somniaStreamsEventId ?? null,
    ethCalls,
    context,
    onData: (data: any) => {
      for (const client of (app.websocketServer?.clients ?? [])) {
        try { (client as any).send(JSON.stringify({ type: 'event', data })) } catch {}
      }
    },
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

const port = Number(process.env.PORT || 3000)
app.listen({ port, host: '0.0.0.0' }).then(() => {
  console.log(`Somnia service listening on http://localhost:${port}`)
})