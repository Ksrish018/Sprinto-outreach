# Sprinto Ops: Components

`observed` = measured on sprinto.com. `derived` = not on the site; reasoned from the principles in SKILL.md.

## 1. Buttons (observed)

All buttons are pills (`--radius-control`), Instrument Sans 15px weight 500.

| Variant | Background | Text | Padding | Hover | When |
|---|---|---|---|---|---|
| Primary | `--accent` | `--on-accent` | 10px 20px | `--accent-hover` | One per view: "Run now" |
| On plum | #FFFFFF | `--accent` | 10px 20px | surface2 | Inside the plum header |
| Secondary | `--accent-subtle` | `--accent` | 8px 16px | darken 4% | "Run on domains", "Retry" |
| Ghost | transparent | `--accent` | 8px 4px | underline | Inline links: "Open in Gmail" |
| Danger (derived) | `--error` | #FFFFFF | 10px 20px | darken 8% | "Pause everything" only |

Disabled: 40% opacity, no hover. Focus: 2px ring in `--accent` at 3px offset.

## 2. Cards (observed)

Surface1, 1px `--border`, `--radius-container`, `--shadow-card`, padding `--space-lg`. Title in subheading, meta in caption text3.

**Framed card** (observed motif): same card with four 8px plum L-shaped corner marks. One per page, for the most important panel.

## 3. Inputs (derived)

Background surface1, 1px `--border-visible`, `--radius-component`, 10px 12px padding, body text. Focus: border `--accent`, 3px ring `#E9B6CF`. Error: border `--error`, helper text in `--error` caption. Textarea for the optional reason box is the same.

## 4. Lists and tables (derived)

Rows 48px, body-sm, hairline `--border` between rows. Header row: label style on surface2. Hover: surface3. Selected: `--accent-subtle` background plus a 2px plum left rule. Numbers right-aligned with tabular figures.

**Fact row:** value in body text1, quote below in IBM Plex Mono 12.5px on surface3 with 8px radius, source as a ghost link with the domain in mono, rung tag (API / PROVIDER / SEARCH / SCRAPE) on the right.

## 5. Navigation (derived)

Left rail 220px on desktop: product name at the top, then text-and-icon items (Phosphor 20px). Active item: plum text weight 600 with a 2px plum left rule. On narrow screens the rail becomes a top bar with a menu button.

## 6. Tags and chips (observed)

Micro-tag: `--tag-bg`, plum text, label style UPPERCASE 11px, `--radius-element`, padding 2px 8px.

| Tag | Colours |
|---|---|
| GO | lime dot + plum text on tag-bg |
| GO + FLAG | warning dot |
| HUMAN | lilac bg |
| NO-GO | text3 on surface2 |
| MEMORY | `--memory` text on `--memory-bg` |
| Rung (API / SCRAPE ...) | text2 on surface2, mono |

## 7. Status banners (observed motif, derived use)

- **Run header:** plum field, cream title at display size, run number and next run in caption cream at 70%, on-plum buttons on the right.
- **Kill banner:** plum field with `--radius-panel`, red dot, the line that fired, its numbers, and "Write by hand as before" as the fallback. Resume button (on plum) opens the reason form.

## 8. Overlays (derived)

Modal: surface1, `--radius-container`, `--shadow-overlay`, max width 560px, title in heading. Backdrop rgba(20,16,18,0.4). Side drawer (for the dossier on small screens): same surface, 480px wide. No bottom sheets: desktop console.

## 9. Meters (derived)

Kill lines and quotas: 6px track in surface2 with pill radius, fill in `--success` / `--warning` / `--error` by state, threshold marker as a 2px plum tick. Value and threshold in caption next to it.

## 10. State patterns

| State | Pattern |
|---|---|
| Empty | Centred in the panel, 64px top space, heading-size sentence ("No drafts this week yet"), one body line, one secondary pill action |
| Loading | 3 to 6 skeleton rows in surface2, no spinner |
| Error | error-bg panel with error dot, plain sentence of what failed and what the system did, Retry as secondary pill |
| Disabled | 40% opacity, cursor not-allowed, tooltip explains why |
| Kill switch on | Plum kill banner at the top of every page; draft actions disabled |
