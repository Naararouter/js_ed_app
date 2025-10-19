"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";

// ВАЖНО: редактор без SSR
const Editor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

// Если у тебя есть shadcn/ui — используй эти импорты.
// Если нет — замени на обычные <button>/<div> c Tailwind.
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle, Target, Code2, Info } from "lucide-react";

import * as BabelParser from "@babel/parser";
import traverse, { type NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import type { ParserPlugin } from "@babel/parser";

// =====================
// Types
// =====================
type Span = { start: number; end: number; kind: string };
type HighlightMode =
  | "expressions"
  | "identifiers"
  | "operators"
  | "keywords"
  | "functionDefinitions"
  | "functionCalls"
  | "objectKeys"
  | "literals";

type ModeConfig = {
  label: string;
  supportsOuterOnly?: boolean;
};

type CollectOptions = {
  outermostOnly?: boolean;
};

type BabelToken = {
  start: number;
  end: number;
  type: {
    label: string;
    keyword?: string;
    binop?: boolean;
    prefix?: boolean;
    postfix?: boolean;
    isAssign?: boolean;
  };
  value?: string;
};

type MonacoPosition = {
  lineNumber: number;
  column: number;
};

type MonacoRange = {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
};

type MonacoModel = {
  getPositionAt(offset: number): MonacoPosition;
  getOffsetAt(position: MonacoPosition): number;
};

type DecorationOptions = {
  className: string;
  stickiness: number;
  overviewRuler: { position: number; color: string };
};

type MonacoDecoration = {
  range: MonacoRange;
  options: DecorationOptions;
};

type MonacoEditor = {
  getModel(): MonacoModel | null;
  getSelection(): MonacoRange | null;
  deltaDecorations(
    oldDecorations: string[],
    decorations: MonacoDecoration[]
  ): string[];
  revealRangeInCenter(range: MonacoRange): void;
  setSelection(range: MonacoRange): void;
  focus(): void;
};

const MODE_CONFIG: Record<HighlightMode, ModeConfig> = {
  expressions: { label: "Выражения", supportsOuterOnly: true },
  identifiers: { label: "Идентификаторы" },
  operators: { label: "Операторы" },
  keywords: { label: "Ключевые слова" },
  functionDefinitions: { label: "Опред. функций" },
  functionCalls: { label: "Вызовы функций" },
  objectKeys: { label: "Ключи объекта" },
  literals: { label: "Литералы" },
};

const MODE_ORDER: HighlightMode[] = [
  "expressions",
  "identifiers",
  "operators",
  "keywords",
  "functionDefinitions",
  "functionCalls",
  "objectKeys",
  "literals",
];

const isOptionalCallExpression = (
  node: t.Node
): node is t.OptionalCallExpression => node.type === "OptionalCallExpression";

const isTSDeclareFunction = (
  node: t.Node
): node is t.TSDeclareFunction => node.type === "TSDeclareFunction";

type TypeHelpers = {
  isBigIntLiteral?: (value: t.Node) => value is t.BigIntLiteral;
};

const typeHelpers = t as unknown as TypeHelpers;

const isBigIntLiteral = (node: t.Node): node is t.BigIntLiteral =>
  typeof typeHelpers.isBigIntLiteral === "function"
    ? typeHelpers.isBigIntLiteral(node)
    : false;

// =====================
// Demo tasks (строки БЕЗ бэктиков снаружи)
// =====================
const code = (...lines: string[]) => lines.join("\n");

const TASKS: Record<string, string> = {
  "S1 — базовое": code("const x = a + b * foo(2)", "console.log(`${x} px`)"),
  "S2 — опц. чейнинг": code(
    'user?.profile?.getName?.(id ?? "guest") || defaultName'
  ),
  "S3 — выражения в if": code("if (check(a = 1)) { doIt() }"),
  "S4 — объекты и вычисляемые ключи": code(
    "const o = { [a+b]: 1, k: v ?? (w && z()) }"
  ),
  "S5 — стрелки и IIFE": code(
    "const f = (x) => x*x; (function(){ return f(2) })()"
  ),
  "S6 — объект": code(
    "const propertyName = 'dynamic';",
    "const everybodyObj = {",
    "  0: 'Yetu',",
    "  1: 'Tabitha',",
    "  2: 'Rasha',",
    "  3: 'Max',",
    "  4: 'Yazul',",
    "  5: 'Todd',",
    "  findIndex: function () { return 'empty'; },",
    "  [propertyName]: () => 'empty2'",
    "};"
  ),
};

// =====================
// Babel helpers
// =====================
function parseCode(src: string) {
  const plugins: ParserPlugin[] = [
    "jsx",
    "typescript",
    "classProperties",
    "importMeta",
    "topLevelAwait",
  ];
  return BabelParser.parse(src, {
    sourceType: "unambiguous",
    ranges: true,
    tokens: true,
    plugins,
  });
}

function collectSpans(
  src: string,
  mode: HighlightMode,
  { outermostOnly }: CollectOptions
): Span[] {
  const ast = parseCode(src) as unknown as t.File & { tokens?: BabelToken[] };
  const tokens = ast.tokens ?? [];
  let spans: Span[] = [];

  switch (mode) {
    case "expressions":
      spans = collectExpressionSpans(ast, Boolean(outermostOnly));
      break;
    case "identifiers":
      spans = collectIdentifierSpans(ast);
      break;
    case "operators":
      spans = collectOperatorSpans(tokens);
      break;
    case "keywords":
      spans = collectKeywordSpans(tokens);
      break;
    case "functionDefinitions":
      spans = collectFunctionDefinitionSpans(ast);
      break;
    case "functionCalls":
      spans = collectFunctionCallSpans(ast);
      break;
    case "objectKeys":
      spans = collectObjectKeySpans(ast);
      break;
    case "literals":
      spans = collectLiteralSpans(ast);
      break;
    default:
      spans = [];
  }

  return dedupeAndSort(spans);
}

function collectExpressionSpans(ast: t.Node, outermostOnly: boolean): Span[] {
  const out: Span[] = [];
  traverse(ast, {
    enter(path: NodePath) {
      const n = path.node as t.Node;
      if (t.isExpression(n) && n.start != null && n.end != null) {
        if (outermostOnly) {
          const p = path.parent as t.Node | undefined;
          if (p && t.isExpression(p)) return; // пропускаем вложенные
        }
        if (t.isIdentifier(n)) return;
        out.push({ start: n.start, end: n.end, kind: n.type });
      }
    },
  });

  return out;
}

function collectIdentifierSpans(ast: t.Node): Span[] {
  const out: Span[] = [];
  traverse(ast, {
    Identifier(path) {
      const n = path.node;
      if (n.start != null && n.end != null) {
        out.push({ start: n.start, end: n.end, kind: "Identifier" });
      }
    },
    JSXIdentifier(path) {
      const n = path.node;
      if (n.start != null && n.end != null) {
        out.push({ start: n.start, end: n.end, kind: "JSXIdentifier" });
      }
    },
  });

  return out;
}

const operatorLabelSet = new Set([
  "+",
  "-",
  "*",
  "/",
  "%",
  "**",
  "++",
  "--",
  "=",
  "+=",
  "-=",
  "*=",
  "/=",
  "%=",
  "**=",
  "<<",
  ">>",
  ">>>",
  "<<=",
  ">>=",
  ">>>=",
  "&",
  "|",
  "^",
  "~",
  "!",
  "&&",
  "||",
  "??",
  "?.",
  ">",
  "<",
  ">=",
  "<=",
  "==",
  "!=",
  "===",
  "!==",
  "=>",
  "?",
  ":",
  "??=",
  "&&=",
  "||=",
]);

function collectOperatorSpans(tokens: BabelToken[]): Span[] {
  return tokens
    .filter((token) => {
      const type = token.type ?? {};
      if (type.keyword) return false;
      if (token.start == null || token.end == null) return false;
      return (
        Boolean(type.binop) ||
        Boolean(type.prefix) ||
        Boolean(type.postfix) ||
        Boolean(type.isAssign) ||
        operatorLabelSet.has(type.label)
      );
    })
    .map((token) => ({
      start: token.start,
      end: token.end,
      kind: `Operator`,
    }));
}

const keywordFallbackLabels = new Set([
  "null",
  "true",
  "false",
  "this",
  "super",
  "new",
]);

function collectKeywordSpans(tokens: BabelToken[]): Span[] {
  return tokens
    .filter((token) => {
      const type = token.type ?? {};
      if (token.start == null || token.end == null) return false;
      return Boolean(type.keyword) || keywordFallbackLabels.has(type.label);
    })
    .map((token) => ({
      start: token.start,
      end: token.end,
      kind: "Keyword",
    }));
}

function collectFunctionDefinitionSpans(ast: t.Node): Span[] {
  const out: Span[] = [];
  traverse(ast, {
    enter(path) {
      const n = path.node;
      if (n.start == null || n.end == null) return;
      if (t.isFunctionDeclaration(n)) {
        out.push({ start: n.start, end: n.end, kind: "FunctionDeclaration" });
      } else if (t.isFunctionExpression(n)) {
        out.push({ start: n.start, end: n.end, kind: "FunctionExpression" });
      } else if (t.isArrowFunctionExpression(n)) {
        out.push({
          start: n.start,
          end: n.end,
          kind: "ArrowFunctionExpression",
        });
      } else if (t.isObjectMethod(n)) {
        out.push({ start: n.start, end: n.end, kind: "ObjectMethod" });
      } else if (t.isClassMethod(n)) {
        out.push({ start: n.start, end: n.end, kind: "ClassMethod" });
      } else if (t.isClassPrivateMethod(n)) {
        out.push({ start: n.start, end: n.end, kind: "ClassPrivateMethod" });
      } else if (isTSDeclareFunction(n)) {
        out.push({ start: n.start, end: n.end, kind: "TSDeclareFunction" });
      }
    },
  });
  return out;
}

function collectFunctionCallSpans(ast: t.Node): Span[] {
  const out: Span[] = [];
  traverse(ast, {
    enter(path) {
      const n = path.node;
      if (n.start == null || n.end == null) return;
      if (isOptionalCallExpression(n)) {
        out.push({
          start: n.start,
          end: n.end,
          kind: "OptionalCallExpression",
        });
      } else if (t.isCallExpression(n)) {
        out.push({ start: n.start, end: n.end, kind: "CallExpression" });
      } else if (t.isNewExpression(n)) {
        out.push({ start: n.start, end: n.end, kind: "NewExpression" });
      }
    },
  });
  return out;
}

function collectObjectKeySpans(ast: t.Node): Span[] {
  const out: Span[] = [];

  const pushKey = (key: t.Node, computed: boolean) => {
    if (key.start == null || key.end == null) return;
    out.push({
      start: key.start,
      end: key.end,
      kind: computed ? "ObjectKey[computed]" : "ObjectKey",
    });
  };

  traverse(ast, {
    ObjectProperty(path) {
      pushKey(path.node.key, path.node.computed ?? false);
    },
    ObjectMethod(path) {
      pushKey(path.node.key, path.node.computed ?? false);
    },
  });

  return out;
}

function collectLiteralSpans(ast: t.Node): Span[] {
  const out: Span[] = [];
  traverse(ast, {
    enter(path) {
      const n = path.node;
      if (n.start == null || n.end == null) return;
      if (t.isTemplateLiteral(n)) {
        out.push({ start: n.start, end: n.end, kind: "TemplateLiteral" });
        return;
      }
      if (
        t.isStringLiteral(n) ||
        t.isNumericLiteral(n) ||
        t.isBooleanLiteral(n) ||
        t.isNullLiteral(n) ||
        t.isRegExpLiteral(n) ||
        isBigIntLiteral(n)
      ) {
        out.push({ start: n.start, end: n.end, kind: n.type });
      }
    },
  });
  return out;
}

function dedupeAndSort(spans: Span[]): Span[] {
  // dedup + сортировка
  const seen = new Set<string>();
  const uniq = spans.filter((s) => {
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
function toMonacoRange(model: MonacoModel, start: number, end: number): MonacoRange {
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
// Component
// =====================
export default function Page() {
  const editorRef = useRef<MonacoEditor | null>(null);
  const [mode, setMode] = useState<HighlightMode>("expressions");
  const [codeText, setCodeText] = useState<string>(TASKS["S1 — базовое"]);
  const [outerOnly, setOuterOnly] = useState(false);
  const [groundTruth, setGroundTruth] = useState<Span[]>([]);
  const [userSpans, setUserSpans] = useState<Span[]>([]);
  const [, setDecorations] = useState<string[]>([]);
  const [result, setResult] = useState<{
    tp: Span[];
    fp: Span[];
    fn: Span[];
  } | null>(null);
  const [activeTab, setActiveTab] = useState("task");
  const modeConfig = MODE_CONFIG[mode];
  const supportsOuterOnly = Boolean(modeConfig.supportsOuterOnly);

  // перерасчёт эталона
  useEffect(() => {
    try {
      const gt = collectSpans(codeText, mode, {
        outermostOnly: supportsOuterOnly ? outerOnly : false,
      });
      setGroundTruth(gt);
      setResult(null);
    } catch (e) {
      console.error(e);
      setGroundTruth([]);
      setResult(null);
    }
  }, [codeText, mode, outerOnly, supportsOuterOnly]);

  // декорации
  useEffect(() => {
    const ed = editorRef.current;
    const model = ed?.getModel();
    if (!ed || !model) return;

    const decos: MonacoDecoration[] = [];

    // Эталон: пунктир
    for (const s of groundTruth) {
      const r = toMonacoRange(model, s.start, s.end);
      decos.push({
        range: r,
        options: {
          className: "border-2 border-dashed rounded-md",
          stickiness: 1,
          overviewRuler: { position: 7, color: "#8888" },
        },
      });
    }

    // Пользователь: заливка
    for (const s of userSpans) {
      const r = toMonacoRange(model, s.start, s.end);
      decos.push({
        range: r,
        options: {
          className: "bg-amber-200/40 rounded-md",
          stickiness: 1,
          overviewRuler: { position: 7, color: "#ffaa00" },
        },
      });
    }

    setDecorations((prev) => ed.deltaDecorations(prev, decos));
  }, [groundTruth, userSpans]);

  // добавить выделение
  const addSelection = () => {
    const ed = editorRef.current;
    const model = ed?.getModel();
    const sel = ed?.getSelection();
    if (!ed || !model || !sel) return;
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
    setUserSpans((prev) =>
      prev.some((p) => rangesEqual(p, span)) ? prev : [...prev, span]
    );
  };

  const clearUser = () => setUserSpans([]);

  // проверка
  const check = () => {
    const gtMap = new Map(groundTruth.map((s) => [spanKey(s), s]));
    const userMap = new Map(userSpans.map((s) => [spanKey(s), s]));

    const tp: Span[] = [];
    const fp: Span[] = [];
    const fn: Span[] = [];

    for (const [k, u] of userMap) {
      if (gtMap.has(k)) {
        tp.push(u);
      } else {
        fp.push(u);
      }
    }
    for (const [k, g] of gtMap) {
      if (!userMap.has(k)) {
        fn.push(g);
      }
    }

    setResult({ tp, fp, fn });
    setActiveTab("report");
  };

  // подсказка
  const hintOne = () => {
    const next = groundTruth.find(
      (gt) => !userSpans.some((u) => rangesEqual(u, gt))
    );
    if (!next) return;
    setUserSpans((prev) => [...prev, { ...next, kind: "Hint" }]);
  };

  // монтиование редактора
  const onMount = (editor: MonacoEditor) => {
    editorRef.current = editor;
  };

  // 👇 добавлено: удобные подсказки в отчёте
  const highlightRange = (span: Span) => {
    const ed = editorRef.current;
    const model = ed?.getModel();
    if (!ed || !model) return;
    const range = toMonacoRange(model, span.start, span.end);
    ed.revealRangeInCenter(range);
    ed.setSelection(range);
    ed.focus();
  };

  const getSnippet = (start: number, end: number) => {
    const raw = codeText.slice(start, end);
    const compact = raw
      .replaceAll("\n", " ")
      .replaceAll("\r", " ")
      .replaceAll("\t", " ")
      .trim();
    return compact.length > 80 ? compact.slice(0, 77) + "…" : compact;
  };

  // счёт
  const score = useMemo(() => {
    if (!result) return null;
    const { tp, fp } = result;
    const raw = tp.length - 0.5 * fp.length;
    const max = groundTruth.length;
    return {
      raw,
      max,
      tp: tp.length,
      fp: fp.length,
      fn: (result.fn || []).length,
    };
  }, [result, groundTruth.length]);

  return (
    <div className="w-full min-h-screen p-4 md:p-6 grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-12 bg-neutral-50">
      <div className="lg:col-span-8 space-y-3">
        <Card className="shadow-sm">
          <CardHeader className="space-y-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Target className="w-5 h-5" />
                Задание
              </CardTitle>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Switch
                    id="outerOnly"
                    checked={supportsOuterOnly ? outerOnly : false}
                    onCheckedChange={(value) => {
                      if (supportsOuterOnly) {
                        setOuterOnly(value);
                      }
                    }}
                    disabled={!supportsOuterOnly}
                  />
                  <Label
                    htmlFor="outerOnly"
                    className={
                      supportsOuterOnly
                        ? "cursor-pointer"
                        : "cursor-not-allowed text-neutral-400"
                    }
                  >
                    {supportsOuterOnly
                      ? "Только внешние выражения"
                      : "Только внешние (только для выражений)"}
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
            </div>
            <div className="flex flex-wrap gap-2">
              {MODE_ORDER.map((id) => (
                <Button
                  key={id}
                  size="sm"
                  variant={mode === id ? "default" : "outline"}
                  onClick={() => {
                    setMode(id);
                    setUserSpans([]);
                    setResult(null);
                  }}
                >
                  {MODE_CONFIG[id].label}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-2 pb-2">
              {Object.keys(TASKS).map((k) => (
                <Button
                  key={k}
                  size="sm"
                  variant={codeText === TASKS[k] ? "default" : "outline"}
                  onClick={() => {
                    setCodeText(TASKS[k]);
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
                value={codeText}
                onMount={onMount}
                options={{
                  fontSize: 14,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  renderLineHighlight: "none",
                  wordWrap: "on",
                  occurrencesHighlight: false,
                  selectionHighlight: false,
                  readOnly: true,
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
                Выделите фрагмент в редакторе и нажмите «Добавить».
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
                  <div
                    key={i}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="text-neutral-600 truncate max-w-[220px]">
                      <code>{getSnippet(s.start, s.end)}</code>
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
                    Выбирайте режим выше — можно тренироваться на выражениях,
                    идентификаторах, операторах, ключевых словах, определениях и
                    вызовах функций, ключах объектов и литералах.
                  </li>
                  <li>
                    «Только внешние» доступен только для режима выражений и
                    исключает вложенные выражения из эталона.
                  </li>
                  <li>
                    Подсказка добавляет следующее неотмеченное внешнее
                    выражение.
                  </li>
                  <li>
                    Ловушка:{" "}
                    <code>
                      if (...) {"{"} … {"}"}
                    </code>{" "}
                    — оператор, а не выражение; зато
                    <code> doIt()</code> внутри — выражение.
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
                            <li
                              key={"tp" + i}
                              onClick={() => highlightRange(s)}
                              className="cursor-pointer hover:bg-amber-50 rounded px-1"
                            >
                              <code>{getSnippet(s.start, s.end)}</code>
                              <span className="text-neutral-500 ml-1">
                                ({s.kind})
                              </span>
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
                            <li
                              key={"fp" + i}
                              onClick={() => highlightRange(s)}
                              className="cursor-pointer hover:bg-amber-50 rounded px-1"
                            >
                              <code>{getSnippet(s.start, s.end)}</code>
                              <span className="text-neutral-500 ml-1">
                                ({s.kind})
                              </span>
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
                            <li
                              key={"fn" + i}
                              onClick={() => highlightRange(s)}
                              className="cursor-pointer hover:bg-amber-50 rounded px-1"
                            >
                              <code>{getSnippet(s.start, s.end)}</code>
                              <span className="text-neutral-500 ml-1">
                                ({s.kind})
                              </span>
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
