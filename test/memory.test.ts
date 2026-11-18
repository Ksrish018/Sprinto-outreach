import { describe, expect, it } from "vitest";
import { OPT_OUT, composeEmail, delta, disagreement, editRatio, splitSent } from "@/lib/memory/diff";

const parts = {
  hook: "Hi Maya, I saw Acme is hiring a GRC Analyst.",
  body: "That usually means engineers lose weeks to audit prep.",
  cta: "Worth a 15-minute call next week?",
};

describe("capture: draft vs sent (FR-13.1)", () => {
  it("round-trips an unedited email", () => {
    const sent = composeEmail("Pilot: would go to Maya", parts);
    expect(delta(parts, splitSent(sent)).changed).toEqual([]);
  });

  it("finds which part changed, ignoring the pilot line, signature and quoted replies", () => {
    const sent = composeEmail("Pilot: x", { ...parts, cta: "Open to a quick chat on Thursday?" }) +
      "\n\nOn Mon, Nov 17, 2026 at 9:00 AM Someone wrote:\n> old text";
    const d = delta(parts, splitSent(sent));
    expect(d.changed).toEqual(["cta"]);
    expect(d.cta).toBeGreaterThan(0.5);
  });

  it("signs with a person and ends with an opt-out line, neither of which counts as an edit", () => {
    const sent = composeEmail("Pilot: x", parts, "Asha Rao");
    expect(sent).toContain(["Asha Rao", "Growth, Sprinto"].join(String.fromCharCode(10)));
    expect(sent.trim().endsWith(OPT_OUT)).toBe(true);
    expect(delta(parts, splitSent(sent)).changed).toEqual([]);
    expect(delta(parts, splitSent(sent.replace("Asha Rao", "Asha"))).changed).toEqual([]);
  });

  it("still reads emails sent with the old team signature", () => {
    const old = ["Pilot: x", "", parts.hook, "", parts.body, "", parts.cta, "", "Best,", "Sprinto Growth Team"].join(String.fromCharCode(10));
    expect(delta(parts, splitSent(old)).changed).toEqual([]);
  });

  it("edit ratio is 0 for identical text and 1 for a full rewrite", () => {
    expect(editRatio("a b c", "a b c")).toBe(0);
    expect(editRatio("a b c", "x y z")).toBe(1);
  });
});

describe("disagreement score (FR-13.5)", () => {
  it("combines edit frequency, edit size and discards", () => {
    expect(disagreement([])).toBe(0);
    expect(disagreement([{ outcome: "accepted", size: 0 }, { outcome: "accepted", size: 0 }])).toBe(0);
    expect(disagreement([{ outcome: "edited", size: 0.4 }, { outcome: "accepted", size: 0 }])).toBe(0.2);
    expect(disagreement([{ outcome: "discarded", size: 0 }, { outcome: "accepted", size: 0 }])).toBe(0.5);
  });
});
