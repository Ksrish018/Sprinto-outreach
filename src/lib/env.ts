import "server-only";
import { z } from "zod";

// Single place where secrets are read. Server code only: importing this from a
// client component fails the build, so no key can reach the browser.
const schema = z.object({
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().default("gemini-3.8-flash"),
  GEMINI_EMBEDDING_MODEL: z.string().default("gemini-embedding-001"),
  HUNTER_API_KEY: z.string().min(1),
  DATABASE_URL: z.string().startsWith("postgres"),
  HUBSPOT_ACCESS_TOKEN: z.string().min(1),
  GMAIL_CLIENT_ID: z.string().min(1),
  GMAIL_CLIENT_SECRET: z.string().min(1),
  GMAIL_REFRESH_TOKEN: z.string().min(1),
  SEND_TO_EMAIL: z.email(),
  SENDER_NAME: z.string().trim().min(1).optional(), // who signs the email; not a secret
  CRON_SECRET: z.string().min(24),
  LIVE_APIS: z.enum(["on", "off"]).default("off"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    // Report which variables are wrong, never their values.
    const names = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Missing or invalid environment variables: ${names}`);
  }
  cached = parsed.data;
  return cached;
}

// Which connections are configured, for the Settings page. Booleans only.
export function connectionPresence() {
  const e = process.env;
  return {
    gemini: Boolean(e.GEMINI_API_KEY),
    hunter: Boolean(e.HUNTER_API_KEY),
    neon: Boolean(e.DATABASE_URL),
    hubspot: Boolean(e.HUBSPOT_ACCESS_TOKEN),
    gmail: Boolean(e.GMAIL_CLIENT_ID && e.GMAIL_CLIENT_SECRET && e.GMAIL_REFRESH_TOKEN),
  };
}
