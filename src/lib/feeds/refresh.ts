import "server-only";
import { sql } from "../db";
import { precheckPool, readFeeds } from "./pool";

const MIN_GAP_MIN = 10;

export class TooSoonError extends Error {}

// Steps ③ and ④ together: read the feeds, then pre-check new companies until the deadline.
// Anything not pre-checked in time stays "new" and is checked on the next refresh.
export async function refreshPool(deadlineMs: number, opts: { force?: boolean } = {}) {
  if (!opts.force) {
    const [r] = (await sql()`select max(read_at) as last from feed_reads`) as { last: string | null }[];
    if (r.last && Date.now() - Date.parse(r.last) < MIN_GAP_MIN * 60_000) {
      throw new TooSoonError(`Feeds were read less than ${MIN_GAP_MIN} minutes ago.`);
    }
  }
  const read = await readFeeds();
  const checked = await precheckPool(deadlineMs);
  return { read, checked };
}
