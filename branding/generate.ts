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
  id:    string  // file name
  glyph: string  // text rendered in the center (master uses </>, products use {Nn})
  color: string  // hex accent color
}

const VARIANTS: Variant[] = [
  { id: 'cordfuse',  glyph: '</>',  color: '#ff5555' },  // master
  { id: 'cortex',    glyph: '{Cx}', color: '#4a9eff' },
  { id: 'imprint',   glyph: '{Im}', color: '#c77eff' },
  { id: 'mtx',       glyph: '{Mx}', color: '#5fffa0' },
  { id: 'politik',   glyph: '{Pt}', color: '#ffc857' },
  { id: 'crosstalk', glyph: '{Ct}', color: '#f97316' },
  { id: 'vyzr',      glyph: '{Vz}', color: '#22d3ee' },
]

// ── Plexus generation ─────────────────────────────────────────────────────────

const VIEW = 512                  // SVG viewBox dimensions
const CENTER = VIEW / 2
const RADIUS = VIEW / 2 - 4       // circle frame inner radius
const NODE_COUNT = 38
const LINK_DIST = 130             // connect nodes within this many px
const ACCENT_NODE_FRACTION = 0.35 // ~ 35 % of nodes glow accent-colored

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
    if (nodes.some(n => Math.hypot(n.x - x, n.y - y) < 30)) continue

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
      const opacity = (1 - d / LINK_DIST) * 0.45 + 0.05
      links.push(
        `<line x1="${nodes[i].x.toFixed(1)}" y1="${nodes[i].y.toFixed(1)}" ` +
        `x2="${nodes[j].x.toFixed(1)}" y2="${nodes[j].y.toFixed(1)}" ` +
        `stroke="#ffffff" stroke-width="0.6" stroke-opacity="${opacity.toFixed(3)}"/>`
      )
    }
  }

  const dots = nodes.map(n => {
    const fill = n.accent ? '#ff5555' : '#5a6577'
    const r    = n.accent ? 2.4 : 1.6
    return `<circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${r}" fill="${fill}"/>`
  })

  return [...links, ...dots].join('\n      ')
}

// ── SVG template ──────────────────────────────────────────────────────────────

function buildSvg(v: Variant, plexus: string): string {
  // Glyph sizing: shorter strings get bigger font.
  const fontSize = v.glyph.length <= 3 ? 200 : 170
  const fontWeight = 700
  const fontFamily = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'

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
  </defs>

  <g clip-path="url(#circleClip)">
    <circle cx="${CENTER}" cy="${CENTER}" r="${RADIUS}" fill="url(#bgGradient)"/>
    <g opacity="0.9">
      ${plexus}
    </g>
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

// ── Main ──────────────────────────────────────────────────────────────────────

const outDir = join(import.meta.dir, 'svg')
mkdirSync(outDir, { recursive: true })

const nodes  = generateNodes(42)
const plexus = buildPlexus(nodes)

for (const v of VARIANTS) {
  const path = join(outDir, `${v.id}.svg`)
  writeFileSync(path, buildSvg(v, plexus), 'utf8')
  console.log(`  wrote ${path}`)
}

console.log(`\n${VARIANTS.length} SVGs generated in ${outDir}/`)
