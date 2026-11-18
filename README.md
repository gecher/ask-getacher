# Ask Getacher

My portfolio website with an AI assistant that answers questions about my experience, projects and skills. Answers are written only from my CV and project notes, and every answer shows the sections it came from.

**Live site: [ask-getacher-5fom.vercel.app](https://ask-getacher-5fom.vercel.app/)**

Try questions like *"Has Getacher led a team?"*, *"What has he built with RabbitMQ?"* or *"What results has he delivered with CI/CD?"*. Ask something that isn't in my CV, such as *"Does he know Kubernetes?"*, and it says it doesn't have that information instead of guessing.

This is the fourth project in my Retrieval-Augmented Generation (RAG) series, and the first one deployed for anyone to use:

1. [rag-from-scratch](https://github.com/gecher/rag-from-scratch): the RAG pipeline in plain Python
2. [rag-chat](https://github.com/gecher/rag-chat): React and FastAPI with streaming answers
3. [documind](https://github.com/gecher/documind): ASP.NET Core and Clean Architecture, with retrieval evaluation
4. **ask-getacher**: TypeScript end to end, deployed on Vercel

## Features

- **Grounded answers with citations.** Each fact in an answer has a numbered citation that opens the exact passage it came from. Only the sources an answer actually cites are listed.
- **Honest when it doesn't know.** Questions the knowledge files don't cover get a clear "I don't have that information" with a pointer to LinkedIn.
- **Streaming.** Sources arrive first, then the answer.
- **Stays on topic.** It only answers questions about me, so the site can't be used as a free general chatbot.
- **Protected for public use.** Limits per visitor and per day, an allowed-origins list, input size limits, and error messages that don't reveal internal details.

## How it works

```
knowledge/*.md ──► split by "##" section ──► embed (Gemini) ──► Neon PostgreSQL + pgvector
                                                                        │
question ──► rate limit ──► embed ──► top 5 sections by cosine similarity ┘
                                              │
                              grounded prompt ──► Gemini ──► streamed answer with citations
```

### The knowledge files

Everything the assistant knows is in five Markdown files in [`knowledge/`](knowledge): profile, experience, projects, AI projects and skills. Writing the data by hand allowed choices that make retrieval work well:

- **One topic per `##` section,** and each section becomes one chunk. This is structure-based chunking, which gives cleaner chunks than cutting every few hundred words.
- **Contextual headers.** Each chunk starts with its document and section, such as `Work experience > Ethiopian Airlines: CI/CD and DevOps`, so it still makes sense on its own.
- **Names, not pronouns.** "Getacher deploys..." is still clear when a chunk is read alone; "He deploys..." is not.
- **The words people search with,** such as RabbitMQ, Azure DevOps or CQRS, appear literally.

Running `npm run ingest` re-embeds every section and replaces the old ones in a single transaction, so the live site never sees a half-updated table.

### Streaming

The API sends one JSON object per line:

```
{"type":"sources","sources":[{"source":"profile.md","section":"Leadership and mentoring",...}]}
{"type":"token","text":"Yes. As a backend lead, Getacher has mentored"}
{"type":"done"}
```

## Tech stack

| Part | Technology |
|------|------------|
| Website | React, TypeScript, Vite |
| API | Node.js, Express, TypeScript |
| Database | Neon (serverless PostgreSQL) with pgvector |
| Models | Gemini embeddings (`gemini-embedding-001`, 768 dimensions) and a Gemini chat model |
| Hosting | Vercel: two projects, one for the website and one for the API |

## Project structure

```
ask-getacher/
├── knowledge/            The assistant's knowledge: Markdown files
├── api/
│   ├── scripts/ingest.ts Chunk, embed and store the knowledge files
│   └── src/
│       ├── app.ts        Express app and endpoints
│       ├── server.ts     Local development server
│       └── lib/
│           ├── chunk.ts      Splits Markdown into sections
│           ├── gemini.ts     Embeddings and streaming chat, with retries
│           ├── search.ts     pgvector similarity search
│           ├── rag.ts        System prompt, retrieval and generation
│           ├── rateLimit.ts  Question limits per visitor and per day
│           └── db.ts         PostgreSQL connection pool
└── web/
    └── src/
        ├── App.tsx            The page
        ├── data.ts            Page content: intro, results, projects
        └── components/Chat.tsx  The chat, stream reader and citations
```

## Running it locally

### Requirements

- Node.js 20 or newer
- A free [Neon](https://neon.com) database
- A [Gemini API key](https://aistudio.google.com/apikey)

### 1. Database

In the Neon SQL Editor:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS chunks (
    id        BIGSERIAL PRIMARY KEY,
    source    TEXT NOT NULL,
    section   TEXT NOT NULL,
    content   TEXT NOT NULL,
    embedding VECTOR(768) NOT NULL
);

CREATE TABLE IF NOT EXISTS question_log (
    id       BIGSERIAL PRIMARY KEY,
    visitor  TEXT NOT NULL,
    asked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_question_log_time ON question_log (asked_at);
```

### 2. API

Create `api/.env`:

```
DATABASE_URL=postgresql://...
GEMINI_API_KEY=...
GEMINI_CHAT_MODEL=...
```

Then:

```bash
cd api
npm install
npm run ingest
npm run dev
```

The API runs on `http://localhost:3001`.

### 3. Website

```bash
cd web
npm install
npm run dev
```

Open `http://localhost:5173`.

## Configuration

| Variable | Project | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | API | Neon connection string (secret) |
| `GEMINI_API_KEY` | API | Gemini key (secret) |
| `GEMINI_CHAT_MODEL` | API | Chat model that writes the answers |
| `GEMINI_THINKING_LEVEL` | API | Optional: less thinking for faster answers |
| `IP_HASH_SALT` | API | Salt for hashing visitor IP addresses (secret) |
| `ALLOWED_ORIGINS` | API | Website addresses allowed to call the API |
| `LIMIT_PER_VISITOR_PER_HOUR` | API | Default 20 |
| `LIMIT_TOTAL_PER_DAY` | API | Default 300 |
| `VITE_API_URL` | Website | The API's address. Public by design |

## Decisions and lessons

- **Measured before optimising.** Answers first took about 16 seconds. Timing each step showed that 70% of it was the model thinking and 23% the database waking up from Neon's free-tier pause, while my own code took almost none. Lowering the model's thinking level was the fix, not rewriting code.
- **Limits stored in the database.** Vercel can run several copies of the API at once, so an in-memory counter wouldn't be shared. Visitors are counted by a salted hash of their IP address, so real addresses are never stored.
- **Don't trust the model's output format.** The model sometimes writes citations as `[1, 3]` instead of `[1][3]`, so the page accepts both.
- **A Linux build catches what Windows hides.** A file committed as `RateLimit.ts` but imported as `rateLimit.js` worked on Windows and failed on Vercel, because Linux file names are case-sensitive.

## Limitations

- Retrieval returns the top 5 sections even for weak matches. Because every section is about the same person, similarity scores are close together.
- No conversation memory: each question is answered on its own.
- The free Neon plan pauses the database when idle, so the first question after a quiet period is slower.
- Free-tier Gemini requests may be used by Google to improve its products, so the knowledge files contain only public information.

## Author

Getacher Ashebir, Backend Lead and Full Stack Engineer in Addis Ababa, Ethiopia.
[GitHub](https://github.com/gecher) · [LinkedIn](https://www.linkedin.com/in/getacher-ashebir/)
