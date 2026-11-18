import express from "express";
import cors from "cors";

const app = express();

app.use(cors());           // allow the React site to call this API
app.use(express.json());   // read JSON request bodies

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

export default app;