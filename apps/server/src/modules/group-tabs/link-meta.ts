import { lookup } from 'node:dns'
import http from 'node:http'
import https from 'node:https'
import { BlockList, isIP, type LookupFunction } from 'node:net'
import type { LinkMetaDto } from '@gonggong/protocol'

const TIMEOUT_MS = 5000
const MAX_BYTES = 512 * 1024
const MAX_REDIRECTS = 3

// Anything but the public internet: a member must not make the server probe its own network (SSRF).
const blocked = new BlockList()
for (const [net, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 3],
] as const)
  blocked.addSubnet(net, prefix, 'ipv4')
for (const [net, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const)
  blocked.addSubnet(net, prefix, 'ipv6')

export function isPublicAddress(address: string) {
  const family = isIP(address)
  if (family === 0) return false
  const mapped = family === 6 && /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)
  if (mapped) return !blocked.check(mapped[1]!, 'ipv4')
  return !blocked.check(address, family === 4 ? 'ipv4' : 'ipv6')
}

// Checked at connect time, so a name re-resolving to a private address after a check can't slip through.
const publicLookup: LookupFunction = (host, options, cb) =>
  lookup(host, { ...options, all: true }, (err, addresses) => {
    if (err) return cb(err, '', 0)
    const bad = addresses.find((a) => !isPublicAddress(a.address))
    if (bad) return cb(new Error(`blocked address ${bad.address}`), '', 0)
    if (options.all) return (cb as (e: null, a: typeof addresses) => void)(null, addresses)
    cb(null, addresses[0]!.address, addresses[0]!.family)
  })

type Page = { url: URL; headers: http.IncomingHttpHeaders; html: string }

function get(
  url: URL,
  allowPrivate: boolean,
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = (url.protocol === 'https:' ? https : http).get(
      url,
      {
        timeout: TIMEOUT_MS,
        headers: {
          'user-agent': 'Mozilla/5.0 (compatible; GonggongLinkPreview/1.0)',
          accept: 'text/html,*/*;q=0.5',
        },
        ...(allowPrivate ? {} : { lookup: publicLookup }),
      },
      (res) => {
        const chunks: Buffer[] = []
        let size = 0
        const done = () => {
          const charset = /charset=([\w-]+)/i.exec(res.headers['content-type'] ?? '')?.[1] ?? 'utf-8'
          let decoder: TextDecoder
          try {
            decoder = new TextDecoder(charset)
          } catch {
            decoder = new TextDecoder()
          }
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: decoder.decode(Buffer.concat(chunks)),
          })
        }
        res.on('data', (c: Buffer) => {
          chunks.push(c)
          size += c.length
          if (size >= MAX_BYTES) {
            res.destroy()
            done()
          }
        })
        res.on('end', done)
        res.on('error', reject)
      },
    )
    req.on('timeout', () => req.destroy(new Error('timeout')))
    req.on('error', reject)
  })
}

async function fetchPage(start: URL, allowPrivate: boolean): Promise<Page | null> {
  let url = start
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (
      !allowPrivate &&
      isIP(url.hostname.replace(/^\[|\]$/g, '')) &&
      !isPublicAddress(url.hostname.replace(/^\[|\]$/g, ''))
    )
      return null
    const res = await get(url, allowPrivate)
    const location = res.headers.location
    if (res.status >= 300 && res.status < 400 && location) {
      url = new URL(location, url)
      continue
    }
    return { url, headers: res.headers, html: res.body }
  }
  return null
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
const decode = (s: string) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(Number.parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&(\w+);/g, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim()

const attr = (tag: string, name: string) =>
  new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i')
    .exec(tag)
    ?.slice(1)
    .find((v) => v !== undefined)

/** Title and favicon of an HTML page; og:title when it has no <title>. */
export function parseMeta(html: string, base: URL): { title: string | null; icon: string } {
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]
  const og = [...html.matchAll(/<meta\b[^>]*>/gi)]
    .map((m) => m[0])
    .find((t) => /property\s*=\s*["']?og:title/i.test(t))
  const icon = [...html.matchAll(/<link\b[^>]*>/gi)]
    .map((m) => m[0])
    .find((t) => /\brel\s*=\s*["']?[^"'>]*\bicon\b/i.test(t))
  const href = icon && attr(icon, 'href')
  let iconUrl = new URL('/favicon.ico', base).href
  if (href)
    try {
      iconUrl = new URL(decode(href), base).href
    } catch {}
  const text = decode(title ?? (og && attr(og, 'content')) ?? '')
  return { title: text || null, icon: iconUrl }
}

/** Whether the page lets other sites frame it (X-Frame-Options, CSP frame-ancestors). */
export function embeddable(headers: http.IncomingHttpHeaders) {
  if (headers['x-frame-options']) return false
  const csp = [headers['content-security-policy']].flat().join(';')
  const ancestors = /frame-ancestors([^;]*)/i.exec(csp)?.[1]?.trim().split(/\s+/)
  return !ancestors || ancestors.includes('*')
}

/** What a link tab shows. Unreadable pages (blocked, down, not HTML) still make a tab: no title, try framing. */
export async function linkMeta(url: string, opts: { allowPrivate?: boolean } = {}): Promise<LinkMetaDto> {
  const start = new URL(url)
  const fallback = { title: null, icon: null, embeddable: true }
  const page = await fetchPage(start, opts.allowPrivate ?? false).catch(() => null)
  if (!page) return fallback
  const meta = parseMeta(page.html, page.url)
  return { ...meta, embeddable: embeddable(page.headers) }
}
