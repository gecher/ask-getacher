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

  return (
    <article className={message.failed ? "answer failed" : "answer"}>
      {message.text ? (
        <p className="answer-text">{withCitations(message.text, message.sources.length, setOpen)}</p>
      ) : (
        <p className="thinking">{loading ? "Looking through my notes" : ""}</p>
      )}

      {message.sources.length > 0 && !message.failed && (
        <ol className="sources">
          {message.sources.map((s, n) => (
            <li key={n} id={`source-${id}-${n + 1}`}>
              <button
                type="button"
                className={open === n + 1 ? "source open" : "source"}
                onClick={() => setOpen(open === n + 1 ? null : n + 1)}
                aria-expanded={open === n + 1}
              >
                <span className="cite">{n + 1}</span>
                {s.section}
              </button>
              {open === n + 1 && <p className="source-text">{stripHeader(s.content)}</p>}
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}

/** Turns "[1]" in the answer into a small button that opens source 1. */
function withCitations(text: string, count: number, open: (n: number) => void): ReactNode[] {
  return text.split(/(\[\d+\])/g).map((part, i) => {
    const n = Number(part.match(/^\[(\d+)\]$/)?.[1] ?? 0);
    if (n >= 1 && n <= count) {
      return (
        <button key={i} type="button" className="cite" onClick={() => open(n)} title={`Show source ${n}`}>
          {n}
        </button>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

/** Removes the "Title > Section" line that was added for search. */
function stripHeader(content: string) {
  return content.replace(/^.*>.*\n\n/, "");
}
