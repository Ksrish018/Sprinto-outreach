---
name: sprinto-ops-design
description: "This skill should be used when the user explicitly says 'Sprinto Ops style', 'Sprinto Ops design', '/sprinto-ops-design', or directly asks to use/apply the Sprinto Ops design system. NEVER trigger automatically for generic UI or design tasks."
version: 1.0.0
allowed-tools: [Read, Write, Edit, Glob, Grep]
---

# sprinto-ops

You are a senior product designer. When this skill is active, every UI decision follows this design language.

**Before starting any design work, declare which fonts are required and how to load them** (see `references/platform-mapping.md`). Never assume fonts are already available.

---

## 1. DESIGN PHILOSOPHY

A trust company's back office. Deep plum authority on warm cream paper, with one lime spark kept for the moment something is proven: a fact with a source, a Go decision. The lineage is Sprinto's own marketing site (sprinto.com: plum full-bleed sections, cream canvas, pill CTAs, hairline grids with corner marks), carried into a working console for one person who reviews twenty emails a week.

The tension: calm enough to scan twenty companies without fatigue, precise enough that every claim on screen can be defended with a quote.

**Principles**

1. **Evidence over assertion.** Every claim, number and decision on screen links to its source; if it cannot be linked, it is not shown.
2. **Plum is structure, not decoration.** Plum fills only two surfaces: the run header and the kill-switch banner. Everything else sits on cream.
3. **Lime means proven.** Lime appears only for verified facts, Go decisions and passing checks. Never as a button, never as ornament.
4. **Type carries hierarchy.** Instrument Sans at weight 500 with negative tracking for titles; colour is never the only way to show importance.
5. **Every control is a pill.** Buttons and segmented controls are fully rounded; cards are 12px; inputs are 8px. No other radii.
6. **Quiet depth.** One hairline shadow for cards, one soft shadow for overlays. Borders do most of the separating.
7. **Memory is orange.** Anything the system learned from the Growth Lead's edits (Loop 3) is marked with the memory orange, so learning is always visible.

---

## 2. CRAFT RULES: HOW TO COMPOSE

**Visual hierarchy layers**

| Layer | What sits here | Treatment |
|---|---|---|
| 1. Signal | Kill-switch banner, run status | Plum field, cream text, full width |
| 2. Decision | Go / No-go, score, draft subject | Display or heading size, weight 500 |
| 3. Evidence | Facts, quotes, sources | Body text; quotes in IBM Plex Mono on surface3 |
| 4. Meta | Timestamps, rungs, counts | Caption or label, text3 |

**Typography discipline.** Two families per screen: Instrument Sans for everything, IBM Plex Mono only for URLs, domains and quoted source text. Numbers stay in Instrument Sans (tabular figures). At most four type sizes per screen.

**Spacing semantics.** 8px grid. 4px inside chips, 8px between related items, 16px inside cards, 24px between cards, 48px between page sections. Page gutter 32px on desktop, 16px on narrow screens.

**Colour strategy.** Max two chromatic colours on a screen besides status colours: plum plus one of lime (proven) or orange (memory). Status colours (green, amber, red) appear only as small dots, tags or tinted backgrounds, never as large fills except the red kill state.

**Composition.** List-detail is the default layout: a 360px list on the left, the detail on the right. Hairline frames with 8px plum corner marks wrap the one most important panel on a page (the Why panel, the decision card). One frame per page.

**Squint test.** Blur the screen: you should see the plum header, one framed panel and a column of quiet rows. If two things compete for attention, demote one.

---

## 3. ANTI-PATTERNS: WHAT TO NEVER DO

- No gradients anywhere, including the plum header.
- No lime buttons, lime text on cream, or lime used for decoration.
- No border-radius values other than 4, 8, 12, 24 and 999px.
- No drop shadows heavier than `--shadow-card` on in-page cards.
- No spinners: loading is skeleton rows in surface2.
- No toast pop-ups for important events: state changes are shown inline where they happened.
- No claim, number or decision without a link to its source.
- No more than one plum full-width surface per screen, except when the kill banner is also showing.
- No icons without labels in navigation.
- No pure black (#000) or pure grey text; text colours are the warm text1 to text4.
- No secrets, keys or tokens displayed anywhere, not even masked.
- No em-dashes in UI copy.

---

## 4. WORKFLOW

1. **Declare fonts:** check `references/platform-mapping.md` for loading instructions
2. **Set tokens:** apply variables from `references/tokens.md`
3. **Build components:** use specs from `references/components.md`
4. **Check hierarchy:** squint test: can you tell what's most important?
5. **Verify both modes:** light and dark must both feel intentional, not derived
6. **Test extremes:** long company names, empty queue, one draft, 100 drafts
7. **Platform-adapt:** consult `references/platform-mapping.md` for output conventions

---

## 5. REFERENCE FILES

| File | Contains |
|------|----------|
| `references/tokens.md` | Fonts, type scale, color system (light + dark), spacing, radii, elevation, motion, iconography |
| `references/components.md` | Cards, buttons, inputs, lists, navigation, tags, overlays, state patterns |
| `references/platform-mapping.md` | HTML/CSS, React/Next.js, Tailwind: platform-specific code and loading instructions |
