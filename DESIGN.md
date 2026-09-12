# DragonSim DESIGN.md — Phosphor Terminal (Modal-inspired)

> Phosphor terminal in a darkened server room — the vivid green is the only light source.

**Theme:** dark

DragonSim operates as a phosphorescent terminal in a darkened server room: near-black canvas, phosphor-pale green type, and a single vivid lime accent that behaves like an LED status indicator. The design language is developer-native — monospaced code windows with traffic-light dots, isometric 3D icons rendered in the brand green, and generous negative space that lets one element per section glow. Typography is split between a display face (Goga substitute: Inter Tight / Space Grotesk) for headlines and Inter Variable for all UI chrome, both tuned with tight negative tracking. Color is rationed: most screens are achromatic, and the vivid lime green appears only on primary actions, the logo, 3D illustrations, and emphasis moments. Components are flat and borderless, relying on hairline green-tinted borders and backdrop blur rather than shadows for depth.

Team permission: FRC 422 Mech Tech Dragons angular green-dragon mark may be used as the DragonSim logo (see `public/dragon.svg`, original interpretation). FIRST trademarks remain property of FIRST; DragonSim is unofficial.

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Void Black | `#000000` | `--color-void-black` | Page canvas, deepest background layer |
| Ground Iron | `#181818` | `--color-ground-iron` | Primary button fill, card surfaces on dark sections, base UI surface |
| Carbon Veil | `#212525` | `--color-carbon-veil` | Elevated surfaces, nav background, subtly lighter than ground |
| Circuit Border | `#485346` | `--color-circuit-border` | Outlined/ghost action border, primary interactive hairline |
| Phosphor Blue-Black | `#1f2a33` | `--color-phosphor-blue-black` | Secondary hairline borders, separators |
| Charcoal Rust | `#231c1c` | `--color-charcoal-rust` | Code-window inner panels |
| Lime Pulse | `#7fee64` | `--color-lime-pulse` | Primary brand accent — logo, hero CTA pill, tags, active states. Rationed: one per viewport |
| Phosphor White | `#ddffdc` | `--color-phosphor-white` | Primary text, headings, icon strokes, filled button text |
| Mint Frost | `#def0dd` | `--color-mint-frost` | Card tint on light sections, secondary text on dark |
| Sage 60 | `#8cab87` | `--color-sage-60` | Body copy default on dark |
| Sage 40 | `#677d64` | `--color-sage-40` | Muted helper text |
| Moss 70 | `#9cbf93` | `--color-moss-70` | Eyebrow labels, category tags |
| Moss 80 | `#aed2a4` | `--color-moss-80` | Lead paragraph, hero subhead |
| Fern Link | `#859984` | `--color-fern-link` | Inline links, tertiary nav |
| Deep Fern | `#697368` | `--color-deep-fern` | Micro-copy, footer |
| Pine 15 | `#3e4a3c` | `--color-pine-15` | Low-emphasis interactive hairline |

Quick reference: background `#000000`, surface `#181818`, elevated `#212525`, text primary `#ddffdc`, body `#8cab87`, border `#485346`, accent `#7fee64` (rationed).

## Tokens — Typography

- Display: Goga substitute **Inter Tight / Space Grotesk**, 400/500, sizes 20–64, lh 1.00–1.30, tracking −0.017em (21px) → −0.007em (48px), `ss01`.
- UI/body: **Inter Variable** (Inter), 400/500, sizes 12/14/16/20, tight tracking (−0.026em @14px, −0.022em @16px), `cv11`. Uppercase eyebrows 12px +0.05em.
- Mono: Fira Mono / JetBrains Mono for code windows, timelines, coordinates.

## Spacing & Shapes

Base 4px; scale 4–160; page max 1280px; section gap 80px; card padding 32px; element gap 20px.
Radius: cards 8px, buttons 12px, pills/tags 9999px, inputs 8px, icons 0px.
Shadow ceiling: nav only (`0px 10px 15px -3px rgba(0,0,0,.1)`). Depth otherwise via surface shifts + 1px hairlines + backdrop blur.

## Components

- Primary Filled: `#181818` bg, `#ddffdc` text/border, 12px radius. Engraved-in-dark.
- Ghost Outline: transparent, `#ddffdc` 1px border/text, 12px radius.
- Accent Pill: `#7fee64` bg, dark text, 9999px, 12–16px × 20–24px. One per viewport max.
- Ghost Link: transparent, `#485346` hairline, 9999px, `#859984` text, 14px/500.
- Nav: `#212525` + blur 10px, bottom hairline `#1f2a33`, 64px, logo left, links center, Login + Sign-Up pill right.
- Hero: `#000000` centered stack; headline 64px display (first words lime); subhead 20px Moss 80 ≤640px; Accent Pill + Ghost; single glowing 3D object with radial halo.
- Code Window: `#181818`/`#212525`, `#485346` hairline, traffic-light dots, Fira Mono (keywords lime, strings phosphor, comments sage-40).
- Capability Card: `#1f2a33`/`#181818`, 8px, 32px padding, isometric lime 3D icon top, Goga 24px title phosphor, Inter 16px sage-60 body.
- Eyebrow: 12px/500 uppercase +0.6px, Moss 70, 8–12px above heading.
- Tag: pill; lime fill = active/live only; else transparent + circuit border.
- Divider: 1px `#1f2a33`.

## Do / Don't

Do: one lime fill per viewport; `cv11`+`ss01`; body `#8cab87` on black; tight display tracking; 12px buttons / 8px cards; depth via surfaces + hairlines; 32px card padding.
Don't: lime body text; shadows beyond nav; blue/purple accents; phosphor body paragraphs; Inter display headings; pill cards; `#ffffff` / `#00ff00`.

## Surfaces / Elevation / Imagery / Layout / Motion

- L0 Void `#000000` (hero), L1 Ground `#181818`, L2 Carbon `#212525`, L3 Mint `#def0dd` (single light breath), L4 Lime `#7fee64` (emphasis only).
- Imagery: rendered geometric emissive only — glowing cube hero, isometric lime icons, terminal cards. No photography.
- Layout: full-bleed dark, 1280px containment, centered hero stack, eyebrow → heading → copy → 2-col (text+code) or 3-col cards, 80px gaps.
- Motion: 300ms ease-out for color/bg/border/fill/stroke together; spring `cubic-bezier(0.34,1.56,0.64,1)` for 3D hero only; 80s ambient rotation. No bouncy UI chrome.

## Tailwind mapping (v3)

See `tailwind.config.js`: `void-black, ground-iron, carbon-veil, circuit-border, phosphor-blue-black, lime-pulse, phosphor-white, sage-60/40, moss-70/80, fern-link, deep-fern, pine-15`. Display font `Inter Tight, Space Grotesk`; body `Inter`; mono `JetBrains Mono, Fira Mono`.
