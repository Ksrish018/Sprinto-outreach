// Applies db/migrations/*.sql in order, once each, inside a transaction per file.
// Usage: npm run db:migrate   (reads DATABASE_URL from .env)
import { readdir, readFile } from "node:fs/promises";
import { Pool } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const dir = new URL("../db/migrations/", import.meta.url);
const pool = new Pool({ connectionString: url });
const client = await pool.connect();

try {
  await client.query(`create table if not exists schema_migrations (
    name text primary key, applied_at timestamptz not null default now())`);
  const done = new Set((await client.query("select name from schema_migrations")).rows.map((r) => r.name));
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    if (done.has(file)) {
      console.log(`skip   ${file}`);
      continue;
    }
    const text = await readFile(new URL(file, dir), "utf8");
    await client.query("begin");
    try {
      await client.query(text);
      await client.query("insert into schema_migrations (name) values ($1)", [file]);
      await client.query("commit");
      console.log(`apply  ${file}`);
    } catch (err) {
      await client.query("rollback");
      throw new Error(`${file}: ${err.message}`);
    }
  }
} finally {
  client.release();
  await pool.end();
}
