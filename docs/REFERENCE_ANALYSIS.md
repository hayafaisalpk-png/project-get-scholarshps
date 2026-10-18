# Reference analysis — bold.org

Recorded **2026-10-17**. Every number in this document was measured, not guessed.

## How this was captured

`bold.org` returns **HTTP 429** to plain HTTP fetches (`webfetch`, `Invoke-WebRequest`),
so the reference was captured with Playwright driving real Chromium — the same runner
already installed for E2E tests. Six captures, all HTTP 200:

| Page | Viewports |
| --- | --- |
| `https://bold.org/` | 1440×900, 834×1112, 390×844 |
| `https://bold.org/scholarships/` | 1440×900, 834×1112, 390×844 |
| `https://bold.org/scholarships/powering-the-future-whiddon-memorial-scholarship/` | 1440×900 |

Two things were collected: screenshots for visual reading, and a computed-style
profile (a frequency tally of font/colour/radius/shadow/padding values across every
visible element) so the palette and scale are evidence rather than impression.

> This measures a *third party's production site*. It informs our design tokens and
> layout rhythm. Per `AGENTS.md` §1 no source, brand identity, editorial copy or
> visual asset is copied.

---

## Typography

**Single family: Inter.** No separate display face — the hero, headings and body are
all Inter. Headings are distinguished by weight and size, not by family.

| Role | Size | Weight | Line height |
| --- | --- | --- | --- |
| Hero H1 | 70px (87.5px) | 800 | 1.25 |
| H1 / large number | 40px (50px) | 800 | 1.25 |
| Section H2 | 32px (40px) | 800 | 1.25 |
| Card title | 18px (28px) | 600 | 1.55 |
| Body | 16px (24px) | 400 | 1.5 |
| Secondary / meta | 14px (20px) | 500 | 1.43 |
| Micro-label | 12px (12–14px) | 500 | 1.0 |

Weight distribution: `400` ×107, **`800` ×15**, `500` ×12, `600` ×7, `700` ×1.
So **800 (ExtraBold), not 700**, is the heading weight.

## Colour

| Token | Measured | Note |
| --- | --- | --- |
| Primary | `#5D57FB` | Indigo. Button fills, links, icons. Confirmed by `--tw-shadow-color: #5d57fb1a` |
| Primary tint | `rgba(93,87,251,0.10)` | Hero card fills, active chips |
| Heading / strong text | `#100826` | Near-black with a violet cast |
| Body text | `#000000` | |
| Muted text | `#76788C` | Labels, meta, icons |
| Secondary text | `#474559` | |
| Deep violet | `#1A0359` | Dark surfaces |
| Surface | `#F5F7FA` | Section backgrounds |
| Surface alt | `#F1F2F4` | |
| Border | `#F0F1F5`, `#E5E7EB`, `rgba(0,0,0,0.05)` | Hairlines do the structural work |
| Success / verified | `#18AB1A` | Verified ticks, "JUST PUBLISHED" pill |
| Gradient end | `#59C3FF` | Hero headline gradient, indigo → sky |

**Contrast note carried into our tokens:** `#76788C` on white measures **4.03:1**,
below the 4.5:1 AA threshold for body text. It is therefore used only for large or
decorative text. Our muted body token is one step darker (`#616379`, 5.9:1).

## Shape and elevation

Radii tally: `0px` ×123, `9999px` ×8, **`20px`** ×4, `8px` ×4, `4px` ×2, `40px` ×1.

- Cards and buttons are **sharp-ish**: 4px (`rounded`) and 8px.
- Chips, badges and status pills are **fully round** (`9999px`).
- Large feature panels, modals and the hero CTA cards use **20px**.
- Elevation is almost absent. The one card shadow in the whole page is
  `0 4px 6px -1px rgba(0,0,0,0.10), 0 2px 4px -2px rgba(0,0,0,0.10)` — borders and
  spacing carry the layout instead of shadows.

## Spacing and layout

- Content column: **1100px** (`max-width` ×2; one 1280px outlier).
- Hero text is width-constrained: 750px, 850px, 530px.
- Section rhythm gaps: 20, 24, 32, 36, 40px.
- Button padding: `12px 20px` primary, `6px 16px` small.
- Transitions: 0.2s / 0.3s / 0.5s.

## Header

Three layers, in order:

1. **Micro-bar** — `#100826`, ~24px tall, tiny white links. On the detail page one
   link sits in a lighter pill.
2. **Main bar** — white, logo left, 2–4 nav links centred with chevrons for
   dropdowns, then right-aligned `Login` (light grey fill) and a filled indigo CTA.
3. **Mobile** — hamburger left, logo, and **both** auth actions stay visible
   (grey pill + indigo pill). Nav links collapse into the drawer.

## Homepage composition

1. Hero on a pale indigo-tinted surface: 70px gradient headline, centred subhead,
   then two large 20px-radius tinted CTA cards (label left, circled chevron right)
   that stack on mobile.
2. **Stats band** — white, 4 columns. Each: indigo icon, a pill badge
   (`● LIVE | OCT 17`), a huge bold figure, a label, and a small indigo link.
3. **Full-bleed feature panels** — large 20px-radius photo cards, dark gradient
   overlay, centred white 40px/800 H2, paragraph, indigo pill CTA. Repeated 3×.
4. **Browse section** — centred 22px H2, then a wrapped field of pill chips
   (`9999px`, bordered) linking to categories, plus a "View all →" link.
5. **Footer** — 5 columns, tiny uppercase-grey column headings, small dark links,
   social icons, and a bottom bar with copyright left and legal links right.
6. **Sticky bottom conversion bar** — `#100826`, a live figure, a CTA, and a
   scrolling winners feed. Present on listing and detail pages.

## Listing page

A 4-across filter bar (Education level · Amount · Scholarships awarded · Next
Deadline), then **horizontal row cards** — the most distinctive pattern:

```
┌──────────────────────────────────────────────┬──────────────┐
│ [thumb 4:3]  Title 18px/600                   │  Apply to    │
│              Funded by (avatar) Name ✓        │  scholarship │
│              Description, muted               │  ─────────── │
│  ────────────────────────────────────────────│  Contribute  │
│  Education level │ Amount │ Awarded │ Deadline│              │
└──────────────────────────────────────────────┴──────────────┘
```

Measured: card `1100×256`, `border-radius: 4px`, white, `shadow-m`, no border,
`padding: 0`, `display: flex`. Content link `868px` wide with `28px` padding;
action column `232px` with `padding: 0 20px`, split from the content by a vertical
hairline. Meta columns are separated by vertical rules, each an icon above a 12px
grey label and a 16px/600 value. A green status pill overlaps the thumbnail corner.

## Detail page

Two columns: content (~660px) + sticky sidebar (~370px).

- Content: `‹ BACK` button, 40px/800 H1, `Funded by` label + 32px avatar + name +
  verified tick, then a full-column image.
- Sidebar card: huge 40px/800 amount, status pill, winner breakdown as label/value
  rows separated by hairlines, full-width indigo **Apply Now** and outlined
  **Contribute** buttons, then a 2-column grid of 11px uppercase letterspaced
  labels with bold values beneath (Application deadline · Winners announced ·
  Education level).

---

## What we adopt, and what we deliberately do not

**Adopt:** Inter-only typography with 800 headings; indigo `#5D57FB` primary with a
violet-cast near-black; 1100px content column; 4px cards / 8px buttons / 20px panels /
pill chips; hairline borders over shadows; horizontal scholarship row cards with an
icon-over-label metadata grid; two-column detail layout with a sticky key-facts
sidebar; 0.2s transitions; micro-bar + main-bar header with both auth actions
persisting on mobile.

**Do not adopt (out of scope per the amended `AGENTS.md` §1):**

- Student accounts, matched/personalised discovery, saved scholarships,
  application tracking and status — none exist here, and sign-up is closed.
- Donor profiles, donor faces and donor amounts.
- The live "total awarded" ticker and winners feed — these are real claims about
  real money, and we have no data to make them.
- Rewards, debit card, app-store badges, testimonial sections.