"use client";

import { CheckCircle2, Circle, KeyRound } from "lucide-react";

import { Button } from "@/components/ui/button";

import { usePlaygroundStore } from "../store";

export function TaskSidebar() {
  const tasks = usePlaygroundStore((state) => state.tasks);
  const requestHint = usePlaygroundStore((state) => state.requestHint);

  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            tasks
          </p>
          <h2 className="text-lg font-semibold">Command goals</h2>
        </div>
        <span className="text-xs text-muted-foreground">
          {tasks.filter((task) => task.done).length}/{tasks.length}
        </span>
      </header>
      <div className="mt-4 space-y-4">
        {tasks.map((task) => (
          <article
            key={task.id}
            className="rounded-xl border bg-background p-3 shadow-sm"
          >
            <div className="flex items-start gap-3">
              {task.done ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-500" />
              ) : (
                <Circle className="mt-0.5 h-5 w-5 text-muted-foreground" />
              )}
              <div className="flex-1">
                <p className="text-sm font-semibold">{task.title}</p>
                <p className="text-xs text-muted-foreground">
                  {task.description}
                </p>
                <p className="mt-2 text-xs font-mono text-muted-foreground">
                  {task.command}
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => requestHint(task.id, "light")}
              >
                Light
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => requestHint(task.id, "medium")}
              >
                Medium
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => requestHint(task.id, "major")}
              >
                Major
              </Button>
              <div className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
                <KeyRound className="h-3.5 w-3.5" />
                <span>L:{task.hint.usage.light}</span>
                <span>M:{task.hint.usage.medium}</span>
                <span>H:{task.hint.usage.major}</span>
              </div>
            </div>
            {task.hint.lastMessage && (
              <p className="mt-2 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                {task.hint.lastMessage}
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
