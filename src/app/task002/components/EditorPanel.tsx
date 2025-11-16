"use client";

import { useMemo } from "react";

import Editor from "@monaco-editor/react";

import { usePlaygroundStore } from "../store";

export function EditorPanel() {
  const activeFileId = usePlaygroundStore((state) => state.activeFileId);
  const entries = usePlaygroundStore((state) => state.entries);
  const updateFileContent = usePlaygroundStore((state) => state.updateFileContent);
  const file = activeFileId ? entries[activeFileId] : null;

  const language = useMemo(() => {
    if (!file || file.type !== "file") return "plaintext";
    if (file.language) return file.language;
    if (file.name.endsWith(".md")) return "markdown";
    if (file.name.endsWith(".ts")) return "typescript";
    if (file.name.endsWith(".tsx")) return "typescript";
    if (file.name.endsWith(".js")) return "javascript";
    return "plaintext";
  }, [file]);

  if (!file || file.type !== "file") {
    return (
      <section className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border bg-muted/30 p-6 text-center text-sm text-muted-foreground shadow-inner">
        Select a file from the tree to start editing. Edits automatically sync to
        the timeline and future git status checks.
      </section>
    );
  }

  return (
    <section className="flex min-h-[420px] flex-col rounded-2xl border bg-white shadow-sm">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            editor
          </p>
          <h2 className="text-lg font-semibold">{file.name}</h2>
        </div>
        {file.isDirty ? (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
            Dirty
          </span>
        ) : (
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
            Clean
          </span>
        )}
      </header>
      <div className="flex-1 overflow-hidden rounded-b-2xl">
        <Editor
          height="100%"
          defaultLanguage={language}
          language={language}
          value={file.content}
          onChange={(value) => updateFileContent(file.id, value ?? "")}
          theme="vs-light"
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            scrollBeyondLastLine: false,
            tabSize: 2,
            renderWhitespace: "none",
          }}
        />
      </div>
    </section>
  );
}
