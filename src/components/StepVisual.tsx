import type { ReactNode } from "react";
import type { StepId } from "@/lib/pipeline-steps";
import v from "./StepVisual.module.css";

// One small looping illustration per pipeline step. Pure SVG + CSS; restarts when the step changes.
export function StepVisual({ id }: { id: StepId }) {
  return (
    <svg viewBox="0 0 300 190" className={v.svg} role="img" aria-label={LABEL[id]}>
      {VISUAL[id]()}
    </svg>
  );
}

const LABEL: Record<StepId, string> = {
  find: "A search lens sweeps across companies; some are picked, some skipped",
  research: "Three sources are read in order while a budget meter fills up to 15 fetches",
  qualify: "Three gates are checked, then the score fills past the Go line at 50",
  person: "Three possible roles; the right one is picked and the email verified",
  draft: "An email builds line by line, each line linked to its source",
  review: "The draft drops into your Gmail for you to edit and send",
  learn: "Your edit is compared with the draft and stored for next time",
};

const d = (s: number) => ({ animationDelay: `${s}s` });

const VISUAL: Record<StepId, () => ReactNode> = {
  find: () => {
    const cells = Array.from({ length: 15 }, (_, i) => ({ x: 34 + (i % 5) * 50, y: 34 + Math.floor(i / 5) * 46, i }));
    const picked = new Set([1, 7, 8, 13]);
    const skipped = new Set([3, 10]);
    return (
      <>
        {cells.map((c) => (
          <g key={c.i}>
            <rect
              x={c.x - 15} y={c.y - 13} width="30" height="26" rx="5"
              className={`${v.cell} ${picked.has(c.i) ? v.picked : skipped.has(c.i) ? v.skipped : ""}`}
              style={d(0.25 * c.i)}
            />
            {skipped.has(c.i) && <path d={`M${c.x - 7} ${c.y - 6} l14 12 M${c.x + 7} ${c.y - 6} l-14 12`} className={v.cross} style={d(0.25 * c.i)} />}
          </g>
        ))}
        <g className={v.lens}>
          <circle cx="0" cy="0" r="17" className={v.lensGlass} />
          <path d="M12 12 l13 13" className={v.lensHandle} />
        </g>
        <text x="150" y="182" className={v.cap}>4 searches · picked · skipped (customer or seen in 90 days)</text>
      </>
    );
  },

  research: () => (
    <>
      {[
        ["Job boards API", 34],
        ["Google search", 74],
        ["Company pages", 114],
      ].map(([label, y], i) => (
        <g key={label as string}>
          <text x="16" y={(y as number) + 4} className={v.rung}>{label as string}</text>
          <rect x="120" y={(y as number) - 6} width="160" height="12" rx="6" className={v.barBg} />
          <rect x="120" y={(y as number) - 6} width="160" height="12" rx="6" className={v.barFill} style={d(i * 1.1)} />
          <g className={v.quote} style={d(i * 1.1 + 0.9)}>
            <rect x="236" y={(y as number) - 17} width="44" height="12" rx="6" className={v.quoteBg} />
            <text x="258" y={(y as number) - 8} className={v.quoteText}>&ldquo;quote&rdquo;</text>
          </g>
        </g>
      ))}
      <text x="16" y="156" className={v.rung}>Budget</text>
      {Array.from({ length: 15 }, (_, i) => (
        <rect key={i} x={120 + i * 10.7} y="148" width="8" height="12" rx="2" className={v.fetch} style={d(0.2 * i)} />
      ))}
      <text x="150" y="182" className={v.cap}>Stops at 15 fetches, or earlier once answered</text>
    </>
  ),

  qualify: () => (
    <>
      {["B2B SaaS", "20 to 500 people", "No compliance tool yet"].map((g, i) => (
        <g key={g} className={v.gate} style={d(i * 0.5)}>
          <circle cx="28" cy={30 + i * 26} r="9" className={v.gateDot} />
          <path d={`M23 ${30 + i * 26} l4 4 l7 -8`} className={v.tick} />
          <text x="46" y={34 + i * 26} className={v.rung}>{g}</text>
        </g>
      ))}
      <rect x="20" y="118" width="260" height="18" rx="9" className={v.barBg} />
      {[
        [30, "audit"],
        [25, "enterprise"],
        [15, "funding"],
      ].reduce<{ x: number; els: ReactNode[] }>(
        (acc, [w, k], i) => {
          const width = ((w as number) / 100) * 260;
          acc.els.push(<rect key={k as string} x={20 + acc.x} y="118" width={width} height="18" className={`${v.seg} ${v[`seg${i}`]}`} style={d(1.6 + i * 0.6)} />);
          acc.x += width;
          return acc;
        },
        { x: 0, els: [] },
      ).els}
      <line x1="150" x2="150" y1="110" y2="144" className={v.threshold} />
      <text x="150" y="106" className={v.cap}>Go line: 50</text>
      <g className={v.goTag} style={d(3.6)}>
        <rect x="222" y="148" width="58" height="22" rx="11" className={v.goBg} />
        <text x="251" y="163" className={v.goText}>GO · 70</text>
      </g>
      <text x="20" y="163" className={v.rung} style={{ fontSize: 10.5 }}>audit 30 + enterprise 25 + funding 15</text>
    </>
  ),

  person: () => (
    <>
      {[
        ["Founder / CTO", "under 50"],
        ["Eng or security lead", "50 to 200"],
        ["Security leader", "200 to 500"],
      ].map(([role, band], i) => (
        <g key={role} className={`${v.card} ${i === 2 ? v.cardPick : ""}`} style={d(i * 0.3)}>
          <rect x={14 + i * 94} y="30" width="84" height="96" rx="8" className={v.cardBg} />
          <circle cx={56 + i * 94} cy="62" r="15" className={v.avatar} />
          <text x={56 + i * 94} y="98" className={v.roleText}>{role}</text>
          <text x={56 + i * 94} y="113" className={v.bandText}>{band}</text>
        </g>
      ))}
      <g className={v.verified} style={d(2.2)}>
        <rect x="186" y="136" width="100" height="22" rx="11" className={v.goBg} />
        <text x="236" y="151" className={v.goText}>email verified ✓</text>
      </g>
      <text x="150" y="182" className={v.cap}>Role picked by company size · Hunter</text>
    </>
  ),

  draft: () => (
    <>
      <rect x="16" y="14" width="190" height="160" rx="8" className={v.cardBg} />
      <rect x="28" y="28" width="120" height="8" rx="4" className={v.lineDark} />
      {[
        [52, 160, true],
        [74, 150, false],
        [88, 166, false],
        [102, 130, false],
        [124, 140, false],
        [146, 90, false],
      ].map(([y, w, hook], i) => (
        <g key={i}>
          <rect x="28" y={y as number} width={w as number} height="8" rx="4" className={`${v.line} ${hook ? v.hookLine : ""}`} style={d(i * 0.45)} />
          <path d={`M${36 + (w as number)} ${(y as number) + 4} H226`} className={v.link} style={d(i * 0.45 + 0.3)} />
        </g>
      ))}
      {[
        [56, "F16 fact"],
        [92, "Sprinto"],
        [128, "Sprinto"],
      ].map(([y, t], i) => (
        <g key={i} className={v.src} style={d(0.4 + i * 0.9)}>
          <rect x="226" y={(y as number) - 4} width="62" height="18" rx="9" className={i === 0 ? v.goBg : v.quoteBg} />
          <text x="257" y={(y as number) + 9} className={i === 0 ? v.goText : v.quoteText}>{t as string}</text>
        </g>
      ))}
      <text x="226" y="170" className={v.capLeft}>hook · body · ask</text>
    </>
  ),

  review: () => (
    <>
      <rect x="150" y="72" width="130" height="92" rx="8" className={v.cardBg} />
      <text x="164" y="94" className={v.rung}>Your Gmail</text>
      <rect x="164" y="104" width="100" height="8" rx="4" className={v.line} />
      <rect x="164" y="120" width="80" height="8" rx="4" className={v.line} />
      <g className={v.env}>
        <rect x="0" y="0" width="56" height="38" rx="5" className={v.envBg} />
        <path d="M2 3 L28 22 L54 3" className={v.envFlap} />
      </g>
      <g className={v.pencil}>
        <path d="M0 18 L16 2 L22 8 L6 24 L0 24 Z" className={v.pencilBody} />
      </g>
      <g className={v.sent}>
        <rect x="190" y="136" width="70" height="20" rx="10" className={v.goBg} />
        <text x="225" y="150" className={v.goText}>You send</text>
      </g>
      <text x="24" y="40" className={v.capLeft}>Draft only.</text>
      <text x="24" y="56" className={v.capLeft}>Never sent by the app.</text>
    </>
  ),

  learn: () => (
    <>
      <rect x="14" y="20" width="124" height="64" rx="8" className={v.cardBg} />
      <text x="24" y="38" className={v.bandTextLeft}>Draft</text>
      <rect x="24" y="48" width="100" height="7" rx="3.5" className={v.line} />
      <rect x="24" y="62" width="70" height="7" rx="3.5" className={`${v.line} ${v.struck}`} />
      <line x1="22" x2="98" y1="65.5" y2="65.5" className={v.strike} />
      <rect x="162" y="20" width="124" height="64" rx="8" className={v.cardBg} />
      <text x="172" y="38" className={v.bandTextLeft}>You sent</text>
      <rect x="172" y="48" width="100" height="7" rx="3.5" className={v.line} />
      <rect x="172" y="62" width="84" height="7" rx="3.5" className={`${v.line} ${v.inserted}`} />
      <g className={v.arrow}>
        <path d="M140 52 H158" className={v.arrowLine} />
        <path d="M153 47 L159 52 L153 57" className={v.arrowLine} />
      </g>
      <g transform="translate(150 132)">
        <circle r="30" className={v.loopRing} />
        <g className={v.loopSpin}>
          <circle cx="0" cy="-30" r="5" className={v.loopDot} />
        </g>
        <text y="4" className={v.goTextDark}>memory</text>
      </g>
      {[0, 1, 2].map((i) => (
        <rect key={i} x={208 + i * 4} y={118 - i * 6} width="52" height="30" rx="5" className={v.mem} style={d(1.2 + i * 0.5)} />
      ))}
      <text x="70" y="136" className={v.cap}>before / after</text>
      <text x="70" y="150" className={v.cap}>stored</text>
      <text x="150" y="182" className={v.cap}>Next similar draft gets the 5 closest edits</text>
    </>
  ),
};
