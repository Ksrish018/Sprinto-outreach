# Sprinto Ops: Platform Mapping

## 1. Loading fonts

Instrument Sans (display and body) and IBM Plex Mono (URLs, domains, source quotes) from Google Fonts.

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
```

Next.js: load with `next/font/google` (`Instrument_Sans`, `IBM_Plex_Mono`) and map the generated variables to `--font-sans` and `--font-mono`.

Icons: Phosphor regular.

```html
<link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web@2.1.1/src/regular/style.css">
<i class="ph ph-check-circle"></i>
```

## 2. CSS custom properties

Light is the primary mode. Dark mode is plum-based, not inverted grey.

```css
:root {
  --font-sans: "Instrument Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, "SFMono-Regular", Consolas, monospace;

  /* colour: light */
  --background: #FCF7F5;
  --bg: var(--background);
  --surface1: #FFFFFF;
  --surface2: #F6F5F2;
  --surface3: #FCF2EE;
  --border: #EDE7E4;
  --border-visible: #DDD5D2;
  --text1: #141012;
  --text2: #443E41;
  --text3: #8C8487;
  --text4: #BFBABD;
  --accent: #650A41;
  --accent-hover: #560837;
  --accent-subtle: #EBE2FE;
  --on-accent: #FFFFFF;
  --highlight: #DCF07F;
  --tag-bg: #FAE8E1;
  --plum-field: #650A41;
  --on-plum: #FCF7F5;
  --success: #2E8B57;
  --warning: #D9821E;
  --error: #C8323B;
  --success-bg: #EFF8F1;
  --warning-bg: #FFF6EA;
  --error-bg: #FDF1F1;
  --memory: #E8912D;
  --memory-bg: #FFF1E3;

  /* type scale: size / line-height */
  --display: 36px;      --display-lh: 1.1;   --display-ls: -0.03em;
  --heading: 24px;      --heading-lh: 1.15;  --heading-ls: -0.02em;
  --subheading: 18px;   --subheading-lh: 1.3;
  --body: 15px;         --body-lh: 1.5;
  --body-sm: 13px;      --body-sm-lh: 1.45;
  --caption: 12px;      --caption-lh: 1.4;
  --label: 11px;        --label-ls: 0.08em;
  --mono: 12.5px;

  /* spacing (8px grid) */
  --space-2xs: 2px;  --space-xs: 4px;  --space-sm: 8px;  --space-md: 16px;
  --space-lg: 24px;  --space-xl: 32px; --space-2xl: 48px; --space-3xl: 64px; --space-4xl: 96px;

  /* radii */
  --radius-element: 4px;
  --radius-control: 999px;
  --radius-component: 8px;
  --radius-container: 12px;
  --radius-panel: 24px;

  /* elevation */
  --shadow-card: 0 1px 7px rgba(35, 31, 32, 0.04), 0 0 1px rgba(127, 126, 106, 0.24);
  --shadow-overlay: 0 1px 6px rgba(0, 0, 0, 0.06), 0 2px 32px rgba(0, 0, 0, 0.16);

  /* motion */
  --ease: cubic-bezier(0.2, 0.7, 0.2, 1);
  --duration-fast: 140ms;
  --duration-normal: 240ms;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --background: #1A0210;
    --surface1: #280319;
    --surface2: #370523;
    --surface3: #46062D;
    --border: #370523;
    --border-visible: #46062D;
    --text1: #FCF7F5;
    --text2: #BFBABD;
    --text3: #8C8487;
    --text4: #5E5759;
    --accent: #DCF07F;
    --accent-hover: #B9D23A;
    --accent-subtle: #370523;
    --on-accent: #1A0210;
    --tag-bg: #370523;
    --plum-field: #46062D;
    --success-bg: #123A24;
    --warning-bg: #5A3409;
    --error-bg: #5C1418;
    --memory-bg: #3A2208;
    --shadow-card: 0 0 0 1px #370523;
  }
}
:root[data-theme="dark"] {
  --background: #1A0210;
  --surface1: #280319;
  --surface2: #370523;
  --surface3: #46062D;
  --border: #370523;
  --border-visible: #46062D;
  --text1: #FCF7F5;
  --text2: #BFBABD;
  --text3: #8C8487;
  --text4: #5E5759;
  --accent: #DCF07F;
  --accent-hover: #B9D23A;
  --accent-subtle: #370523;
  --on-accent: #1A0210;
  --tag-bg: #370523;
  --plum-field: #46062D;
  --success-bg: #123A24;
  --warning-bg: #5A3409;
  --error-bg: #5C1418;
  --memory-bg: #3A2208;
  --shadow-card: 0 0 0 1px #370523;
}
```

## 3. React / Next.js

- Put the block above in `src/app/tokens.css` and import it once in the root layout.
- Components use CSS Modules that reference only these variables. No hex values in component files.
- Server components by default; client components only for interactivity. Secrets are never imported into client code.

## 4. Tailwind (if adopted later)

```js
// tailwind.config.js -> theme.extend
colors: {
  background: "var(--background)", surface1: "var(--surface1)", surface2: "var(--surface2)",
  surface3: "var(--surface3)", border: "var(--border)", "border-visible": "var(--border-visible)",
  text1: "var(--text1)", text2: "var(--text2)", text3: "var(--text3)", text4: "var(--text4)",
  accent: "var(--accent)", "accent-subtle": "var(--accent-subtle)", highlight: "var(--highlight)",
  success: "var(--success)", warning: "var(--warning)", error: "var(--error)",
},
borderRadius: { element: "4px", control: "999px", component: "8px", container: "12px", panel: "24px" },
fontFamily: { sans: ["Instrument Sans", "system-ui"], mono: ["IBM Plex Mono", "ui-monospace"] },
```

## 5. SwiftUI

Not a target platform for this product (desktop web console). If needed: `Color("Plum")` = #650A41, `Color("Cream")` = #FCF7F5, `RoundedRectangle(cornerRadius: 12, style: .continuous)` for cards, `Capsule()` for buttons.
