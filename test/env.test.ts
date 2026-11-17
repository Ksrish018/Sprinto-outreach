import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const VALID = {
  GEMINI_API_KEY: "test-gemini-key",
  HUNTER_API_KEY: "test-hunter-key",
  DATABASE_URL: "postgresql://user:pass@localhost/db",
  HUBSPOT_ACCESS_TOKEN: "test-hubspot-token",
  GMAIL_CLIENT_ID: "test-client-id",
  GMAIL_CLIENT_SECRET: "test-client-secret",
  GMAIL_REFRESH_TOKEN: "test-refresh-token",
  SEND_TO_EMAIL: "pilot@example.com",
  CRON_SECRET: "x".repeat(32),
};

async function loadEnv() {
  vi.resetModules();
  return import("@/lib/env");
}

describe("env()", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    for (const k of Object.keys(VALID)) delete process.env[k];
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it("parses a complete environment and applies defaults", async () => {
    Object.assign(process.env, VALID);
    const { env } = await loadEnv();
    const e = env();
    expect(e.SEND_TO_EMAIL).toBe("pilot@example.com");
    expect(e.LIVE_APIS).toBe("off");
    expect(e.GEMINI_EMBEDDING_MODEL).toBe("gemini-embedding-001");
  });

  it("names missing variables without leaking any values", async () => {
    Object.assign(process.env, VALID);
    delete process.env.HUNTER_API_KEY;
    process.env.SEND_TO_EMAIL = "not-an-email";
    const { env } = await loadEnv();
    let message = "";
    try {
      env();
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message).toContain("HUNTER_API_KEY");
    expect(message).toContain("SEND_TO_EMAIL");
    for (const value of Object.values(VALID)) expect(message).not.toContain(value);
    expect(message).not.toContain("not-an-email");
  });

  it("rejects a short cron secret", async () => {
    Object.assign(process.env, VALID, { CRON_SECRET: "short" });
    const { env } = await loadEnv();
    expect(() => env()).toThrow(/CRON_SECRET/);
  });

  it("reports connection presence as booleans only", async () => {
    Object.assign(process.env, VALID);
    delete process.env.GMAIL_REFRESH_TOKEN;
    const { connectionPresence } = await loadEnv();
    const p = connectionPresence();
    expect(p).toEqual({ gemini: true, hunter: true, neon: true, hubspot: true, gmail: false });
  });
});
