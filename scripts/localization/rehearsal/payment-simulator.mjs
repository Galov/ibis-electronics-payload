// Loopback-only, memory-only payment simulator. No real credentials or bank requests.
import http from 'node:http'
import { randomUUID } from 'node:crypto'
const orders = new Map()
http
  .createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1:3112')
    if (req.method === 'POST' && url.pathname === '/api/orders') {
      let body = ''
      for await (const chunk of req) {
        body += chunk
        if (body.length > 20000) {
          res.writeHead(413).end()
          return
        }
      }
      const input = JSON.parse(body),
        id = `local-${randomUUID()}`,
        transactionID = input.description?.match(/order (\w+)$/)?.[1]
      if (!transactionID || input.currency !== 'EUR' || !Number.isInteger(input.amount)) {
        res.writeHead(400).end()
        return
      }
      const order = {
        id,
        public_id: id,
        state: 'pending',
        checkout_url: `http://127.0.0.1:3112/pay/${id}`,
        amount: input.amount,
        currency: input.currency,
        transactionID,
        email: input.customer?.email,
      }
      orders.set(id, order)
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(order))
      return
    }
    if (req.method === 'GET' && url.pathname.startsWith('/api/orders/')) {
      const order = orders.get(url.pathname.slice('/api/orders/'.length))
      res
        .writeHead(order ? 200 : 404, { 'Content-Type': 'application/json' })
        .end(JSON.stringify(order || {}))
      return
    }
    if (req.method === 'GET' && url.pathname.startsWith('/pay/')) {
      const id = url.pathname.slice('/pay/'.length),
        order = orders.get(id)
      if (!order) {
        res.writeHead(404).end()
        return
      }
      res
        .writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
        .end(
          `<!doctype html><html lang="en"><title>Local payment simulator</title><h1>Local test payment — no bank connection</h1><p>Test total: ${(order.amount / 100).toFixed(2)} EUR</p><form method="POST" action="/complete/${id}"><button>Complete local test payment</button></form></html>`,
        )
      return
    }
    if (req.method === 'POST' && url.pathname.startsWith('/complete/')) {
      const order = orders.get(url.pathname.slice('/complete/'.length))
      if (!order) {
        res.writeHead(404).end()
        return
      }
      order.state = 'completed'
      const params = new URLSearchParams({
        provider: 'revolut',
        transactionID: order.transactionID,
        ...(order.email ? { customerEmail: order.email } : {}),
      })
      res
        .writeHead(303, { Location: `http://127.0.0.1:3110/en/checkout/confirm-order?${params}` })
        .end()
      return
    }
    res.writeHead(404).end()
  })
  .listen(3112, '127.0.0.1', () =>
    console.log('Local payment simulator: 127.0.0.1:3112 (no bank connection)'),
  )
