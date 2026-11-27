/** Host half of the Shuguang pet: serves the built WebP animations and manifest. */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PREFIX = '/dsh-shuguang-wish-pet/assets'
const ASSET_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'assets/pet')
const TYPES = {
  '.webp': 'image/webp',
  '.json': 'application/json; charset=utf-8',
}

function send(res, status, type, body) {
  res.statusCode = status
  res.setHeader('Content-Type', type)
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.end(body)
}

export const inject = ['webServer']

export function apply(ctx) {
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: PREFIX,
    handler: async (req, res) => {
      const method = String(req.method || 'GET').toUpperCase()
      if (method !== 'GET' && method !== 'HEAD') {
        send(res, 405, 'text/plain; charset=utf-8', 'method not allowed')
        return
      }
      let rel
      try {
        rel = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname)
          .slice(PREFIX.length)
          .replace(/^\/+/, '')
      } catch {
        send(res, 400, 'text/plain; charset=utf-8', 'bad path')
        return
      }
      if (!rel) {
        send(res, 404, 'text/plain; charset=utf-8', 'not found')
        return
      }
      const type = TYPES[path.extname(rel).toLowerCase()]
      if (type === undefined) {
        send(res, 404, 'text/plain; charset=utf-8', 'not found')
        return
      }
      const file = path.resolve(ASSET_ROOT, rel)
      if (file !== ASSET_ROOT && !file.startsWith(ASSET_ROOT + path.sep)) {
        send(res, 403, 'text/plain; charset=utf-8', 'forbidden')
        return
      }
      let bytes
      try {
        bytes = await fs.readFile(file)
      } catch {
        send(res, 404, 'text/plain; charset=utf-8', 'not found')
        return
      }
      res.statusCode = 200
      res.setHeader('Content-Type', type)
      res.setHeader('Cache-Control', 'no-store')
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.end(method === 'HEAD' ? undefined : bytes)
    },
  }))
}
