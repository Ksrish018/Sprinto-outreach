import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dir = join(__dirname, "..", "db", "migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const all = files.map((f) => readFileSync(join(dir, f), "utf8")).join("\n");

// PRD §9 data model: every table must exist.
const PRD_TABLES = [
  "icp_versions", "prompt_versions", "runs", "companies", "pages", "facts", "decisions", "contacts",
  "drafts", "corrections", "sends", "events", "kill_state", "suppression", "audit_log", "api_ledger",
];

describe("database migrations", () => {
  it("are numbered and applied in order", () => {
    expect(files.length).toBeGreaterThan(0);
    files.forEach((f, i) => expect(f.startsWith(String(i + 1).padStart(3, "0"))).toBe(true));
  });

  it.each(PRD_TABLES)("create table %s", (table) => {
    expect(all).toMatch(new RegExp(`create table ${table} \\(`));
  });

  it("enable pgvector and index corrections for hybrid search", () => {
    expect(all).toContain("create extension if not exists vector");
    expect(all).toContain("embedding       vector(768)");
    expect(all).toMatch(/using hnsw \(embedding vector_cosine_ops\)/);
    expect(all).toMatch(/using gin \(search_text\)/);
  });

  it("keep one kill switch row", () => {
    expect(all).toContain("check (id = 1)");
  });

  it("never prospect Sprinto or its competitors", () => {
    for (const d of ["sprinto.com", "vanta.com", "drata.com", "secureframe.com"]) expect(all).toContain(`'${d}'`);
  });
});
