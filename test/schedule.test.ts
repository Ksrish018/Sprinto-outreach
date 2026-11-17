import { describe, expect, it } from "vitest";
import { nextWeeklyRun } from "@/lib/schedule";

describe("nextWeeklyRun (Monday 09:00 IST = 03:30 UTC)", () => {
  it("returns the coming Monday from midweek", () => {
    expect(nextWeeklyRun(new Date("2026-11-19T10:00:00Z")).toISOString()).toBe("2026-11-23T03:30:00.000Z");
  });

  it("returns today when it is Monday before 09:00 IST", () => {
    expect(nextWeeklyRun(new Date("2026-11-23T02:00:00Z")).toISOString()).toBe("2026-11-23T03:30:00.000Z");
  });

  it("returns next week when it is Monday after 09:00 IST", () => {
    expect(nextWeeklyRun(new Date("2026-11-23T04:00:00Z")).toISOString()).toBe("2026-11-30T03:30:00.000Z");
  });

  it("handles Sunday", () => {
    expect(nextWeeklyRun(new Date("2026-11-22T20:00:00Z")).toISOString()).toBe("2026-11-23T03:30:00.000Z");
  });
});
