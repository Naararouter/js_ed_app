"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

import "./i18n";

import { ControlsCard } from "./ControlsCard";
import { StatusPanel } from "./StatusPanel";
import { ReportTabs } from "./ReportTabs";
import { TASKS } from "./tasks";
import {
  collectSpans,
  type HighlightMode,
  type Span,
  type FreeLabel,
  FREE_LABEL_OPTIONS,
} from "./highlight";
import { toMonacoRange, type MonacoDecoration, type MonacoEditor } from "./monaco";
import { rangesEqual, spanKey } from "./span-utils";
import type { Result } from "./types";

const TAB_TASK = "task";
const TAB_REPORT = "report";

function getUnionLength(spans: Span[]): number {
  if (spans.length === 0) return 0;
  const sorted = [...spans].sort((a, b) => a.start - b.start || a.end - b.end);
  let covered = 0;
  let currentStart: number | null = null;
  let currentEnd = 0;

  for (const span of sorted) {
    const start = Math.min(span.start, span.end);
    const end = Math.max(span.start, span.end);
    if (end <= start) continue;
    if (currentStart == null) {
      currentStart = start;
      currentEnd = end;
      continue;
    }
    if (start <= currentEnd) {
      currentEnd = Math.max(currentEnd, end);
    } else {
      covered += currentEnd - currentStart;
      currentStart = start;
      currentEnd = end;
    }
  }

  if (currentStart != null) {
    covered += currentEnd - currentStart;
  }

  return covered;
}

export default function Page() {
  const editorRef = useRef<MonacoEditor | null>(null);
  const decorationsRef = useRef<string[]>([]);

  const [mode, setMode] = useState<HighlightMode>("expressions");
  const [codeText, setCodeText] = useState<string>(TASKS["S1 — базовое"]);
  const [groundTruth, setGroundTruth] = useState<Span[]>([]);
  const [userSpans, setUserSpans] = useState<Span[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [activeTab, setActiveTab] = useState(TAB_TASK);
  const [freeLabel, setFreeLabel] = useState<FreeLabel>(FREE_LABEL_OPTIONS[0]);
  const [coverage, setCoverage] = useState<number | null>(null);

  const freeTargets = useMemo(() => {
    const map = new Map<string, { span: Span; label: FreeLabel }>();
    for (const label of FREE_LABEL_OPTIONS) {
      const spans = collectSpans(codeText, label);
      for (const span of spans) {
        const key = spanKey(span);
        if (!map.has(key)) {
          map.set(key, { span, label });
        }
      }
    }
    return map;
  }, [codeText]);

  const freeTargetSpanList = useMemo(
    () => Array.from(freeTargets.values()).map((entry) => entry.span),
    [freeTargets]
  );

  const freeTargetLength = useMemo(
    () => getUnionLength(freeTargetSpanList),
    [freeTargetSpanList]
  );

  useEffect(() => {
    try {
      const spans = collectSpans(codeText, mode);
      setGroundTruth(spans);
      setResult(null);
      setUserSpans([]);
      setCoverage(null);
      setActiveTab(TAB_TASK);
    } catch (error) {
      console.error(error);
      setGroundTruth([]);
      setResult(null);
      setUserSpans([]);
      setCoverage(null);
      setActiveTab(TAB_TASK);
    }
  }, [codeText, mode]);

  useEffect(() => {
    const editor = editorRef.current;
    const model = editor?.getModel();
    if (!editor || !model) return;

    const decorations: MonacoDecoration[] = [];

    for (const span of groundTruth) {
      decorations.push({
        range: toMonacoRange(model, span.start, span.end),
        options: {
          className: "bg-emerald-200/30 rounded-md",
          stickiness: 1,
          overviewRuler: { position: 7, color: "#4ade8044" },
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

    const span: Span = { start, end, kind: mode === "free" ? freeLabel : "User" };
    setUserSpans((prev) =>
      prev.some((item) => rangesEqual(item, span)) ? prev : [...prev, span]
    );
    setResult(null);
    setCoverage(null);
  };

  const clearUser = () => {
    setUserSpans([]);
    setResult(null);
    setCoverage(null);
  };

  const removeSelection = (index: number) => {
    setUserSpans((prev) => prev.filter((_, idx) => idx !== index));
    setResult(null);
    setCoverage(null);
  };

  const check = () => {
    if (mode === "free") {
      const tp: Span[] = [];
      const fp: Span[] = [];
      const fn: Span[] = [];
      const matchedKeys = new Set<string>();
      const correctCoverageSpans: Span[] = [];

      for (const span of userSpans) {
        const target = freeTargets.get(spanKey(span));
        if (target && target.label === span.kind) {
          tp.push(span);
          matchedKeys.add(spanKey(span));
          correctCoverageSpans.push(target.span);
        } else {
          fp.push(span);
        }
      }

      for (const [key, target] of freeTargets) {
        if (!matchedKeys.has(key)) {
          fn.push({ ...target.span, kind: target.label });
        }
      }

      const ratio =
        freeTargetLength === 0
          ? 1
          : getUnionLength(correctCoverageSpans) / freeTargetLength;
      setCoverage(ratio);
      setResult({ tp, fp, fn });
      setActiveTab(TAB_REPORT);
      return;
    }

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
    if (mode === "free") return;
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

  const liveCoverage = useMemo(() => {
    if (mode !== "free") return null;
    if (freeTargetLength === 0) return 1;
    const correctSpans = userSpans.filter((span) => {
      const target = freeTargets.get(spanKey(span));
      return target && target.label === span.kind;
    });
    return getUnionLength(correctSpans) / freeTargetLength;
  }, [mode, userSpans, freeTargets, freeTargetLength]);

  const score = useMemo(() => {
    if (mode === "free" || !result) return null;
    const raw = result.tp.length - 0.5 * result.fp.length;
    return {
      raw,
      max: groundTruth.length,
      tp: result.tp.length,
      fp: result.fp.length,
      fn: result.fn.length,
    };
  }, [mode, result, groundTruth.length]);

  const handleModeChange = (nextMode: HighlightMode) => {
    setMode(nextMode);
    if (nextMode !== "free") {
      setFreeLabel(FREE_LABEL_OPTIONS[0]);
    }
    setUserSpans([]);
    setResult(null);
    setCoverage(null);
  };

  const handleTaskSelect = (taskKey: string) => {
    setCodeText(TASKS[taskKey]);
    setUserSpans([]);
    setResult(null);
    setCoverage(null);
  };

  return (
    <div className="w-full min-h-screen p-4 md:p-6 grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-12 bg-neutral-50">
      <div className="lg:col-span-8 space-y-3">
        <ControlsCard
          mode={mode}
          codeText={codeText}
          tasks={TASKS}
          freeLabel={freeLabel}
          onFreeLabelChange={setFreeLabel}
          onModeChange={handleModeChange}
          onTaskSelect={handleTaskSelect}
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
          mode={mode}
          coverage={mode === "free" ? coverage ?? liveCoverage : null}
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
          mode={mode}
          coverage={mode === "free" ? coverage ?? liveCoverage : null}
          userSpans={userSpans}
        />
      </div>
    </div>
  );
}
