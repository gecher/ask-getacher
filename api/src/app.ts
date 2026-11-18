import express from "express";
import cors from "cors";
import { askStream } from "./lib/rag.js";

const app = express();

app.use(cors());           // allow the React site to call this API
app.use(express.json());   // read JSON request bodies

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

export default app;
