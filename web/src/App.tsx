import Chat from "./components/Chat";
import { profile, projects, results } from "./data";
import "./App.css";

// A component is a function that returns what to show. App is the whole page.
export default function App() {
  return (
    <div className="page">
      <header className="top">
        <span className="mark">GA</span>
        <nav>
          <a href="#work">Work</a>
          {profile.links.map((link) => (
            <a key={link.href} href={link.href} target="_blank" rel="noreferrer">
              {link.label}
            </a>
          ))}
        </nav>
      </header>

      <main>
        <section className="hero">
          <div className="intro">
            <p className="role">{profile.role}</p>
            <h1>{profile.name}</h1>
            <p className="lede">{profile.intro}</p>
            <p className="place">{profile.place}</p>

            <ul className="results">
              {results.map((r) => (
                <li key={r.figure + r.text}>
                  <strong>{r.figure}</strong> {r.text}
                </li>
              ))}
            </ul>
          </div>

          <Chat />
        </section>

        <section className="work" id="work">
          <h2>Selected work</h2>
          <ul className="projects">
            {projects.map((p) => (
              <li key={p.name}>
                <div className="project-head">
                  <h3>
                    {p.href ? (
                      <a href={p.href} target="_blank" rel="noreferrer">{p.name}</a>
                    ) : (
                      p.name
                    )}
                  </h3>
                  <span className="project-role">{p.role}</span>
                </div>
                <p>{p.outcome}</p>
                <p className="stack">{p.stack.join(" / ")}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="footer">
        <p>Built by {profile.name} with React, Node.js, PostgreSQL and pgvector.</p>
        <a href="https://github.com/gecher/ask-getacher" target="_blank" rel="noreferrer">
          Source code
        </a>
      </footer>
    </div>
  );
}
