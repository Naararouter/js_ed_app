"use client";

import { CheckCircle2, Circle, Lightbulb } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { usePlaygroundStore } from "../store";

export function TaskSidebar() {
  const tasks = usePlaygroundStore((state) => state.tasks);
  const hints = usePlaygroundStore((state) => state.hints);
  const activeHintId = usePlaygroundStore((state) => state.activeHintId);
  const toggleTask = usePlaygroundStore((state) => state.toggleTask);
  const viewHint = usePlaygroundStore((state) => state.viewHint);
  const activeHint = hints.find((hint) => hint.id === activeHintId) ?? hints[0];

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl border bg-card p-4 shadow-sm">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              tasks
            </p>
            <h2 className="text-lg font-semibold">Learning goals</h2>
          </div>
          <span className="text-xs text-muted-foreground">
            {tasks.filter((task) => task.done).length}/{tasks.length}
          </span>
        </header>
        <ul className="mt-4 space-y-3">
          {tasks.map((task) => (
            <li key={task.id}>
              <button
                type="button"
                onClick={() => toggleTask(task.id)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border px-3 py-2 text-left transition",
                  task.done
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : "border-border hover:border-foreground/30"
                )}
              >
                {task.done ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
                ) : (
                  <Circle className="mt-0.5 h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <p className="text-sm font-medium">{task.title}</p>
                  <p className="text-xs text-muted-foreground">{task.detail}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border bg-card p-4 shadow-sm">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              hints
            </p>
            <h2 className="text-lg font-semibold">Guided nudge</h2>
          </div>
          <Lightbulb className="h-5 w-5 text-amber-500" />
        </header>
        <div className="mt-4 space-y-3">
          <div className="rounded-xl border bg-muted/50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {activeHint?.title}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{activeHint?.body}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {hints.map((hint) => (
              <Button
                key={hint.id}
                size="sm"
                variant={hint.id === activeHint?.id ? "default" : "outline"}
                onClick={() => viewHint(hint.id)}
              >
                {hint.title}
              </Button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

