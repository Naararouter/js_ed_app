'use client';
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Editor, useMonaco } from "@monaco-editor/react";
import * as BabelParser from "@babel/parser";
import traverse, { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle, Target, Code2, Info } from "lucide-react";

// =====================
// Types
// =====================

type Span = { start: number; end: number; kind: string };

// =====================
// Demo tasks
// =====================

const TASKS: Record<string, string> = {
  "S1 — базовое": "const x = a + b * foo(2)\nconsole.log(`${x} px`)",
  "S2 — опц. чейнинг": 'user?.profile?.getName?.(id ?? "guest") || defaultName',
  "S3 — выражения в if": "if (check(a = 1)) { doIt() }",
  "S4 — объекты и вычисляемые ключи":
    "const o = { [a+b]: 1, k: v ?? (w && z()) }",
  "S5 — стрелки и IIFE": "const f = (x) => x*x; (function(){ return f(2) })()",
};
// =====================
// Babel helpers
// =====================

function parseCode(src: string, opts?: { jsx?: boolean; ts?: boolean }) {
  return BabelParser.parse(src, {
    sourceType: "unambiguous",
    ranges: true,
    plugins: [
      opts?.jsx ? "jsx" : ("" as any),
      opts?.ts ? "typescript" : ("" as any),
      "classProperties",
      "importMeta",
      "topLevelAwait",
    ].filter(Boolean) as any,
  });
}

function collectExpressions(
  src: string,
  { outermostOnly }: { outermostOnly: boolean }
): Span[] {
  const ast = parseCode(src);
  const out: Span[] = [];
  traverse(ast, {
    enter(path: NodePath) {
      const n = path.node as t.Node;
      if (t.isExpression(n)) {
        const parent = path.parent as t.Node | undefined;
        const pushIt = outermostOnly
          ? !(parent && t.isExpression(parent))
          : true;
        if (pushIt && n.start != null && n.end != null) {
          // Special case: avoid counting the same range multiple times (rare)
          out.push({ start: n.start, end: n.end, kind: (n as any).type });
        }
      }
    },
  });
  // Normalize / deduplicate identical spans
  const seen = new Set<string>();
  const uniq = out.filter((s) => {
    const k = `${s.start}-${s.end}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return uniq.sort((a, b) => a.start - b.start || a.end - b.end);
}

// =====================
// Monaco helpers
// =====================

function toMonacoRange(
  model: monaco.editor.ITextModel,
  start: number,
  end: number
) {
  const s = model.getPositionAt(start);
  const e = model.getPositionAt(end);
  return {
    startLineNumber: s.lineNumber,
    startColumn: s.column,
    endLineNumber: e.lineNumber,
    endColumn: e.column,
  };
}

function rangesEqual(a: Span, b: Span) {
  return a.start === b.start && a.end === b.end;
}

function spanKey(s: Span) {
  return `${s.start}-${s.end}`;
}

// =====================
// Main Component
// =====================

export default function ExpressionsTrainerPOC() {
  const monaco = useMonaco();
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [code, setCode] = useState<string>(TASKS["S1 — базовое"]);
  const [outerOnly, setOuterOnly] = useState(true);
  const [groundTruth, setGroundTruth] = useState<Span[]>([]);
  const [userSpans, setUserSpans] = useState<Span[]>([]);
  const [decorations, setDecorations] = useState<string[]>([]);
  const [result, setResult] = useState<{
    tp: Span[];
    fp: Span[];
    fn: Span[];
  } | null>(null);
  const [activeTab, setActiveTab] = useState("task");

  // Build ground truth on code or mode change
  useEffect(() => {
    try {
      const gt = collectExpressions(code, { outermostOnly: outerOnly });
      setGroundTruth(gt);
      setResult(null);
    } catch (e) {
      console.error(e);
      setGroundTruth([]);
      setResult(null);
    }
  }, [code, outerOnly]);

  // Decorate editor: ground truth (faint border) + user (solid background)
  useEffect(() => {
    if (!monaco || !editorRef.current) return;
    const ed = editorRef.current;
    const model = ed.getModel();
    if (!model) return;

    const decos: monaco.editor.IModelDeltaDecoration[] = [];

    // Ground truth styling (subtle outline)
    for (const s of groundTruth) {
      const r = toMonacoRange(model, s.start, s.end);
      decos.push({
        range: r as any,
        options: {
          className: "border-2 border-dashed rounded-md",
          inlineClassName: "",
          stickiness: 1,
          overviewRuler: { position: 7, color: "#8888" },
        },
      });
    }

    // User picks styling (filled background)
    for (const s of userSpans) {
      const r = toMonacoRange(model, s.start, s.end);
      decos.push({
        range: r as any,
        options: {
          className: "bg-amber-200/40 rounded-md",
          inlineClassName: "",
          stickiness: 1,
          overviewRuler: { position: 7, color: "#ffaa00" },
        },
      });
    }

    const ids = ed.deltaDecorations(decorations, decos);
    setDecorations(ids);
  }, [monaco, groundTruth, userSpans]);

  // Add current selection as user span
  const addSelection = () => {
    const ed = editorRef.current;
    const model = ed?.getModel();
    if (!ed || !model) return;
    const sel = ed.getSelection();
    if (!sel) return;
    const start = model.getOffsetAt({
      lineNumber: sel.startLineNumber,
      column: sel.startColumn,
    });
    const end = model.getOffsetAt({
      lineNumber: sel.endLineNumber,
      column: sel.endColumn,
    });
    if (end <= start) return;
    const span: Span = { start, end, kind: "User" };

    setUserSpans((prev) => {
      const exists = prev.some((p) => rangesEqual(p, span));
      return exists ? prev : [...prev, span];
    });
  };

  const clearUser = () => setUserSpans([]);

  // Evaluate
  const check = () => {
    const gtMap = new Map(groundTruth.map((s) => [spanKey(s), s]));
    const userMap = new Map(userSpans.map((s) => [spanKey(s), s]));

    const tp: Span[] = [];
    const fp: Span[] = [];

    for (const [k, u] of userMap) {
      if (gtMap.has(k)) tp.push(u);
      else fp.push(u);
    }

    const fn: Span[] = [];
    for (const [k, g] of gtMap) {
      if (!userMap.has(k)) fn.push(g);
    }

    setResult({ tp, fp, fn });
    setActiveTab("report");
  };

  // Insert ground truth hint for next expression (outermost) that is not yet picked
  const hintOne = () => {
    const next = groundTruth.find(
      (gt) => !userSpans.some((u) => rangesEqual(u, gt))
    );
    if (!next) return;
    setUserSpans((prev) => [...prev, { ...next, kind: "Hint" }]);
  };

  const onMount = (editor: monaco.editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;
  };

  // UI bits
  const score = useMemo(() => {
    if (!result) return null;
    const { tp, fp, fn } = result;
    const raw = tp.length - 0.5 * fp.length; // simple scoring
    const max = groundTruth.length;
    return { raw, max, tp: tp.length, fp: fp.length, fn: fn.length };
  }, [result, groundTruth.length]);

  return (
    <div className="w-full min-h-screen p-4 md:p-6 grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-12 bg-neutral-50">
      <div className="lg:col-span-8 space-y-3">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Target className="w-5 h-5" />
              Задание
            </CardTitle>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  id="outerOnly"
                  checked={outerOnly}
                  onCheckedChange={setOuterOnly}
                />
                <Label htmlFor="outerOnly" className="cursor-pointer">
                  Только внешние выражения
                </Label>
              </div>
              <Button variant="secondary" onClick={hintOne}>
                Подсказка
              </Button>
              <Button variant="ghost" onClick={clearUser}>
                Сбросить
              </Button>
              <Button onClick={check} className="gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Проверить
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-2 pb-2">
              {Object.keys(TASKS).map((k) => (
                <Button
                  key={k}
                  size="sm"
                  variant={code === TASKS[k] ? "default" : "outline"}
                  onClick={() => {
                    setCode(TASKS[k]);
                    setUserSpans([]);
                  }}
                >
                  {k}
                </Button>
              ))}
            </div>
            <div className="rounded-xl overflow-hidden ring-1 ring-neutral-200">
              <Editor
                height="420px"
                defaultLanguage="javascript"
                value={code}
                onChange={(v) => setCode(v ?? "")}
                onMount={onMount}
                options={{
                  fontSize: 14,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  renderLineHighlight: "none",
                  wordWrap: "on",
                  occurrencesHighlight: false,
                  selectionHighlight: false,
                }}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={addSelection}
                className="gap-2"
              >
                <Code2 className="w-4 h-4" />
                Добавить текущую выделенную область
              </Button>
              <div className="text-sm text-neutral-600 flex items-center gap-2">
                <Info className="w-4 h-4" />
                Выделите фрагмент в редакторе и нажмите «Добавить». Повторяйте
                для всех выражений.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-4 space-y-3">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Панель статуса</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span>Эталонных выражений:</span>
              <span className="font-medium">{groundTruth.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Ваших отметок:</span>
              <span className="font-medium">{userSpans.length}</span>
            </div>
            <div className="pt-2 border-t">
              <div className="font-medium mb-2">Ваши выделения</div>
              <div className="max-h-40 overflow-auto space-y-1">
                {userSpans.map((s, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-neutral-600">
                      {s.start}…{s.end}
                    </span>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() =>
                        setUserSpans((prev) => prev.filter((_, j) => j !== i))
                      }
                    >
                      удалить
                    </Button>
                  </div>
                ))}
                {userSpans.length === 0 && (
                  <div className="text-neutral-500">— ничего —</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="task">Отчёт</TabsTrigger>
            <TabsTrigger value="report">Детали</TabsTrigger>
          </TabsList>
          <TabsContent value="task">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Рекомендации</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    Режим «Только внешние» считает выражения, у которых родитель
                    — не выражение.
                  </li>
                  <li>
                    Подсказка добавляет следующее ещё не отмеченное внешнее
                    выражение.
                  </li>
                  <li>
                    Лёгкие ловушки: вся конструкция <code>if (...) {`{}`}</code>{" "}
                    — это оператор, а не выражение; внутри — вызов{" "}
                    <code>doIt()</code> сам по себе выражение.
                  </li>
                </ul>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="report">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>Результаты проверки</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {result ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-3 text-base">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                        Верно: <b>{result.tp.length}</b>
                      </span>
                      <span className="flex items-center gap-1">
                        <XCircle className="w-5 h-5 text-red-600" />
                        Лишние: <b>{result.fp.length}</b>
                      </span>
                      <span className="flex items-center gap-1">
                        <Target className="w-5 h-5 text-amber-600" />
                        Пропущены: <b>{result.fn.length}</b>
                      </span>
                    </div>
                    {score && (
                      <div className="text-neutral-700">
                        Счёт: <b>{score.raw.toFixed(1)}</b> из возможных{" "}
                        <b>{score.max}</b>
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                      <div>
                        <div className="font-medium mb-1">Верно</div>
                        <ul className="text-neutral-700 max-h-36 overflow-auto space-y-1">
                          {result.tp.map((s, i) => (
                            <li key={"tp" + i}>
                              {s.start}…{s.end}
                            </li>
                          ))}
                          {result.tp.length === 0 && (
                            <li className="text-neutral-500">—</li>
                          )}
                        </ul>
                      </div>
                      <div>
                        <div className="font-medium mb-1">Лишние</div>
                        <ul className="text-neutral-700 max-h-36 overflow-auto space-y-1">
                          {result.fp.map((s, i) => (
                            <li key={"fp" + i}>
                              {s.start}…{s.end}
                            </li>
                          ))}
                          {result.fp.length === 0 && (
                            <li className="text-neutral-500">—</li>
                          )}
                        </ul>
                      </div>
                      <div>
                        <div className="font-medium mb-1">Пропущены</div>
                        <ul className="text-neutral-700 max-h-36 overflow-auto space-y-1">
                          {result.fn.map((s, i) => (
                            <li key={"fn" + i}>
                              {s.start}…{s.end}
                            </li>
                          ))}
                          {result.fn.length === 0 && (
                            <li className="text-neutral-500">—</li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-neutral-500">
                    Нажмите «Проверить», чтобы увидеть отчёт.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
