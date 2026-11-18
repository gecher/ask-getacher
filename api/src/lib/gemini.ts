const API_URL = "https://generativelanguage.googleapis.com/v1beta";
const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-001";
const BATCH_SIZE = 50;

/** Must match VECTOR(768) in the database. */
export const EMBEDDING_DIMENSIONS = 768;

type TaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

/** Turns texts into vectors, 50 texts per request. */
export async function embed(texts: string[], taskType: TaskType): Promise<number[][]> {
  const model = `models/${EMBEDDING_MODEL}`;
  const vectors: number[][] = [];

  for (let start = 0; start < texts.length; start += BATCH_SIZE) {
    const batch = texts.slice(start, start + BATCH_SIZE);

    const response = await postWithRetry(`${API_URL}/${model}:batchEmbedContents`, {
      requests: batch.map((text) => ({
        model,
        content: { parts: [{ text }] },
        taskType,
        outputDimensionality: EMBEDDING_DIMENSIONS,
      })),
    });

    const data = (await response.json()) as { embeddings: { values: number[] }[] };
    vectors.push(...data.embeddings.map((e) => normalize(e.values)));
  }

  return vectors;
}

/** Sends a request to Gemini, waiting and retrying when it is busy (503) or rate limited (429). */
export async function postWithRetry(url: string, body: unknown, attempts = 4): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY ?? "",
      },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      return response;
    }

    const temporary = response.status === 429 || response.status === 503;
    if (!temporary || attempt >= attempts) {
      throw new Error(`Gemini request failed (${response.status}): ${await response.text()}`);
    }

    const waitSeconds = attempt * 3;
    console.warn(`Gemini is busy (${response.status}). Retrying in ${waitSeconds} seconds.`);
    await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));
  }
}

/** Scales a vector to length 1, so cosine distance compares direction only. */
function normalize(vector: number[]): number[] {
  const length = Math.sqrt(vector.reduce((sum, x) => sum + x * x, 0));
  return length === 0 ? vector : vector.map((x) => x / length);
}

const CHAT_MODEL = process.env.GEMINI_CHAT_MODEL ?? "gemini-4-hydrogen";
const MAX_OUTPUT_TOKENS = Number(process.env.GEMINI_MAX_OUTPUT_TOKENS ?? 4096);

// How much the model "thinks" before answering, for example "low". Leave it unset
// to use the model's default. Check the exact value in AI Studio > Get code.
const THINKING_LEVEL = process.env.GEMINI_THINKING_LEVEL;

type GenerateResponse = {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
};

/**
 * Asks the chat model for an answer and yields it piece by piece as it is written.
 * "async function*" is an async generator: the JavaScript version of
 * IAsyncEnumerable with yield return in C#.
 */
export async function* streamChat(systemPrompt: string, userPrompt: string): AsyncGenerator<string> {
  // alt=sse: Gemini streams the answer as lines starting with "data: "
  const response = await postWithRetry(
    `${API_URL}/models/${CHAT_MODEL}:streamGenerateContent?alt=sse`,
    {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        ...(THINKING_LEVEL ? { thinkingConfig: { thinkingLevel: THINKING_LEVEL } } : {}),
      },
    },
  );

  if (!response.body) {
    throw new Error("Gemini returned an empty response.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    // Network pieces don't line up with lines, so keep the unfinished last line.
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data:")) continue;

      const data = JSON.parse(line.slice("data:".length)) as GenerateResponse;
      const text = (data.candidates?.[0]?.content?.parts ?? [])
        .filter((part) => !part.thought)      // skip the model's internal "thinking"
        .map((part) => part.text ?? "")
        .join("");

      if (text) yield text;
    }
  }
}