"use client";

import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Code2, Info, Target, CheckCircle2 } from "lucide-react";

import {
  MODE_CONFIG,
  MODE_ORDER,
  type HighlightMode,
} from "./highlight";
import type { MonacoEditor } from "./monaco";

const Editor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

type ControlsCardProps = {
  mode: HighlightMode;
  codeText: string;
  tasks: Record<string, string>;
  outerOnly: boolean;
  supportsOuterOnly: boolean;
  onModeChange: (mode: HighlightMode) => void;
  onTaskSelect: (taskKey: string) => void;
  onToggleOuter: (value: boolean) => void;
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
  outerOnly,
  supportsOuterOnly,
  onModeChange,
  onTaskSelect,
  onToggleOuter,
  onAddSelection,
  onHint,
  onClear,
  onCheck,
  onMount,
}: ControlsCardProps) {
  return (
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
                  if (supportsOuterOnly) onToggleOuter(value);
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
            <Button variant="secondary" onClick={onHint}>
              Подсказка
            </Button>
            <Button variant="ghost" onClick={onClear}>
              Сбросить
            </Button>
            <Button onClick={onCheck} className="gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Проверить
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
              {MODE_CONFIG[item].label}
            </Button>
          ))}
        </div>
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
              {key}
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
            Добавить текущую выделенную область
          </Button>
          <div className="text-sm text-neutral-600 flex items-center gap-2">
            <Info className="w-4 h-4" />
            Выделите фрагмент в редакторе и нажмите «Добавить».
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
