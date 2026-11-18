import pg from "pg";

// A pool keeps a few open connections and reuses them, like ADO.NET connection pooling.
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
});
