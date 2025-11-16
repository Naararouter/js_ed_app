"use client";

import Link from "next/link";

import { EditorPanel } from "./components/EditorPanel";
import { FileTreePanel } from "./components/FileTreePanel";
import { GraphPanel } from "./components/GraphPanel";
import { TaskSidebar } from "./components/TaskSidebar";
import { TerminalPanel } from "./components/TerminalPanel";
import { TimelinePanel } from "./components/TimelinePanel";

export default function Task002Page() {
  return (
    <main className="flex min-h-screen flex-col gap-6 bg-muted/20 px-4 py-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
          task002
        </p>
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <h1 className="text-3xl font-semibold">Git practice playground</h1>
            <p className="text-sm text-muted-foreground">
              Terminal, editor, file tree, graph, and educational overlays—all wired to a
              shared state store for future Git simulations.
            </p>
          </div>
          <Link
            href="/task001"
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            ← Back to task001
          </Link>
        </div>
      </header>

      <section className="grid flex-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-4">
          <TaskSidebar />
          <TimelinePanel />
        </div>

        <div className="flex flex-col gap-4">
          <div className="grid flex-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
            <FileTreePanel />
            <EditorPanel />
          </div>
          <TerminalPanel />
        </div>

        <div className="flex flex-col gap-4">
          <GraphPanel />
          <div className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground shadow-sm">
            Upcoming: history diff viewer synchronized with the graph. For now, keep
            experimenting via the terminal to populate the timeline.
          </div>
        </div>
      </section>
    </main>
  );
}
