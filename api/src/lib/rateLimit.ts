import { createHash } from "node:crypto";
import { pool } from "./db.js";

// Limits, configurable in Vercel's environment variables.
const PER_VISITOR_PER_HOUR = Number(process.env.LIMIT_PER_VISITOR_PER_HOUR ?? 20);
const TOTAL_PER_DAY = Number(process.env.LIMIT_TOTAL_PER_DAY ?? 300);

export type LimitResult = { allowed: true } | { allowed: false; message: string };

/**
 * Counts questions in the database, so the limit holds across every server
 * instance Vercel starts. Visitors are identified by a hash of their IP address:
 * the real address is never stored.
 */
export async function checkAndCount(ip: string): Promise<LimitResult> {
  const visitor = hashIp(ip);

  const { rows } = await pool.query<{ per_visitor: string; per_day: string }>(
    `SELECT COUNT(*) FILTER (WHERE visitor = $1 AND asked_at > now() - interval '1 hour') AS per_visitor,
            COUNT(*) AS per_day
     FROM question_log
     WHERE asked_at > now() - interval '1 day'`,
    [visitor],
  );

  if (Number(rows[0].per_day) >= TOTAL_PER_DAY) {
    return {
      allowed: false,
      message: "The assistant has answered its maximum number of questions for today. Please come back tomorrow.",
    };
  }
  if (Number(rows[0].per_visitor) >= PER_VISITOR_PER_HOUR) {
    return {
      allowed: false,
      message: "You've asked a lot of questions in the last hour. Please try again a little later.",
    };
  }

  await pool.query("INSERT INTO question_log (visitor) VALUES ($1)", [visitor]);

  // Now and then, remove rows older than two days so the table stays small.
  if (Math.random() < 0.05) {
    await pool.query("DELETE FROM question_log WHERE asked_at < now() - interval '2 days'");
  }

  return { allowed: true };
}

/** A one-way fingerprint of the IP address, salted so it can't be reversed with a lookup table. */
function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT ?? "local-development";
  return createHash("sha256").update(salt + ip).digest("hex").slice(0, 32);
}