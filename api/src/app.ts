import express, { type Request } from "express";
import cors from "cors";
import { askStream } from "./lib/rag.js";
import { checkAndCount } from "./lib/rateLimit.js";

const app = express();

// Only the websites listed in ALLOWED_ORIGINS may call this API from a browser.
// Without the setting (local development), every origin is allowed.
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors(allowedOrigins.length > 0 ? { origin: allowedOrigins } : undefined));
app.use(express.json({ limit: "10kb" }));   // reject large request bodies

const MAX_QUESTION_LENGTH = 500;

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

/**
 * Streams one JSON object per line (NDJSON):
 *   {"type":"sources",...}  then  {"type":"token",...} many times  then  {"type":"done"}
 */
app.post("/api/ask/stream", async (req, res) => {
  const question = typeof req.body?.question === "string" ? req.body.question.trim() : "";

  if (!question) {
    res.status(400).json({ error: "Please send a question." });
    return;
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    res.status(400).json({ error: `Questions can be up to ${MAX_QUESTION_LENGTH} characters.` });
    return;
  }

  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");

  const send = (event: object) => res.write(JSON.stringify(event) + "\n");

  try {
    // Protect the Gemini quota: limit questions per visitor and per day.
    const limit = await checkAndCount(clientIp(req));
    if (!limit.allowed) {
      send({ type: "error", message: limit.message });
      return;
    }

    for await (const event of askStream(question)) {
      send(event);
    }
    send({ type: "done" });
  } catch (error) {
    // Log the details on the server, but don't show internal errors to visitors.
    console.error(error);
    send({ type: "error", message: "The assistant is unavailable right now. Please try again in a minute." });
  } finally {
    res.end();
  }
});

/** The visitor's IP address. Vercel puts it first in the x-forwarded-for header. */
function clientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim();
  return first || req.socket.remoteAddress || "unknown";
}

export default app;