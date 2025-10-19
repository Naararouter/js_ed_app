"use client";

import dynamic from "next/dynamic";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Code2, Info, Target, CheckCircle2 } from "lucide-react";

import {
  MODE_CONFIG,
  MODE_ORDER,
  type FreeLabel,
  type HighlightMode,
  FREE_LABEL_OPTIONS,
} from "./highlight";
import type { MonacoEditor } from "./monaco";
import { TASK_LABEL_KEYS } from "./tasks";

const Editor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

type ControlsCardProps = {
  mode: HighlightMode;
  codeText: string;
  tasks: Record<string, string>;
  freeLabel: FreeLabel;
  activeCategories: FreeLabel[];
  onFreeLabelChange: (label: FreeLabel) => void;
  onToggleCategory: (label: FreeLabel) => void;
  onModeChange: (mode: HighlightMode) => void;
  onTaskSelect: (taskKey: string) => void;
  onAddSelection: () => void;
  onHint: () => void;
  onClear: () => void;
  onCheck: () => void;
  onMount: (editor: MonacoEditor) => void;
};

export function ControlsCard({
  mode,
  codeText,
  tasks,
  freeLabel,
  activeCategories,
  onFreeLabelChange,
  onToggleCategory,
  onModeChange,
  onTaskSelect,
  onAddSelection,
  onHint,
  onClear,
  onCheck,
  onMount,
}: ControlsCardProps) {
  const { t, i18n } = useTranslation("task001");

  const selectableCategories = activeCategories.length
    ? activeCategories
    : FREE_LABEL_OPTIONS;

  return (
    <Card className="shadow-sm">
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Target className="w-5 h-5" />
            {t("taskTitle")}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-neutral-500">{t("language.label")}:</span>
              {(["ru", "en"] as const).map((lng) => (
                <Button
                  key={lng}
                  size="sm"
                  variant={i18n.language === lng ? "default" : "outline"}
                  onClick={() => {
                    void i18n.changeLanguage(lng);
                  }}
                >
                  {t(`language.${lng}`)}
                </Button>
              ))}
            </div>
            {mode !== "free" && (
              <Button variant="secondary" onClick={onHint}>
                {t("hint")}
              </Button>
            )}
            <Button variant="ghost" onClick={onClear}>
              {t("reset")}
            </Button>
            <Button onClick={onCheck} className="gap-2">
              <CheckCircle2 className="w-4 h-4" />
              {t("check")}
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {MODE_ORDER.map((item) => (
            <Button
              key={item}
              size="sm"
              variant={mode === item ? "default" : "outline"}
              onClick={() => onModeChange(item)}
            >
              {t(MODE_CONFIG[item].labelKey)}
            </Button>
          ))}
        </div>
        {mode === "free" && (
          <div className="space-y-2 pt-1">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-neutral-500">
                {t("freeMode.categories")}:
              </span>
              <div className="flex flex-wrap gap-2">
                {FREE_LABEL_OPTIONS.map((option) => {
                  const selected = activeCategories.includes(option);
                  const disableToggle = selected && activeCategories.length === 1;
                  return (
                    <Button
                      key={option}
                      size="sm"
                      variant={selected ? "default" : "outline"}
                      disabled={disableToggle}
                      onClick={() => onToggleCategory(option)}
                    >
                      {t(MODE_CONFIG[option].labelKey)}
                    </Button>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-neutral-500">{t("freeMode.currentLabel")}:</span>
              <select
                value={freeLabel}
                onChange={(event) =>
                  onFreeLabelChange(event.target.value as FreeLabel)
                }
                className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {selectableCategories.map((option) => (
                  <option key={option} value={option}>
                    {t(MODE_CONFIG[option].labelKey)}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-sm text-neutral-500">
              {t("freeMode.instructions")}
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-2 pb-2">
          {Object.keys(tasks).map((key) => (
            <Button
              key={key}
              size="sm"
              variant={codeText === tasks[key] ? "default" : "outline"}
              onClick={() => onTaskSelect(key)}
            >
              {t(TASK_LABEL_KEYS[key] ?? key)}
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
          <Button variant="outline" onClick={onAddSelection} className="gap-2">
            <Code2 className="w-4 h-4" />
            {t("addSelection")}
          </Button>
          <div className="text-sm text-neutral-600 flex items-center gap-2">
            <Info className="w-4 h-4" />
            {t("selectionInfo")}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
