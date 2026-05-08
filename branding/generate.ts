#!/usr/bin/env bun
// Cordfuse branding SVG generator
//
// Emits master + 6 product SVGs into ./svg/, each with the same plexus background
// and circle frame, differing only in the centre glyph + accent color.
//
//   bun run generate.ts
//
// Then render PNGs with:
//   for f in svg/*.svg; do
//     name=$(basename $f .svg)
//     rsvg-convert -w 512 $f -o png/${name}-512.png
//     rsvg-convert -w 192 $f -o png/${name}-192.png
//   done

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

interface Variant {
  id:       string  // file name
  glyph:    string  // text rendered in the center (master uses </>, products use {Nn})
  color:    string  // hex accent color
  wordmark: string  // banner wordmark
  tagline:  string  // banner tagline
}

const VARIANTS: Variant[] = [
  { id: 'cordfuse',  glyph: '</>',  color: '#ff5555', wordmark: 'cordfuse',  tagline: 'tools for the AI agent era' },
  { id: 'cortex',    glyph: '{Cx}', color: '#4a9eff', wordmark: 'cortex',    tagline: 'a record protocol for the AI agent era' },
  { id: 'imprint',   glyph: '{Im}', color: '#c77eff', wordmark: 'imprint',   tagline: 'define your AI app in one file' },
  { id: 'mtx',       glyph: '{Mx}', color: '#5fffa0', wordmark: 'mtx',       tagline: 'markdown template exchange' },
  { id: 'politik',   glyph: '{Pt}', color: '#ffc857', wordmark: 'politik',   tagline: 'a governed multi-agent framework' },
  { id: 'crosstalk', glyph: '{Ct}', color: '#f97316', wordmark: 'crosstalk', tagline: 'actor-agnostic swarm communication' },
  { id: 'vyzr',      glyph: '{Vz}', color: '#22d3ee', wordmark: 'vyzr',      tagline: 'your agent. any device. no terminal.' },
]

// ── Plexus generation ─────────────────────────────────────────────────────────

const VIEW = 512                  // SVG viewBox dimensions
const CENTER = VIEW / 2
const RADIUS = VIEW / 2 - 4       // circle frame inner radius
const NODE_COUNT = 55
const LINK_DIST = 135             // connect nodes within this many px
const ACCENT_NODE_FRACTION = 0.45 // ~ 45 % of nodes glow accent-colored

// Tiny seeded PRNG (mulberry32) for deterministic plexus across runs.
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = seed
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Node { x: number; y: number; accent: boolean }

function generateNodes(seed = 42): Node[] {
  const rand = rng(seed)
  const nodes: Node[] = []
  let attempts = 0
  while (nodes.length < NODE_COUNT && attempts < NODE_COUNT * 20) {
    attempts++
    // Sample a point in the circle
    const ang = rand() * Math.PI * 2
    const r   = Math.sqrt(rand()) * (RADIUS - 12)
    const x   = CENTER + Math.cos(ang) * r
    const y   = CENTER + Math.sin(ang) * r

    // Reject if too close to an existing node (avoid clumps)
    if (nodes.some(n => Math.hypot(n.x - x, n.y - y) < 24)) continue

    nodes.push({ x, y, accent: rand() < ACCENT_NODE_FRACTION })
  }
  return nodes
}

// Square layout — uniform distribution across the full canvas, with a small
// overscan margin so synapses extend off the edges (matches the org-avatar
// aesthetic where lines run off-frame).
function generateSquareNodes(seed = 7): Node[] {
  const rand = rng(seed)
  const nodes: Node[] = []
  const SQUARE_NODE_COUNT = NODE_COUNT + 15  // denser network for full-bleed
  const overscan = 30
  let attempts = 0
  while (nodes.length < SQUARE_NODE_COUNT && attempts < SQUARE_NODE_COUNT * 20) {
    attempts++
    const x = -overscan + rand() * (VIEW + overscan * 2)
    const y = -overscan + rand() * (VIEW + overscan * 2)
    if (nodes.some(n => Math.hypot(n.x - x, n.y - y) < 22)) continue
    nodes.push({ x, y, accent: rand() < ACCENT_NODE_FRACTION })
  }
  return nodes
}

function buildPlexus(nodes: Node[]): string {
  const links: string[] = []
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y)
      if (d > LINK_DIST) continue
      // Match the org-avatar aesthetic: bright, present synapses that anchor
      // the network as a real visual element, not subtle background noise.
      const opacity = (1 - d / LINK_DIST) * 0.75 + 0.32
      links.push(
        `<line x1="${nodes[i].x.toFixed(1)}" y1="${nodes[i].y.toFixed(1)}" ` +
        `x2="${nodes[j].x.toFixed(1)}" y2="${nodes[j].y.toFixed(1)}" ` +
        `stroke="#d8dde6" stroke-width="2.0" stroke-opacity="${opacity.toFixed(3)}"/>`
      )
    }
  }

  // Match the org-avatar: large, saturated red accent nodes that read as the
  // primary visual rhythm, with paler grey nodes filling the gaps.
  const dots = nodes.map(n => {
    if (n.accent) {
      return `<circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="5.5" ` +
             `fill="#ff5555" filter="url(#nodeGlow)"/>`
    }
    return `<circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="3.0" fill="#a3acba"/>`
  })

  return [...links, ...dots].join('\n      ')
}

// ── SVG template ──────────────────────────────────────────────────────────────

function buildSvg(v: Variant, plexus: string, opts: { noPlexus?: boolean } = {}): string {
  // Glyph sizing — shorter strings get bigger font; favicon variant gets a
  // larger glyph still since there's no plexus competing for space.
  const baseSize = v.glyph.length <= 3 ? 200 : 170
  const fontSize = opts.noPlexus ? Math.round(baseSize * 1.25) : baseSize
  const fontWeight = 700
  const fontFamily = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
  const plexusBlock = opts.noPlexus ? '' : `<g opacity="0.9">
      ${plexus}
    </g>`

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW} ${VIEW}" width="${VIEW}" height="${VIEW}">
  <defs>
    <clipPath id="circleClip">
      <circle cx="${CENTER}" cy="${CENTER}" r="${RADIUS}"/>
    </clipPath>
    <radialGradient id="bgGradient" cx="50%" cy="50%" r="65%">
      <stop offset="0%"   stop-color="#222a3a"/>
      <stop offset="100%" stop-color="#0f1421"/>
    </radialGradient>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <filter id="nodeGlow" x="-200%" y="-200%" width="500%" height="500%">
      <feGaussianBlur stdDeviation="2.5" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <g clip-path="url(#circleClip)">
    <circle cx="${CENTER}" cy="${CENTER}" r="${RADIUS}" fill="url(#bgGradient)"/>
    ${plexusBlock}
    <text x="${CENTER}" y="${CENTER}"
          text-anchor="middle" dominant-baseline="central"
          font-family='${fontFamily}' font-size="${fontSize}" font-weight="${fontWeight}"
          fill="${v.color}" filter="url(#glow)">${escapeXml(v.glyph)}</text>
  </g>
  <circle cx="${CENTER}" cy="${CENTER}" r="${RADIUS}" fill="none" stroke="#2a3445" stroke-width="2"/>
</svg>
`
}

function escapeXml(s: string): string {
  return s.replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&apos;', '"': '&quot;' }[c]!))
}

// ── Square SVG template (full-bleed, no circular clip) ───────────────────────

function buildSquareSvg(v: Variant, plexus: string): string {
  const baseSize = v.glyph.length <= 3 ? 240 : 200  // larger glyph since more canvas to work with
  const fontWeight = 700
  const fontFamily = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW} ${VIEW}" width="${VIEW}" height="${VIEW}">
  <defs>
    <clipPath id="squareClip">
      <rect x="0" y="0" width="${VIEW}" height="${VIEW}"/>
    </clipPath>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <filter id="nodeGlow" x="-200%" y="-200%" width="500%" height="500%">
      <feGaussianBlur stdDeviation="2.5" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <g clip-path="url(#squareClip)">
    <rect x="0" y="0" width="${VIEW}" height="${VIEW}" fill="#0d1320"/>
    <g opacity="0.95">
      ${plexus}
    </g>
    <text x="${CENTER}" y="${CENTER}"
          text-anchor="middle" dominant-baseline="central"
          font-family='${fontFamily}' font-size="${baseSize}" font-weight="${fontWeight}"
          fill="${v.color}" filter="url(#glow)">${escapeXml(v.glyph)}</text>
  </g>
</svg>
`
}

// ── Banner SVG template ──────────────────────────────────────────────────
//
// Wide-aspect (5:1) banner for /r/<product> subreddit headers, social
// channels, README headers. Same dark navy + plexus as the icon family,
// but: text-driven (wordmark + tagline) on the centre third, plexus
// concentrated on the left and right thirds so the centre stays readable.

const BANNER_W = 4640
const BANNER_H = 928
const BANNER_NODE_COUNT = 220       // dense — wide canvas needs more nodes
const BANNER_LINK_DIST  = 220
const BANNER_OVERSCAN   = 60        // let lines bleed off the edges

interface BannerNode { x: number; y: number; accent: boolean }

// Density falls off in the centre third (where the wordmark sits).
function generateBannerNodes(seed = 99): BannerNode[] {
  const rand = rng(seed)
  const nodes: BannerNode[] = []
  const centreStart = BANNER_W * 0.32
  const centreEnd   = BANNER_W * 0.68
  let attempts = 0
  while (nodes.length < BANNER_NODE_COUNT && attempts < BANNER_NODE_COUNT * 30) {
    attempts++
    const x = -BANNER_OVERSCAN + rand() * (BANNER_W + BANNER_OVERSCAN * 2)
    const y = -BANNER_OVERSCAN + rand() * (BANNER_H + BANNER_OVERSCAN * 2)

    // Reject mostly-centre samples — keep the wordmark area sparse.
    if (x > centreStart && x < centreEnd) {
      // 90 % rejection in the centre band
      if (rand() < 0.9) continue
    }
    if (nodes.some(n => Math.hypot(n.x - x, n.y - y) < 60)) continue
    nodes.push({ x, y, accent: rand() < ACCENT_NODE_FRACTION })
  }
  return nodes
}

function buildBannerPlexus(nodes: BannerNode[], accentColor: string): string {
  const links: string[] = []
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y)
      if (d > BANNER_LINK_DIST) continue
      // Use accent color on a fraction of links (those between two accent
      // nodes) — gives the cordfuse banner's red-tinged interior a parallel
      // in vyzr's cyan banner.
      const useAccent = nodes[i].accent && nodes[j].accent
      const opacity = (1 - d / BANNER_LINK_DIST) * 0.55 + 0.18
      const stroke  = useAccent ? accentColor : '#d8dde6'
      const width   = useAccent ? 2.5 : 1.5
      links.push(
        `<line x1="${nodes[i].x.toFixed(1)}" y1="${nodes[i].y.toFixed(1)}" ` +
        `x2="${nodes[j].x.toFixed(1)}" y2="${nodes[j].y.toFixed(1)}" ` +
        `stroke="${stroke}" stroke-width="${width}" stroke-opacity="${opacity.toFixed(3)}"/>`
      )
    }
  }
  // Two node sizes: outline-only neutral nodes (small circles) vs filled
  // accent nodes (larger, with glow). The cordfuse banner has both.
  const dots = nodes.map(n => {
    if (n.accent) {
      return `<circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="14" ` +
             `fill="${accentColor}" filter="url(#bannerGlow)"/>`
    }
    return `<circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="6" ` +
           `fill="none" stroke="#a3acba" stroke-width="2"/>`
  })

  return [...links, ...dots].join('\n      ')
}

function buildBannerSvg(v: Variant): string {
  const nodes  = generateBannerNodes(99 + v.id.length)  // tiny seed variation per product
  const plexus = buildBannerPlexus(nodes, v.color)
  const cx = BANNER_W / 2
  const cy = BANNER_H / 2

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BANNER_W} ${BANNER_H}" width="${BANNER_W}" height="${BANNER_H}">
  <defs>
    <clipPath id="bannerClip">
      <rect x="0" y="0" width="${BANNER_W}" height="${BANNER_H}"/>
    </clipPath>
    <filter id="bannerGlow" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="6" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <g clip-path="url(#bannerClip)">
    <rect x="0" y="0" width="${BANNER_W}" height="${BANNER_H}" fill="#0d1320"/>
    <g opacity="0.95">
      ${plexus}
    </g>
    <text x="${cx}" y="${cy - 30}"
          text-anchor="middle" dominant-baseline="central"
          font-family="Inter, -apple-system, sans-serif" font-size="220" font-weight="600"
          fill="#e6e8ee" letter-spacing="-0.02em">${escapeXml(v.wordmark)}</text>
    <text x="${cx}" y="${cy + 130}"
          text-anchor="middle" dominant-baseline="central"
          font-family="Inter, -apple-system, sans-serif" font-size="70" font-weight="400"
          fill="#a8adb9">${escapeXml(v.tagline)}</text>
  </g>
</svg>
`
}

// ── Main ──────────────────────────────────────────────────────────────────────

const outDir = join(import.meta.dir, 'svg')
mkdirSync(outDir, { recursive: true })

const circleNodes  = generateNodes(42)
const circlePlexus = buildPlexus(circleNodes)
const squareNodes  = generateSquareNodes(7)
const squarePlexus = buildPlexus(squareNodes)

for (const v of VARIANTS) {
  // Full circle mark — used for 180+ px renders (Electron, PWA, apple-touch)
  const fullPath = join(outDir, `${v.id}.svg`)
  writeFileSync(fullPath, buildSvg(v, circlePlexus, { noPlexus: false }), 'utf8')
  console.log(`  wrote ${fullPath}`)

  // Favicon mark — no plexus, larger glyph; for ≤32 px renders + browser favicon.svg
  const favPath = join(outDir, `${v.id}-favicon.svg`)
  writeFileSync(favPath, buildSvg(v, circlePlexus, { noPlexus: true }), 'utf8')
  console.log(`  wrote ${favPath}`)

  // Square mark — full-bleed, no circular clip; for GitHub social previews,
  // org avatars, OpenGraph cards, and any context that wants a tile.
  const squarePath = join(outDir, `${v.id}-square.svg`)
  writeFileSync(squarePath, buildSquareSvg(v, squarePlexus), 'utf8')
  console.log(`  wrote ${squarePath}`)

  // Banner — wide-aspect for /r/<product>, social headers, README hero.
  // Per-product seed variation so each product's banner has its own
  // plexus arrangement instead of all being identical.
  const bannerPath = join(outDir, `${v.id}-banner.svg`)
  writeFileSync(bannerPath, buildBannerSvg(v), 'utf8')
  console.log(`  wrote ${bannerPath}`)
}

console.log(`\n${VARIANTS.length * 4} SVGs generated in ${outDir}/  (circle + favicon + square + banner)`)
