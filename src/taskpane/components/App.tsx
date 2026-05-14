import * as React from "react";
import { extractContent, Scope } from "./DocumentExtractor";
import { ScopeSelector } from "./ScopeSelector";
import { ChatPanel, ChatMessage } from "./ChatPanel";
import "./app.css";

const BACKEND = "https://localhost:3000";

export default function App() {
  const [scope, setScope] = React.useState<Scope>("full-document");
  const [pageNumber, setPageNumber] = React.useState(1);
  const [indexMode, setIndexMode] = React.useState<"replace" | "append">("replace");
  const [sources, setSources] = React.useState<Record<string, any>>({});

  const [indexing, setIndexing] = React.useState(false);
  const [indexed, setIndexed] = React.useState(false);
  const [indexStatus, setIndexStatus] = React.useState("");
  const [warnings, setWarnings] = React.useState<string[]>([]);

  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [asking, setAsking] = React.useState(false);

  React.useEffect(() => {
    fetch(`${BACKEND}/api/sources`)
      .then(r => r.json())
      .then(data => {
        setSources(data);
        if (Object.keys(data).length > 0) setIndexed(true);
      })
      .catch(() => {});
  }, []);

  const handleIndex = async () => {
    setIndexing(true);
    setIndexStatus("Extracting document content…");
    setWarnings([]);

    try {
      const content = await extractContent(scope, pageNumber);
      setWarnings(content.warnings);

      if (!content.text && content.images.length === 0 && content.sections.length === 0) {
        setIndexStatus("Nothing to index. Select content or choose a different scope.");
        setIndexing(false);
        return;
      }

      setIndexStatus("Sending to backend for embedding…");

      const sourceName = scope === "page"
        ? `page-${pageNumber}`
        : scope === "selection" ? "selection"
        : scope === "selection-image" ? "selection-image"
        : "full-document";

      const res = await fetch(`${BACKEND}/api/index`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: content.text,
          sections: content.sections,
          images: content.images,
          source: sourceName,
          mode: indexMode,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail ?? "Index request failed");
      }

      const data = await res.json();
      setIndexed(true);
      setSources(data.sources);
      setIndexStatus(data.message);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setIndexStatus(`Error: ${msg}`);
    } finally {
      setIndexing(false);
    }
  };

  const handleClearAll = async () => {
    try {
      await fetch(`${BACKEND}/api/index/clear`, { method: "DELETE" });
    } catch { }
    setSources({});
    setIndexed(false);
    setIndexStatus("Index cleared.");
    setMessages([]);
  };

  const handleAsk = async (question: string) => {
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setAsking(true);

    try {
      const res = await fetch(`${BACKEND}/api/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail ?? "Ask request failed");
      }

      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.answer }]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setMessages((prev) => [...prev, { role: "error", content: `Error: ${msg}` }]);
    } finally {
      setAsking(false);
    }
  };

  return (
    <div style={styles.root}>
      <header style={styles.header}>
        <span style={styles.title}>Word RAG Assistant</span>
        <span style={styles.badge}>Multimodal</span>
      </header>

      <div style={styles.body}>
        <ScopeSelector
          scope={scope}
          pageNumber={pageNumber}
          indexMode={indexMode}
          sources={sources}
          onScopeChange={setScope}
          onPageChange={setPageNumber}
          onIndexModeChange={setIndexMode}
          onIndex={handleIndex}
          onClearAll={handleClearAll}
          indexing={indexing}
          indexed={indexed}
          indexStatus={indexStatus}
          warnings={warnings}
        />

        <hr style={styles.divider} />

        <ChatPanel
          messages={messages}
          onAsk={handleAsk}
          asking={asking}
          indexed={indexed}
        />
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    fontFamily: "'Segoe UI', sans-serif",
    background: "#faf9f8",
    color: "#201f1e",
  },
  header: {
    background: "#0078d4",
    color: "#fff",
    padding: "12px 16px",
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  title: { fontWeight: 700, fontSize: 15 },
  badge: {
    background: "rgba(255,255,255,0.25)",
    borderRadius: 10,
    padding: "1px 8px",
    fontSize: 11,
  },
  body: { flex: 1, overflowY: "auto", padding: "0 16px 16px" },
  divider: { border: "none", borderTop: "1px solid #edebe9", margin: "4px 0" },
};
