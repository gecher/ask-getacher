// Reads every Markdown file in /knowledge, splits it into sections, embeds them
// and replaces the contents of the chunks table. Run it again whenever you edit
// the knowledge files:  npm run ingest

import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pgvector from "pgvector";
import { splitMarkdown, type Chunk } from "../src/lib/chunk.js";
import { pool } from "../src/lib/db.js";
import { embed } from "../src/lib/gemini.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const knowledgeDir = path.resolve(here, "../../knowledge");

async function main() {
  // 1. Load and chunk
  const files = (await readdir(knowledgeDir)).filter((f) => f.endsWith(".md")).sort();
  const chunks: Chunk[] = [];

  for (const file of files) {
    const markdown = await readFile(path.join(knowledgeDir, file), "utf8");
    const fileChunks = splitMarkdown(file, markdown);
    console.log(`${file}: ${fileChunks.length} sections`);
    chunks.push(...fileChunks);
  }

  if (chunks.length === 0) {
    throw new Error(`No sections found in ${knowledgeDir}. Each section needs a "## " heading.`);
  }

  // 2. Embed
  console.log(`\nEmbedding ${chunks.length} chunks...`);
  const vectors = await embed(chunks.map((c) => c.content), "RETRIEVAL_DOCUMENT");

  // 3. Store, replacing the old chunks in one transaction
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM chunks");

    for (let i = 0; i < chunks.length; i++) {
      await client.query(
        "INSERT INTO chunks (source, section, content, embedding) VALUES ($1, $2, $3, $4)",
        [chunks[i].source, chunks[i].section, chunks[i].content, pgvector.toSql(vectors[i])],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  console.log(`Stored ${chunks.length} chunks in the database.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
