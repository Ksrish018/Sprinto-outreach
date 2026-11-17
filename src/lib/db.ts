import "server-only";
import { neon } from "@neondatabase/serverless";
import { env } from "./env";

let client: ReturnType<typeof neon> | undefined;

// Tagged-template SQL over Neon's HTTP driver; values are always parameterised.
export function sql() {
  client ??= neon(env().DATABASE_URL);
  return client;
}
