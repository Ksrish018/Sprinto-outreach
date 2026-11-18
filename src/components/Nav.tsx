"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChartLineUp,
  EnvelopeSimple,
  Funnel,
  Heartbeat,
  House,
  Path,
  Crosshair,
  ShieldCheck,
  SlidersHorizontal,
} from "@phosphor-icons/react";
import styles from "./Nav.module.css";

const ITEMS = [
  { href: "/", label: "This week", Icon: House },
  { href: "/icp", label: "ICP", Icon: Crosshair },
  { href: "/how-it-works", label: "How it works", Icon: Path },
  { href: "/pipeline", label: "Pipeline", Icon: Funnel },
  { href: "/drafts", label: "Drafts and Why", Icon: EnvelopeSimple },
  { href: "/results", label: "Results", Icon: ChartLineUp },
  { href: "/health", label: "Health", Icon: Heartbeat },
  { href: "/settings", label: "Settings", Icon: SlidersHorizontal },
] as const;

export function Nav() {
  const path = usePathname();
  return (
    <nav className={styles.rail} aria-label="Main">
      <div className={styles.brand}>
        <ShieldCheck size={20} className={styles.brandIcon} aria-hidden />
        Sprinto Outreach
      </div>
      {ITEMS.map(({ href, label, Icon }) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={active ? `${styles.item} ${styles.active}` : styles.item}
            aria-current={active ? "page" : undefined}
          >
            <Icon size={20} aria-hidden />
            {label}
          </Link>
        );
      })}
      <p className={styles.foot}>Pilot mode: every draft goes to your own inbox.</p>
    </nav>
  );
}
