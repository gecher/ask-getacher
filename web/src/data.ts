// The content shown on the page. The chat answers from the knowledge files in
// the API; this file only controls what visitors see without asking.

export const profile = {
  name: "Getacher Ashebir",
  role: "Backend Lead and Full Stack Engineer",
  place: "Addis Ababa, Ethiopia",
  intro:
    "I build enterprise systems in .NET at Ethiopian Airlines: low-code platforms, workflow " +
    "engines and the APIs behind them. Lately I also build retrieval-augmented AI, including " +
    "the assistant on this page.",
  links: [
    { label: "GitHub", href: "https://github.com/gecher" },
    { label: "LinkedIn", href: "https://www.linkedin.com/in/getacher-ashebir/" },
  ],
};

export const starterQuestions = [
  "Has Getacher led a team?",
  "What has he built with RabbitMQ?",
  "What results has he delivered with CI/CD?",
  "What AI projects has he built?",
];

export type Project = {
  name: string;
  role: string;
  outcome: string;
  stack: string[];
  href?: string;
};

export const projects: Project[] = [
  {
    name: "AlphaPlus",
    role: "Backend Lead",
    outcome: "Hotel booking for 2,000+ Ethiopian Airlines transit passengers a day, with 40% fewer booking errors.",
    stack: ["ASP.NET Core", "EF Core", "SQL Server", "Azure"],
  },
  {
    name: "eService",
    role: "Full Stack Developer",
    outcome: "Low-code platform where new services are configured, not coded: dynamic forms, workflows and approvals.",
    stack: ["ASP.NET Core", "React", "Next.js", "SQL Server"],
  },
  {
    name: "Medical management system",
    role: "Backend Lead",
    outcome: "Modular backend for medical records and appointments serving 17,000+ employees.",
    stack: ["ASP.NET Core", "CQRS", "MediatR"],
  },
  {
    name: "eProcurement",
    role: "Backend Engineer",
    outcome: "Procurement workflows integrated with finance and inventory in real time, for 200+ suppliers.",
    stack: ["ASP.NET Core", "RabbitMQ", "SQL Server"],
  },
  {
    name: "DocuMind",
    role: "Personal project",
    outcome: "RAG API with background ingestion and a measured comparison of vector and hybrid search.",
    stack: [".NET", "pgvector", "Gemini"],
    href: "https://github.com/gecher/documind",
  },
  {
    name: "RAG Chat",
    role: "Personal project",
    outcome: "Chat with your PDFs: streaming answers, sources first, clickable citations.",
    stack: ["React", "FastAPI", "pgvector"],
    href: "https://github.com/gecher/rag-chat",
  },
];

export const results = [
  { figure: "7+", text: "junior developers mentored" },
  { figure: "50%", text: "fewer deployment errors after automating CI/CD" },
  { figure: "40%", text: "less manual development through reusable workflow components" },
];
