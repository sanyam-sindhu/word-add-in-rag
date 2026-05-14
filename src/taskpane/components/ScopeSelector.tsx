import * as React from "react";
import { Scope } from "./DocumentExtractor";

interface Props {
  scope: Scope;
  pageNumber: number;
  indexMode: "replace" | "append";
  sources: Record<string, any>;
  onScopeChange: (scope: Scope) => void;
  onPageChange: (page: number) => void;
  onIndexModeChange: (mode: "replace" | "append") => void;
  onIndex: () => void;
  onClearAll: () => void;
  indexing: boolean;
  indexed: boolean;
  indexStatus: string;
  warnings: string[];
}

const SCOPES: { value: Scope; label: string; description: string }[] = [
  { value: "full-document", label: "Full Document", description: "All text and images in the document" },
  { value: "selection", label: "Selected Text", description: "Currently highlighted text" },
  { value: "selection-image", label: "Selected Image", description: "Inline image(s) in current selection" },
  { value: "page", label: "Page", description: "Approximate page by word count (~500 words/page)" },
];

export const ScopeSelector: React.FC<Props> = ({
  scope, pageNumber, indexMode, sources,
  onScopeChange, onPageChange, onIndexModeChange,
  onIndex, onClearAll, indexing, indexed, indexStatus, warnings,
}) => {
  const sourceList = Object.entries(sources);

  return (
    <div style={styles.container}>
      <h3 style={styles.heading}>1. Select Scope</h3>
      <div style={styles.radioGroup}>
        {SCOPES.map((s) => (
          <label key={s.value} style={styles.radioLabel}>
            <input
              type="radio"
              name="scope"
              value={s.value}
              checked={scope === s.value}
              onChange={() => onScopeChange(s.value)}
              style={styles.radio}
            />
            <span>
              <strong>{s.label}</strong>
              <span style={styles.desc}> : {s.description}</span>
            </span>
          </label>
        ))}
      </div>

      {scope === "page" && (
        <div style={styles.pageInput}>
          <label style={styles.pageLabel}>
            Page number:&nbsp;
            <input
              type="number"
              min={1}
              value={pageNumber}
              onChange={(e) => onPageChange(Math.max(1, parseInt(e.target.value) || 1))}
              style={styles.numberInput}
            />
          </label>
        </div>
      )}

      <div style={styles.modeRow}>
        <span style={styles.modeLabel}>Index mode:</span>
        {(["replace", "append"] as const).map((m) => (
          <label key={m} style={styles.modeOption}>
            <input
              type="radio"
              name="indexMode"
              value={m}
              checked={indexMode === m}
              onChange={() => onIndexModeChange(m)}
            />
            &nbsp;{m === "replace" ? "Replace" : "Append"}
          </label>
        ))}
      </div>

      <div style={styles.buttonRow}>
        <button
          onClick={onIndex}
          disabled={indexing}
          style={{ ...styles.button, ...(indexing ? styles.buttonDisabled : {}) }}
        >
          {indexing ? "Indexing…" : "Index Content"}
        </button>
        {sourceList.length > 0 && (
          <button onClick={onClearAll} style={styles.clearButton}>
            Clear All
          </button>
        )}
      </div>

      {indexStatus && (
        <div style={styles.status}>
          {indexed ? "✓" : "ℹ"} {indexStatus}
        </div>
      )}

      {sourceList.length > 0 && (
        <div style={styles.sourceList}>
          <div style={styles.sourceTitle}>Indexed sources:</div>
          {sourceList.map(([name, info]: [string, any]) => (
            <div key={name} style={styles.sourceItem}>
              📄 <strong>{name}</strong> — {info.chunks} chunks, {info.images} images
              <span style={styles.sourceDate}> · {new Date(info.indexed_at).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      )}

      {warnings.length > 0 && (
        <div style={styles.warnings}>
          {warnings.map((w, i) => (
            <div key={i} style={styles.warningItem}>⚠ {w}</div>
          ))}
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: { padding: "12px 0" },
  heading: { fontSize: 14, fontWeight: 600, margin: "0 0 10px 0", color: "#323130" },
  radioGroup: { display: "flex", flexDirection: "column", gap: 8 },
  radioLabel: { display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer", fontSize: 13 },
  radio: { marginTop: 2 },
  desc: { color: "#605e5c", fontSize: 12 },
  pageInput: { marginTop: 10 },
  pageLabel: { fontSize: 13 },
  numberInput: { width: 60, padding: "2px 6px", border: "1px solid #8a8886", borderRadius: 2 },
  modeRow: { display: "flex", alignItems: "center", gap: 12, marginTop: 12, fontSize: 12 },
  modeLabel: { color: "#605e5c" },
  modeOption: { display: "flex", alignItems: "center", cursor: "pointer" },
  buttonRow: { display: "flex", gap: 8, marginTop: 12 },
  button: {
    padding: "8px 18px",
    background: "#0078d4",
    color: "#fff",
    border: "none",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
  },
  buttonDisabled: { background: "#c7c7c7", cursor: "not-allowed" },
  clearButton: {
    padding: "8px 14px",
    background: "#fff",
    color: "#a4262c",
    border: "1px solid #a4262c",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 13,
  },
  status: { marginTop: 8, fontSize: 12, color: "#107c10" },
  sourceList: { marginTop: 10, padding: "8px 10px", background: "#f3f2f1", borderRadius: 4 },
  sourceTitle: { fontSize: 11, color: "#605e5c", marginBottom: 4, fontWeight: 600 },
  sourceItem: { fontSize: 12, color: "#323130", marginBottom: 3 },
  sourceDate: { color: "#a19f9d", fontSize: 11 },
  warnings: { marginTop: 8 },
  warningItem: { fontSize: 11, color: "#d83b01", marginBottom: 4, lineHeight: 1.4 },
};
