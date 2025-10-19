const code = (...lines: string[]) => lines.join("\n");

export const TASKS: Record<string, string> = {
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
