import * as BabelParser from "@babel/parser";
import traverse, { type NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import type { ParserPlugin } from "@babel/parser";

export type Span = { start: number; end: number; kind: string };

export type HighlightMode =
  | "free"
  | "expressions"
  | "identifiers"
  | "operators"
  | "keywords"
  | "functionDefinitions"
  | "functionCalls"
  | "objectKeys"
  | "literals";

export type ModeConfig = {
  labelKey: string;
};

export type CollectOptions = {
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

type TypeHelpers = {
  isBigIntLiteral?: (value: t.Node) => value is t.BigIntLiteral;
};

const typeHelpers = t as unknown as TypeHelpers;

const isBigIntLiteral = (node: t.Node): node is t.BigIntLiteral =>
  typeof typeHelpers.isBigIntLiteral === "function"
    ? typeHelpers.isBigIntLiteral(node)
    : false;

export const MODE_CONFIG: Record<HighlightMode, ModeConfig> = {
  free: { labelKey: "modes.free" },
  expressions: { labelKey: "modes.expressions" },
  identifiers: { labelKey: "modes.identifiers" },
  operators: { labelKey: "modes.operators" },
  keywords: { labelKey: "modes.keywords" },
  functionDefinitions: { labelKey: "modes.functionDefinitions" },
  functionCalls: { labelKey: "modes.functionCalls" },
  objectKeys: { labelKey: "modes.objectKeys" },
  literals: { labelKey: "modes.literals" },
};

export const MODE_ORDER: HighlightMode[] = [
  "expressions",
  "identifiers",
  "operators",
  "keywords",
  "functionDefinitions",
  "functionCalls",
  "objectKeys",
  "literals",
  "free",
];

export type FreeLabel = Exclude<HighlightMode, "free">;
export const FREE_LABEL_OPTIONS: FreeLabel[] = [
  "identifiers",
  "keywords",
  "operators",
  "literals",
  "functionDefinitions",
  "functionCalls",
  "objectKeys",
  "expressions",
];

const isOptionalCallExpression = (
  node: t.Node
): node is t.OptionalCallExpression => node.type === "OptionalCallExpression";

const isTSDeclareFunction = (
  node: t.Node
): node is t.TSDeclareFunction => node.type === "TSDeclareFunction";

export function collectSpans(
  src: string,
  mode: HighlightMode,
  options: CollectOptions = {}
): Span[] {
  const ast = parseCode(src) as unknown as t.File & { tokens?: BabelToken[] };
  const tokens = ast.tokens ?? [];
  let spans: Span[] = [];
  const outermostOnly = Boolean(options.outermostOnly);

  switch (mode) {
    case "free":
      spans = [];
      break;
    case "expressions":
      spans = collectExpressionSpans(ast, outermostOnly);
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

function collectExpressionSpans(ast: t.Node, outermostOnly: boolean): Span[] {
  const out: Span[] = [];
  traverse(ast, {
    enter(path: NodePath) {
      const node = path.node as t.Node;
      if (t.isExpression(node) && node.start != null && node.end != null) {
        if (outermostOnly) {
          const parent = path.parent as t.Node | undefined;
          if (parent && t.isExpression(parent)) return;
        }
        if (t.isIdentifier(node)) return;
        out.push({ start: node.start, end: node.end, kind: node.type });
      }
    },
  });
  return out;
}

function collectIdentifierSpans(ast: t.Node): Span[] {
  const out: Span[] = [];
  traverse(ast, {
    Identifier(path) {
      const node = path.node;
      if (node.start != null && node.end != null) {
        out.push({ start: node.start, end: node.end, kind: "Identifier" });
      }
    },
    JSXIdentifier(path) {
      const node = path.node;
      if (node.start != null && node.end != null) {
        out.push({ start: node.start, end: node.end, kind: "JSXIdentifier" });
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
  ".",
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
      kind: "Operator",
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
      const node = path.node;
      if (node.start == null || node.end == null) return;
      if (t.isFunctionDeclaration(node)) {
        out.push({ start: node.start, end: node.end, kind: "FunctionDeclaration" });
      } else if (t.isFunctionExpression(node)) {
        out.push({ start: node.start, end: node.end, kind: "FunctionExpression" });
      } else if (t.isArrowFunctionExpression(node)) {
        out.push({
          start: node.start,
          end: node.end,
          kind: "ArrowFunctionExpression",
        });
      } else if (t.isObjectMethod(node)) {
        out.push({ start: node.start, end: node.end, kind: "ObjectMethod" });
      } else if (t.isClassMethod(node)) {
        out.push({ start: node.start, end: node.end, kind: "ClassMethod" });
      } else if (t.isClassPrivateMethod(node)) {
        out.push({ start: node.start, end: node.end, kind: "ClassPrivateMethod" });
      } else if (isTSDeclareFunction(node)) {
        out.push({ start: node.start, end: node.end, kind: "TSDeclareFunction" });
      }
    },
  });
  return out;
}

function collectFunctionCallSpans(ast: t.Node): Span[] {
  const out: Span[] = [];
  traverse(ast, {
    enter(path) {
      const node = path.node;
      if (node.start == null || node.end == null) return;
      if (isOptionalCallExpression(node)) {
        out.push({
          start: node.start,
          end: node.end,
          kind: "OptionalCallExpression",
        });
      } else if (t.isCallExpression(node)) {
        out.push({ start: node.start, end: node.end, kind: "CallExpression" });
      } else if (t.isNewExpression(node)) {
        out.push({ start: node.start, end: node.end, kind: "NewExpression" });
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
      const node = path.node;
      if (node.start == null || node.end == null) return;
      if (t.isTemplateLiteral(node)) {
        out.push({ start: node.start, end: node.end, kind: "TemplateLiteral" });
        return;
      }
      if (
        t.isStringLiteral(node) ||
        t.isNumericLiteral(node) ||
        t.isBooleanLiteral(node) ||
        t.isNullLiteral(node) ||
        t.isRegExpLiteral(node) ||
        isBigIntLiteral(node)
      ) {
        out.push({ start: node.start, end: node.end, kind: node.type });
      }
    },
  });
  return out;
}

function dedupeAndSort(spans: Span[]): Span[] {
  const seen = new Set<string>();
  const uniq = spans.filter((span) => {
    const key = `${span.start}-${span.end}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return uniq.sort((a, b) => a.start - b.start || a.end - b.end);
}
