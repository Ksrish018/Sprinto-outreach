# Sprinto Ops: Tokens

All values come from `design-model.yaml`. Observed values were read from sprinto.com computed styles on 3 Nov 2026.

## 1. Fonts

| Role | Family | Weights | Why |
|---|---|---|---|
| Display + body | Instrument Sans | 400, 500, 600, 700 | Sprinto's own face on every element of its site. Grotesque with slightly condensed proportions; tight tracking at large sizes reads confident without shouting. |
| Mono | IBM Plex Mono | 400, 500 | Only for URLs, domains and quoted source text, so evidence looks different from prose. |

`mono_for_code: true`, `mono_for_metrics: false`: counts, scores and dates stay in Instrument Sans with tabular figures.

## 2. Type scale

| Token | Size | Line Height | Letter Spacing | Weight | Use |
|---|---|---|---|---|---|
| `--display` | 36px | 1.1 | -0.03em | 500 | Page titles: "This week", "Drafts and Why" |
| `--heading` | 24px | 1.15 | -0.02em | 500 | Section titles, company name in dossier |
| `--subheading` | 18px | 1.3 | -0.01em | 600 | Card titles, email subject |
| `--body` | 15px | 1.5 | 0 | 400 | Email text, reasons, table cells |
| `--body-sm` | 13px | 1.45 | 0 | 400 | Secondary meta, source captions |
| `--caption` | 12px | 1.4 | 0 | 400 | Timestamps, helper text |
| `--label` | 11px | 1.2 | 0.08em | 600 | UPPERCASE micro-tags and column headers |

## 3. Colour

**Primitives**

| Ramp | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| neutral (warm) | #FCF7F5 | #F6F5F2 | #EDE7E4 | #DDD5D2 | #BFBABD | #8C8487 | #5E5759 | #443E41 | #2B2528 | #141012 | #0C090A |
| plum (brand) | #FBF0F5 | #F5DCE8 | #E9B6CF | #D486AE | #B24E85 | #650A41 | #560837 | #46062D | #370523 | #280319 | #1A0210 |

Accents: lilac 100 #EBE2FE; lime 300 #DCF07F; salmon 50 #FCF2EE, 100 #FAE8E1; memory orange #E8912D.

**Semantic: light (primary)**

| Token | Value | Role |
|---|---|---|
| `--background` | #FCF7F5 | Page canvas (cream) |
| `--surface1` | #FFFFFF | Cards |
| `--surface2` | #F6F5F2 | Table header, skeletons |
| `--surface3` | #FCF2EE | Quote wells, inputs at rest |
| `--border` | #EDE7E4 | Hairlines |
| `--border-visible` | #DDD5D2 | Input borders, dividers that matter |
| `--text1` | #141012 | Headings and body |
| `--text2` | #443E41 | Secondary text |
| `--text3` | #8C8487 | Timestamps, placeholders |
| `--text4` | #BFBABD | Disabled |
| `--accent` | #650A41 | Primary buttons, links, active nav |
| `--accent-subtle` | #EBE2FE | Secondary pill buttons, selected row |
| `--highlight` | #DCF07F | Proven: verified fact, Go (only on plum or as a dot) |
| `--tag-bg` | #FAE8E1 | Micro-tags |
| `--memory` | #E8912D | Loop 3 learning marks |

**Semantic: dark**

| Token | Value |
|---|---|
| `--background` | #1A0210 |
| `--surface1` | #280319 |
| `--surface2` | #370523 |
| `--surface3` | #46062D |
| `--border` | #370523 |
| `--border-visible` | #46062D |
| `--text1` | #FCF7F5 |
| `--text2` | #BFBABD |
| `--text3` | #8C8487 |
| `--text4` | #5E5759 |
| `--accent` | #DCF07F (lime becomes the interactive colour on plum) |
| `--accent-subtle` | #370523 |

**Status** (foreground stays 500 in both modes; tint is 50 in light, 900 in dark)

| Token | Value | Light bg | Dark bg |
|---|---|---|---|
| `--success` | #2E8B57 | #EFF8F1 | #123A24 |
| `--warning` | #D9821E | #FFF6EA | #5A3409 |
| `--error` | #C8323B | #FDF1F1 | #5C1418 |

## 4. Spacing

| Token | Value | Use |
|---|---|---|
| `--space-2xs` | 2px | Hairline offsets |
| `--space-xs` | 4px | Inside chips |
| `--space-sm` | 8px | Between related items |
| `--space-md` | 16px | Card padding (compact), row padding |
| `--space-lg` | 24px | Card padding, gap between cards |
| `--space-xl` | 32px | Page gutter |
| `--space-2xl` | 48px | Between page sections |
| `--space-3xl` | 64px | Empty-state breathing room |
| `--space-4xl` | 96px | Not used in the console |

## 5. Radii

Corner philosophy: soft cards, pill controls (observed: 100px CTAs, 8px dominant, 12px cards).

| Token | Value | Use |
|---|---|---|
| `--radius-element` | 4px | Tags, checkboxes |
| `--radius-component` | 8px | Inputs, table rows, small cards |
| `--radius-container` | 12px | Cards, drawers, modals |
| `--radius-panel` | 24px | Kill banner, large panels |
| `--radius-control` | 999px | Every button and segmented control |

## 6. Elevation

Strategy: **subtle**.

| Token | Value | Use |
|---|---|---|
| `--shadow-card` | 0 1px 7px rgba(35,31,32,.04), 0 0 1px rgba(127,126,106,.24) | Cards (exact value from sprinto.com) |
| `--shadow-overlay` | 0 1px 6px rgba(0,0,0,.06), 0 2px 32px rgba(0,0,0,.16) | Modals, popovers |

## 7. Motion

Personality: **smooth**. Easing `cubic-bezier(0.2, 0.7, 0.2, 1)`. Fast 140ms (hover, press), normal 240ms (panel open, row expand). No bounce. Respect `prefers-reduced-motion`.

## 8. Iconography

- **Observed:** thin outline UI icons (~1.5px) with rounded terminals: calendar on the demo CTA, chevrons, hamburger. Humanist, never filled.
- **Fallback kit:** Phosphor regular, match high. Lucide was second, but its 2px stroke reads heavier than Sprinto's hairline UI.
- Size 16px inline, 20px in navigation. Colour follows text.
- *Disclaimer: icons are a best-match fallback from Phosphor, not Sprinto's own icon set.*

## 9. Hero stage

Preset `flat-blank`: a full-bleed flat plum field with a cream headline and the key word in lime. No subject, no gradient. In the console this appears only as the run header and the kill-switch banner.
