"use client";

import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { Span } from "./highlight";
import { formatSnippet } from "./span-utils";

type StatusPanelProps = {
  groundTruthCount: number;
  userSpans: Span[];
  codeText: string;
  onRemove: (index: number) => void;
};

export function StatusPanel({
  groundTruthCount,
  userSpans,
  codeText,
  onRemove,
}: StatusPanelProps) {
  const { t } = useTranslation("task001");

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>{t("status.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span>{t("status.groundTruth")}</span>
          <span className="font-medium">{groundTruthCount}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>{t("status.user")}</span>
          <span className="font-medium">{userSpans.length}</span>
        </div>
        <div className="pt-2 border-t">
          <div className="font-medium mb-2">{t("status.selections")}</div>
          <div className="max-h-40 overflow-auto space-y-1">
            {userSpans.length > 0 ? (
              userSpans.map((span, index) => (
                <div
                  key={`${span.start}-${span.end}-${index}`}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="text-neutral-600 truncate max-w-[220px]">
                    <code>{formatSnippet(codeText, span.start, span.end)}</code>
                  </span>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => onRemove(index)}
                  >
                    {t("status.remove")}
                  </Button>
                </div>
              ))
            ) : (
              <div className="text-neutral-500">{t("status.empty")}</div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
