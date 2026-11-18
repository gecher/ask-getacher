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
