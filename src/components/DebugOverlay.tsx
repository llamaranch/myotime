import { useEffect, useState } from "react";
import { dgetEntries, dsubscribe, dclear, type LogEntry } from "@/lib/debug-log";

export function DebugOverlay() {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<LogEntry[]>(dgetEntries());

  useEffect(() => {
    const unsub = dsubscribe(() => setEntries([...dgetEntries()]));
    return unsub;
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        backgroundColor: "rgba(20, 20, 30, 0.95)",
        color: "#cfe",
        fontFamily: "monospace",
        fontSize: 11,
        borderTop: "1px solid #2EC4B6",
        maxHeight: open ? "45vh" : "32px",
        transition: "max-height 0.2s",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 10px",
          height: 32,
        }}
      >
        <button
          onClick={() => setOpen(!open)}
          style={{
            background: "transparent",
            color: "#2EC4B6",
            border: "none",
            fontSize: 12,
            fontFamily: "monospace",
          }}
        >
          {open ? "▼" : "▲"} Debug ({entries.length})
        </button>
        <button
          onClick={dclear}
          style={{
            background: "transparent",
            color: "#cfe",
            border: "1px solid #2EC4B6",
            borderRadius: 4,
            padding: "2px 8px",
            fontSize: 11,
            fontFamily: "monospace",
          }}
        >
          Clear
        </button>
      </div>
      {open && (
        <div
          style={{
            padding: "0 10px 10px",
            overflowY: "auto",
            maxHeight: "calc(45vh - 32px)",
          }}
        >
          {entries.length === 0 ? (
            <div style={{ color: "#888" }}>(no events yet)</div>
          ) : (
            entries.map((e, i) => (
              <div
                key={i}
                style={{
                  color:
                    e.level === "error"
                      ? "#ff8888"
                      : e.level === "warn"
                        ? "#ffd17a"
                        : "#cfe",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                <span style={{ color: "#888" }}>{e.t.toString().padStart(5, " ")}ms </span>
                {e.msg}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
