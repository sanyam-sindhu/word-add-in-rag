import * as React from "react";
import ReactMarkdown from "react-markdown";

export interface ChatMessage {
  role: "user" | "assistant" | "error";
  content: string;
}

interface Props {
  messages: ChatMessage[];
  onAsk: (question: string) => void;
  asking: boolean;
  indexed: boolean;
}

export const ChatPanel: React.FC<Props> = ({ messages, onAsk, asking, indexed }) => {
  const [question, setQuestion] = React.useState("");
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = question.trim();
    if (!q || asking) return;
    onAsk(q);
    setQuestion("");
  };

  return (
    <div style={styles.container}>
      <h3 style={styles.heading}>2. Ask a Question</h3>

      {!indexed && (
        <div style={styles.hint}>Index content first using the scope selector above.</div>
      )}

      <div style={styles.messages}>
        {messages.length === 0 && indexed && (
          <div style={styles.empty}>Ask anything about the indexed content…</div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              ...styles.bubble,
              ...(msg.role === "user" ? styles.userBubble : msg.role === "error" ? styles.errorBubble : styles.aiBubble),
            }}
          >
            {msg.role === "user" ? (
              <span>{msg.content}</span>
            ) : (
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            )}
          </div>
        ))}
        {asking && (
          <div style={{ ...styles.bubble, ...styles.aiBubble, color: "#605e5c", fontStyle: "italic" }}>
            Thinking…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} style={styles.form}>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={indexed ? "Type your question…" : "Index content first"}
          disabled={!indexed || asking}
          rows={3}
          style={styles.textarea}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e as unknown as React.FormEvent);
            }
          }}
        />
        <button
          type="submit"
          disabled={!indexed || asking || !question.trim()}
          style={{
            ...styles.button,
            ...(!indexed || asking || !question.trim() ? styles.buttonDisabled : {}),
          }}
        >
          {asking ? "Asking…" : "Ask"}
        </button>
      </form>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: { display: "flex", flexDirection: "column", flex: 1, padding: "12px 0" },
  heading: { fontSize: 14, fontWeight: 600, margin: "0 0 10px 0", color: "#323130" },
  hint: { fontSize: 12, color: "#605e5c", marginBottom: 8 },
  messages: {
    flex: 1,
    overflowY: "auto",
    maxHeight: 340,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginBottom: 12,
    padding: "4px 0",
  },
  empty: { fontSize: 12, color: "#a19f9d", textAlign: "center", marginTop: 20 },
  bubble: {
    padding: "8px 12px",
    borderRadius: 8,
    fontSize: 13,
    lineHeight: 1.5,
    maxWidth: "92%",
    wordBreak: "break-word",
  },
  userBubble: {
    alignSelf: "flex-end",
    background: "#0078d4",
    color: "#fff",
    borderBottomRightRadius: 2,
  },
  aiBubble: {
    alignSelf: "flex-start",
    background: "#f3f2f1",
    color: "#201f1e",
    borderBottomLeftRadius: 2,
  },
  errorBubble: {
    alignSelf: "flex-start",
    background: "#fde7e9",
    color: "#a4262c",
    borderBottomLeftRadius: 2,
  },
  form: { display: "flex", flexDirection: "column", gap: 8 },
  textarea: {
    resize: "vertical",
    padding: "8px 10px",
    border: "1px solid #8a8886",
    borderRadius: 4,
    fontSize: 13,
    fontFamily: "inherit",
    lineHeight: 1.4,
  },
  button: {
    padding: "8px 18px",
    background: "#0078d4",
    color: "#fff",
    border: "none",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    alignSelf: "flex-end",
  },
  buttonDisabled: { background: "#c7c7c7", cursor: "not-allowed" },
};
