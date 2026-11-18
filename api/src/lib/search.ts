import pgvector from "pgvector";
import { pool } from "./db.js";

export type Source = {
  source: string;
  section: string;
  content: string;
  similarity: number;
};

/** Returns the topK chunks closest in meaning to the question vector. */
export async function searchChunks(queryVector: number[], topK = 5): Promise<Source[]> {
  // <=> is cosine distance: smaller means closer. 1 - distance gives similarity.
  const { rows } = await pool.query<Source>(
    `SELECT source, section, content, 1 - (embedding <=> $1) AS similarity
     FROM chunks
     ORDER BY embedding <=> $1
     LIMIT $2`,
    [pgvector.toSql(queryVector), topK],
  );
  return rows;
}
