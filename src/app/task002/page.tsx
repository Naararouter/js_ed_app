"use client";

import { useMemo, useState } from "react";

import Link from "next/link";
import { PanelLeft, PanelRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { EditorPanel } from "./components/EditorPanel";
import { FileTreePanel } from "./components/FileTreePanel";
import { GraphPanel } from "./components/GraphPanel";
import { ScenarioPanel } from "./components/ScenarioPanel";
import { TaskSidebar } from "./components/TaskSidebar";
import { TerminalPanel } from "./components/TerminalPanel";
import { TimelinePanel } from "./components/TimelinePanel";

export default function Task002Page() {
  const [showLeft, setShowLeft] = useState(true);
  const [showRight, setShowRight] = useState(true);

  const layoutClass = useMemo(() => {
    if (showLeft && showRight) {
      return "lg:grid-cols-[280px_minmax(0,1fr)_320px]";
    }
    if (showLeft && !showRight) {
      return "lg:grid-cols-[280px_minmax(0,1fr)]";
    }
    if (!showLeft && showRight) {
      return "lg:grid-cols-[minmax(0,1fr)_320px]";
    }
    return "lg:grid-cols-1";
  }, [showLeft, showRight]);

  return (
    <main className="flex min-h-screen flex-col gap-6 bg-muted/20 px-4 py-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
          task002
        </p>
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold">Git practice playground</h1>
            <p className="text-sm text-muted-foreground">
              Terminal, editor, file tree, graph, and educational overlays—all wired to a
              shared state store for Git training.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={showLeft ? "outline" : "secondary"}
              size="sm"
              onClick={() => setShowLeft((current) => !current)}
              aria-pressed={showLeft}
            >
              <PanelLeft className="mr-1 h-4 w-4" />
              {showLeft ? "Hide left panel" : "Show left panel"}
            </Button>
            <Button
              variant={showRight ? "outline" : "secondary"}
              size="sm"
              onClick={() => setShowRight((current) => !current)}
              aria-pressed={showRight}
            >
              <PanelRight className="mr-1 h-4 w-4" />
              {showRight ? "Hide right panel" : "Show right panel"}
            </Button>
            <Link
              href="/task001"
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              ← Back to task001
            </Link>
          </div>
        </div>
      </header>

      <section className={cn("grid flex-1 gap-4", layoutClass)}>
        {showLeft && (
          <div className="flex flex-col gap-4">
            <ScenarioPanel />
            <TaskSidebar />
            <TimelinePanel />
          </div>
        )}

        <div className="flex flex-col gap-4">
          <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)] lg:min-h-[460px]">
            <FileTreePanel />
            <EditorPanel />
          </div>
          <TerminalPanel />
        </div>

        {showRight && (
          <div className="flex flex-col gap-4">
            <GraphPanel />
            <div className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground shadow-sm">
              Upcoming: history diff viewer synchronized with the graph. For now, keep
              experimenting via the terminal to populate the timeline.
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
