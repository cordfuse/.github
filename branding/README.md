# Cordfuse branding

Source-of-truth for product marks across the Cordfuse suite. One master mark
plus six product marks, each rendered from a single SVG via deterministic plexus
+ configurable centre glyph + accent color.

## Layout

```
branding/
  generate.ts                       # SVG generator (Bun)
  svg/<product>.svg                 # vector source — one per product
  png/<product>-{192,512,1024}.png  # rasterized variants
  banner/cordfuse-banner-*.png      # org-level wide banners (subreddit, social, headers)
```

Filename convention: lowercase product slug (matches the GitHub repo name) +
size suffix. No spaces, no underscores, hyphen-separated.

## Palette

| Product | Slug | Glyph | Color | Hex |
|---|---|---|---|---|
| Cordfuse (master) | `cordfuse` | `</>` | red | `#ff5555` |
| Cortex | `cortex` | `{Cx}` | blue | `#4a9eff` |
| Imprint | `imprint` | `{Im}` | purple | `#c77eff` |
| MTX | `mtx` | `{Mx}` | green | `#5fffa0` |
| Politik | `politik` | `{Pt}` | amber | `#ffc857` |
| Crosstalk | `crosstalk` | `{Ct}` | orange | `#f97316` |
| Vyzr | `vyzr` | `{Vz}` | cyan | `#22d3ee` |

## Regenerating

```bash
# Regenerate SVGs (changes to generate.ts)
bun run generate.ts

# Re-render PNGs from current SVGs (requires librsvg: brew install librsvg)
mkdir -p png
for f in svg/*.svg; do
  name=$(basename "$f" .svg)
  rsvg-convert -w 1024 "$f" -o "png/${name}-1024.png"
  rsvg-convert -w 512  "$f" -o "png/${name}-512.png"
  rsvg-convert -w 192  "$f" -o "png/${name}-192.png"
done
```

## Consuming from another repo

Reference raw URLs in READMEs, manifests, etc.:

```
https://raw.githubusercontent.com/cordfuse/.github/main/branding/png/<product>-512.png
https://raw.githubusercontent.com/cordfuse/.github/main/branding/svg/<product>.svg
https://raw.githubusercontent.com/cordfuse/.github/main/branding/banner/cordfuse-banner-desktop.png
```

## Banner

Org-level cordfuse banner (plexus + "cordfuse — tools for the AI agent era"):

- `branding/banner/cordfuse-banner-desktop.png` — wide, used on the `/r/cordfuse` subreddit header
- `branding/banner/cordfuse-banner-mobile.png` — narrower variant for mobile contexts

Currently used only on `/r/cordfuse`. Per-product banners (with each product's
`{Nn}` glyph + name) are not generated yet — extend `generate.ts` if/when needed.

For app-side consumption (Electron icons, PWA manifests, favicons), copy the
relevant size into the consuming app at the path/name that tooling expects —
do not symlink or fetch at runtime. See each app's own docs for the canonical
icon paths.
