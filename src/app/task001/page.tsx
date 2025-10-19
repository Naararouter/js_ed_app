"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

import { ControlsCard } from "./ControlsCard";
import { StatusPanel } from "./StatusPanel";
import { ReportTabs } from "./ReportTabs";
import { TASKS } from "./tasks";
import {
  collectSpans,
  MODE_CONFIG,
  type HighlightMode,
  type Span,
} from "./highlight";
import { toMonacoRange, type MonacoDecoration, type MonacoEditor } from "./monaco";
import { rangesEqual, spanKey } from "./span-utils";
import type { Result } from "./types";

const TAB_TASK = "task";
const TAB_REPORT = "report";

export default function Page() {
  const editorRef = useRef<MonacoEditor | null>(null);
  const decorationsRef = useRef<string[]>([]);

  const [mode, setMode] = useState<HighlightMode>("expressions");
  const [codeText, setCodeText] = useState<string>(TASKS["S1 — базовое"]);
  const [outerOnly, setOuterOnly] = useState(false);
  const [groundTruth, setGroundTruth] = useState<Span[]>([]);
  const [userSpans, setUserSpans] = useState<Span[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [activeTab, setActiveTab] = useState(TAB_TASK);

  const supportsOuterOnly = Boolean(MODE_CONFIG[mode]?.supportsOuterOnly);

  useEffect(() => {
    try {
      const spans = collectSpans(codeText, mode, {
        outermostOnly: supportsOuterOnly ? outerOnly : false,
      });
      setGroundTruth(spans);
      setResult(null);
    } catch (error) {
      console.error(error);
      setGroundTruth([]);
      setResult(null);
    }
  }, [codeText, mode, outerOnly, supportsOuterOnly]);

  useEffect(() => {
    const editor = editorRef.current;
    const model = editor?.getModel();
    if (!editor || !model) return;

    const decorations: MonacoDecoration[] = [];

    for (const span of groundTruth) {
      decorations.push({
        range: toMonacoRange(model, span.start, span.end),
        options: {
          className: "border-2 border-dashed rounded-md",
          stickiness: 1,
          overviewRuler: { position: 7, color: "#8888" },
        },
      });
    }

    for (const span of userSpans) {
      decorations.push({
        range: toMonacoRange(model, span.start, span.end),
        options: {
          className: "bg-amber-200/40 rounded-md",
          stickiness: 1,
          overviewRuler: { position: 7, color: "#ffaa00" },
        },
      });
    }

    decorationsRef.current = editor.deltaDecorations(
      decorationsRef.current,
      decorations
    );
  }, [groundTruth, userSpans]);

  const addSelection = () => {
    const editor = editorRef.current;
    const model = editor?.getModel();
    const selection = editor?.getSelection();
    if (!editor || !model || !selection) return;

    const start = model.getOffsetAt({
      lineNumber: selection.startLineNumber,
      column: selection.startColumn,
    });
    const end = model.getOffsetAt({
      lineNumber: selection.endLineNumber,
      column: selection.endColumn,
    });
    if (end <= start) return;

    const span: Span = { start, end, kind: "User" };
    setUserSpans((prev) =>
      prev.some((item) => rangesEqual(item, span)) ? prev : [...prev, span]
    );
  };

  const clearUser = () => {
    setUserSpans([]);
    setResult(null);
  };

  const removeSelection = (index: number) => {
    setUserSpans((prev) => prev.filter((_, idx) => idx !== index));
  };

  const check = () => {
    const gt = new Map(groundTruth.map((span) => [spanKey(span), span]));
    const user = new Map(userSpans.map((span) => [spanKey(span), span]));

    const tp: Span[] = [];
    const fp: Span[] = [];
    const fn: Span[] = [];

    for (const [key, span] of user) {
      if (gt.has(key)) {
        tp.push(span);
      } else {
        fp.push(span);
      }
    }
    for (const [key, span] of gt) {
      if (!user.has(key)) fn.push(span);
    }

    setResult({ tp, fp, fn });
    setActiveTab(TAB_REPORT);
  };

  const hintOne = () => {
    const next = groundTruth.find(
      (span) => !userSpans.some((item) => rangesEqual(item, span))
    );
    if (!next) return;
    setUserSpans((prev) => [...prev, { ...next, kind: "Hint" }]);
  };

  const onMount = (editor: MonacoEditor) => {
    editorRef.current = editor;
  };

  const highlightRange = (span: Span) => {
    const editor = editorRef.current;
    const model = editor?.getModel();
    if (!editor || !model) return;

    const range = toMonacoRange(model, span.start, span.end);
    editor.revealRangeInCenter(range);
    editor.setSelection(range);
    editor.focus();
  };

  const score = useMemo(() => {
    if (!result) return null;
    const raw = result.tp.length - 0.5 * result.fp.length;
    return {
      raw,
      max: groundTruth.length,
      tp: result.tp.length,
      fp: result.fp.length,
      fn: result.fn.length,
    };
  }, [result, groundTruth.length]);

  const handleModeChange = (nextMode: HighlightMode) => {
    setMode(nextMode);
    setUserSpans([]);
    setResult(null);
  };

  const handleTaskSelect = (taskKey: string) => {
    setCodeText(TASKS[taskKey]);
    setUserSpans([]);
    setResult(null);
  };

  return (
    <div className="w-full min-h-screen p-4 md:p-6 grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-12 bg-neutral-50">
      <div className="lg:col-span-8 space-y-3">
        <ControlsCard
          mode={mode}
          codeText={codeText}
          tasks={TASKS}
          outerOnly={outerOnly}
          supportsOuterOnly={supportsOuterOnly}
          onModeChange={handleModeChange}
          onTaskSelect={handleTaskSelect}
          onToggleOuter={setOuterOnly}
          onAddSelection={addSelection}
          onHint={hintOne}
          onClear={clearUser}
          onCheck={check}
          onMount={onMount}
        />
      </div>

      <div className="lg:col-span-4 space-y-3">
        <StatusPanel
          groundTruthCount={groundTruth.length}
          userSpans={userSpans}
          codeText={codeText}
          onRemove={removeSelection}
        />

        <ReportTabs
          activeTab={activeTab}
          taskTabId={TAB_TASK}
          reportTabId={TAB_REPORT}
          onTabChange={setActiveTab}
          result={result}
          score={score}
          codeText={codeText}
          onSpanClick={highlightRange}
        />
      </div>
    </div>
  );
}
