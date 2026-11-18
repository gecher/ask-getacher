import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { starterQuestions } from "../data";

// In development this is the local API. On Vercel it comes from VITE_API_URL.
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

type Source = { source: string; section: string; content: string; similarity: number };

type Message = {
  role: "user" | "assistant";
  text: string;
  sources: Source[];
  failed?: boolean;
};

type StreamEvent =
  | { type: "sources"; sources: Source[] }
  | { type: "token"; text: string }
  | { type: "error"; message: string }
  | { type: "done" };

export default function Chat() {
  // State: values that, when changed, make React redraw the component.
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  /** Changes only the last message, the assistant answer being written. */
  function updateLast(change: (m: Message) => Message) {
    setMessages((prev) => [...prev.slice(0, -1), change(prev[prev.length - 1])]);
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      const el = threadRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  async function ask(text: string) {
    const asked = text.trim();
    if (!asked || loading) return;

    setQuestion("");
    setLoading(true);
    setMessages((prev) => [
      ...prev,
      { role: "user", text: asked, sources: [] },
      { role: "assistant", text: "", sources: [] },
    ]);
    scrollToBottom();

    try {
      const response = await fetch(`${API_URL}/api/ask/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: asked }),
      });
      if (!response.ok || !response.body) throw new Error(`Status ${response.status}`);

      // Read the answer line by line as it streams in.
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as StreamEvent;

          if (event.type === "sources") {
            updateLast((m) => ({ ...m, sources: event.sources }));
          } else if (event.type === "token") {
            updateLast((m) => ({ ...m, text: m.text + event.text }));
            scrollToBottom();
          } else if (event.type === "error") {
            updateLast((m) => ({ ...m, text: event.message, failed: true }));
          }
        }
      }
    } catch {
      updateLast((m) => ({
        ...m,
        text: "The assistant can't be reached right now. Please try again in a moment.",
        failed: true,
      }));
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();   // stop the browser from reloading the page
    ask(question);
  }

  return (
    <section className="chat" aria-label="Ask about Getacher">
      <div className="chat-head">
        <h2>Ask about my work</h2>
        <p>Answers come only from my CV and project notes, with the source for each one.</p>
      </div>

      <div className="thread" ref={threadRef}>
        {messages.length === 0 ? (
          <div className="starters">
            {starterQuestions.map((q) => (
              <button key={q} type="button" onClick={() => ask(q)}>
                {q}
              </button>
            ))}
          </div>
        ) : (
          messages.map((m, i) =>
            m.role === "user" ? (
              <p key={i} className="question">{m.text}</p>
            ) : (
              <Answer key={i} message={m} id={i} loading={loading && i === messages.length - 1} />
            ),
          )
        )}
      </div>

      <form className="composer" onSubmit={handleSubmit}>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about experience, projects or skills"
          aria-label="Your question"
          maxLength={500}
          disabled={loading}
        />
        <button type="submit" disabled={loading || !question.trim()}>
          {loading ? "Answering" : "Ask"}
        </button>
      </form>
    </section>
  );
}

/** One assistant answer with its numbered sources. */
function Answer({ message, id, loading }: { message: Message; id: number; loading: boolean }) {
  // Which source is open, or null. Each answer remembers its own.
  const [open, setOpen] = useState<number | null>(null);

  // Once the answer is written, show only the sources it actually cites.
  const cited = citedNumbers(message.text);
  const visible = message.sources
    .map((source, i) => ({ source, n: i + 1 }))
    .filter(({ n }) => loading || cited.size === 0 || cited.has(n));

  return (
    <article className={message.failed ? "answer failed" : "answer"}>
      {message.text ? (
        <p className="answer-text">{withCitations(message.text, message.sources.length, setOpen)}</p>
      ) : (
        <p className="thinking">{loading ? "Looking through my notes" : ""}</p>
      )}

      {message.sources.length > 0 && !message.failed && (
        <ul className="sources">
          {visible.map(({ source, n }) => (
            <li key={n} id={`source-${id}-${n}`}>
              <button
                type="button"
                className={open === n ? "source open" : "source"}
                onClick={() => setOpen(open === n ? null : n)}
                aria-expanded={open === n}
              >
                <span className="cite">{n}</span>
                {source.section}
              </button>
              {open === n && <p className="source-text">{stripHeader(source.content)}</p>}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

const CITATION = /(\[\d+(?:\s*,\s*\d+)*\])/g;

/** Turns citations like [1], [1, 3] or [1][3] into small buttons that open that source. */
function withCitations(text: string, count: number, open: (n: number) => void): ReactNode[] {
  return text.split(CITATION).map((part, i) => {
    if (!/^\[\d+(?:\s*,\s*\d+)*\]$/.test(part)) {
      return <span key={i}>{part}</span>;
    }

    const numbers = part
      .slice(1, -1)
      .split(",")
      .map((n) => Number(n.trim()))
      .filter((n) => n >= 1 && n <= count);

    return numbers.map((n) => (
      <button key={`${i}-${n}`} type="button" className="cite" onClick={() => open(n)} title={`Show source ${n}`}>
        {n}
      </button>
    ));
  });
}

/** The source numbers an answer cites, such as {1, 3}. */
function citedNumbers(text: string): Set<number> {
  const found = new Set<number>();
  for (const match of text.matchAll(CITATION)) {
    for (const n of match[1].slice(1, -1).split(",")) {
      found.add(Number(n.trim()));
    }
  }
  return found;
}

/** Removes the "Title > Section" line that was added for search. */
function stripHeader(content: string) {
  return content.replace(/^.*>.*\n\n/, "");
}