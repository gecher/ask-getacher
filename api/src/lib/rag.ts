import { embed, streamChat } from "./gemini.js";
import { searchChunks, type Source } from "./search.js";

export const SYSTEM_PROMPT = `You are the assistant on Getacher Ashebir's portfolio website.
Visitors, often recruiters, ask about Getacher's experience, projects and skills.

Rules:
- Use only the provided context. Do not use outside knowledge and do not guess.
- If the context only partly answers the question, give what it supports and say what it does not cover.
- If the context does not answer the question at all, say: "I don't have that information about Getacher. You can ask him directly through LinkedIn."
- Refer to Getacher by name or as "he", never as "I".
- After each fact, cite its source number in brackets, one number per bracket, like [1] or [1][3].
- Keep answers short: a few sentences, or a short list when listing things.
- Only answer questions about Getacher and his work. For anything else, politely say you can only answer questions about Getacher.`;

export type Timing = {
  embedMs: number;        // question to vector
  searchMs: number;       // database search
  firstTokenMs: number;   // model thinking until its first word
  answerMs: number;       // the rest of the answer
  totalMs: number;
};

export type AskEvent =
  | { type: "sources"; sources: Source[] }
  | { type: "token"; text: string };

/** Retrieve, then generate: yields the sources first, then the answer in pieces. */
export async function* askStream(question: string): AsyncGenerator<AskEvent> {
  const started = performance.now();

  // 1. Retrieve
  const [queryVector] = await embed([question], "RETRIEVAL_QUERY");
  const embedded = performance.now();

  const sources = await searchChunks(queryVector, 5);
  const searched = performance.now();
  yield { type: "sources", sources };

  // 2. Generate
  let firstToken: number | null = null;
  for await (const text of streamChat(SYSTEM_PROMPT, buildPrompt(question, sources))) {
    firstToken ??= performance.now();
    yield { type: "token", text };
  }
  const finished = performance.now();

  const timing: Timing = {
    embedMs: Math.round(embedded - started),
    searchMs: Math.round(searched - embedded),
    firstTokenMs: Math.round((firstToken ?? finished) - searched),
    answerMs: Math.round(finished - (firstToken ?? finished)),
    totalMs: Math.round(finished - started),
  };

  // Where did the time go? Printed in the API terminal (and in Vercel's logs).
  console.log(
    `[timing] embed ${timing.embedMs} ms | search ${timing.searchMs} ms | ` +
      `first word ${timing.firstTokenMs} ms | rest ${timing.answerMs} ms | total ${timing.totalMs} ms`,
  );
}

/** Numbers each source so the model can cite it, and puts the question last. */
export function buildPrompt(question: string, sources: Source[]): string {
  const context = sources
    .map((s, i) => `[${i + 1}] (${s.source}, ${s.section})\n${s.content}`)
    .join("\n\n");

  return `Context:\n\n${context}\n\nQuestion: ${question}`;
}