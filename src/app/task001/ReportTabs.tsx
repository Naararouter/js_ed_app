"use client";

import { Trans, useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, Target, XCircle } from "lucide-react";

import { MODE_CONFIG, type HighlightMode, type Span } from "./highlight";
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
  mode: HighlightMode;
  coverage: number | null;
  userSpans: Span[];
};

const formatPercent = (value: number | null) =>
  value != null ? `${Math.round(value * 100)}%` : "0%";

export function ReportTabs({
  activeTab,
  taskTabId,
  reportTabId,
  onTabChange,
  result,
  score,
  codeText,
  onSpanClick,
  mode,
  coverage,
  userSpans,
}: ReportTabsProps) {
  const { t } = useTranslation("task001");

  const renderSpanList = (items: Span[]) =>
    items.length > 0 ? (
      items.map((span, index) => (
        <li
          key={`${span.start}-${span.end}-${index}`}
          onClick={() => onSpanClick(span)}
          className="cursor-pointer hover:bg-amber-50 rounded px-1"
        >
          <code>{formatSnippet(codeText, span.start, span.end)}</code>
          <span className="text-neutral-500 ml-1">
            (
            {mode === "free" && MODE_CONFIG[span.kind as HighlightMode]
              ? t(MODE_CONFIG[span.kind as HighlightMode].labelKey)
              : span.kind}
            )
          </span>
        </li>
      ))
    ) : (
      <li className="text-neutral-500">{t("status.empty")}</li>
    );

  return (
    <Tabs value={activeTab} onValueChange={onTabChange}>
      <TabsList className="grid grid-cols-2 w-full">
        <TabsTrigger value={taskTabId}>{t("tabs.report")}</TabsTrigger>
        <TabsTrigger value={reportTabId}>{t("tabs.details")}</TabsTrigger>
      </TabsList>
      <TabsContent value={taskTabId}>
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>{t("recommendations.title")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <ul className="list-disc pl-5 space-y-1">
              <li>{t("recommendations.item1")}</li>
              <li>{t("recommendations.item2")}</li>
              <li>{t("recommendations.item3")}</li>
              <li>
                <Trans
                  t={t}
                  i18nKey="recommendations.item4"
                  components={[<code key="code-0" />, <code key="code-1" />]}
                />
              </li>
              {mode === "free" && <li>{t("freeMode.instructions")}</li>}
            </ul>
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value={reportTabId}>
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>
              {mode === "free" ? t("freeMode.coverage") : t("report.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {mode === "free" ? (
              <div className="space-y-3">
                <div className="text-neutral-700">
                  {t("freeMode.coverage")}: <b>{formatPercent(coverage)}</b>
                </div>
                <div className="text-neutral-600">
                  {coverage != null && coverage >= 1
                    ? t("freeMode.complete")
                    : t("freeMode.incomplete")}
                </div>
                {result ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                    <div>
                      <div className="font-medium mb-1">{t("report.correct")}</div>
                      <ul className="text-neutral-700 max-h-36 overflow-auto space-y-1">
                        {renderSpanList(result.tp)}
                      </ul>
                    </div>
                    <div>
                      <div className="font-medium mb-1">{t("report.extra")}</div>
                      <ul className="text-neutral-700 max-h-36 overflow-auto space-y-1">
                        {renderSpanList(result.fp)}
                      </ul>
                    </div>
                    <div>
                      <div className="font-medium mb-1">{t("report.missed")}</div>
                      <ul className="text-neutral-700 max-h-36 overflow-auto space-y-1">
                        {renderSpanList(result.fn)}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="text-neutral-500">{t("report.noData")}</div>
                )}
              </div>
            ) : result ? (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-3 text-base">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    {t("report.correct")}: <b>{result.tp.length}</b>
                  </span>
                  <span className="flex items-center gap-1">
                    <XCircle className="w-5 h-5 text-red-600" />
                    {t("report.extra")}: <b>{result.fp.length}</b>
                  </span>
                  <span className="flex items-center gap-1">
                    <Target className="w-5 h-5 text-amber-600" />
                    {t("report.missed")}: <b>{result.fn.length}</b>
                  </span>
                </div>
                {score && (
                  <div className="text-neutral-700">
                    {t("report.score")}: <b>{score.raw.toFixed(1)}</b>{" "}
                    {t("report.scoreOutOf")} <b>{score.max}</b>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                  <div>
                    <div className="font-medium mb-1">{t("report.correct")}</div>
                    <ul className="text-neutral-700 max-h-36 overflow-auto space-y-1">
                      {renderSpanList(result.tp)}
                    </ul>
                  </div>
                  <div>
                    <div className="font-medium mb-1">{t("report.extra")}</div>
                    <ul className="text-neutral-700 max-h-36 overflow-auto space-y-1">
                      {renderSpanList(result.fp)}
                    </ul>
                  </div>
                  <div>
                    <div className="font-medium mb-1">{t("report.missed")}</div>
                    <ul className="text-neutral-700 max-h-36 overflow-auto space-y-1">
                      {renderSpanList(result.fn)}
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-neutral-500">{t("report.noData")}</div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
