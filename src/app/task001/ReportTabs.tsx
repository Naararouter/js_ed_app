"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, Target, XCircle } from "lucide-react";

import type { Span } from "./highlight";
import { formatSnippet } from "./span-utils";
import type { Result } from "./types";

type Score = {
  raw: number;
  max: number;
  tp: number;
  fp: number;
  fn: number;
};

type ReportTabsProps = {
  activeTab: string;
  taskTabId: string;
  reportTabId: string;
  onTabChange: (value: string) => void;
  result: Result | null;
  score: Score | null;
  codeText: string;
  onSpanClick: (span: Span) => void;
};

export function ReportTabs({
  activeTab,
  taskTabId,
  reportTabId,
  onTabChange,
  result,
  score,
  codeText,
  onSpanClick,
}: ReportTabsProps) {
  const renderSpanList = (items: Span[]) =>
    items.length > 0 ? (
      items.map((span, index) => (
        <li
          key={`${span.start}-${span.end}-${index}`}
          onClick={() => onSpanClick(span)}
          className="cursor-pointer hover:bg-amber-50 rounded px-1"
        >
          <code>{formatSnippet(codeText, span.start, span.end)}</code>
          <span className="text-neutral-500 ml-1">({span.kind})</span>
        </li>
      ))
    ) : (
      <li className="text-neutral-500">—</li>
    );

  return (
    <Tabs value={activeTab} onValueChange={onTabChange}>
      <TabsList className="grid grid-cols-2 w-full">
        <TabsTrigger value={taskTabId}>Отчёт</TabsTrigger>
        <TabsTrigger value={reportTabId}>Детали</TabsTrigger>
      </TabsList>
      <TabsContent value={taskTabId}>
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
                «Только внешние» доступен только для режима выражений и исключает
                вложенные выражения из эталона.
              </li>
              <li>Подсказка добавляет следующее неотмеченное внешнее выражение.</li>
              <li>
                Ловушка: <code>if (...) {"{"} ... {"}"}</code> — оператор, а не
                выражение; зато <code>doIt()</code> внутри — выражение.
              </li>
            </ul>
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value={reportTabId}>
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
                    Счёт: <b>{score.raw.toFixed(1)}</b> из возможных <b>{score.max}</b>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                  <div>
                    <div className="font-medium mb-1">Верно</div>
                    <ul className="text-neutral-700 max-h-36 overflow-auto space-y-1">
                      {renderSpanList(result.tp)}
                    </ul>
                  </div>
                  <div>
                    <div className="font-medium mb-1">Лишние</div>
                    <ul className="text-neutral-700 max-h-36 overflow-auto space-y-1">
                      {renderSpanList(result.fp)}
                    </ul>
                  </div>
                  <div>
                    <div className="font-medium mb-1">Пропущены</div>
                    <ul className="text-neutral-700 max-h-36 overflow-auto space-y-1">
                      {renderSpanList(result.fn)}
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
  );
}
