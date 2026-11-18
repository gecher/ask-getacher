export type Chunk = {
  source: string;   // file name, e.g. "experience.md"
  section: string;  // heading, e.g. "Ethiopian Airlines: role overview"
  content: string;  // the text that is embedded and shown to the model
};

/**
 * Splits a Markdown file into one chunk per "## " section.
 *
 * Each chunk starts with the document title and the section heading, so that a
 * chunk still makes sense on its own ("Getacher Ashebir: work experience >
 * Ethiopian Airlines: cloud and DevOps"). This is called a contextual header.
 */
export function splitMarkdown(source: string, markdown: string): Chunk[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const title = lines.find((line) => line.startsWith("# "))?.slice(2).trim() ?? source;

  const chunks: Chunk[] = [];
  let section: string | null = null;
  let body: string[] = [];

  const finishSection = () => {
    const text = body.join("\n").trim();
    if (section && text) {
      chunks.push({ source, section, content: `${title} > ${section}\n\n${text}` });
    }
  };

  for (const line of lines) {
    if (line.startsWith("## ")) {
      finishSection();
      section = line.slice(3).trim();
      body = [];
    } else if (!line.startsWith("# ")) {
      body.push(line);
    }
  }
  finishSection();

  return chunks;
}
