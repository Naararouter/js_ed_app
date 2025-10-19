export type MonacoPosition = {
  lineNumber: number;
  column: number;
};

export type MonacoRange = {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
};

export type MonacoModel = {
  getPositionAt(offset: number): MonacoPosition;
  getOffsetAt(position: MonacoPosition): number;
};

export type DecorationOptions = {
  className: string;
  stickiness: number;
  overviewRuler: { position: number; color: string };
};

export type MonacoDecoration = {
  range: MonacoRange;
  options: DecorationOptions;
};

export type MonacoEditor = {
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

export function toMonacoRange(
  model: MonacoModel,
  start: number,
  end: number
): MonacoRange {
  const startPos = model.getPositionAt(start);
  const endPos = model.getPositionAt(end);
  return {
    startLineNumber: startPos.lineNumber,
    startColumn: startPos.column,
    endLineNumber: endPos.lineNumber,
    endColumn: endPos.column,
  };
}
