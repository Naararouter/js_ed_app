"use client";

import { Fragment } from "react";

import { BadgeCheck, Code2, GitGraph, MessageSquare } from "lucide-react";

import { usePlaygroundStore } from "../store";

const ICONS = {
  command: Code2,
  edit: MessageSquare,
  hint: BadgeCheck,
  git: GitGraph,
} as const;

export function TimelinePanel() {
  const events = usePlaygroundStore((state) => state.timeline);
  const items = [...events].reverse();

  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            timeline
          </p>
          <h2 className="text-lg font-semibold">Activity stream</h2>
        </div>
        <span className="text-xs text-muted-foreground">
          Last {items.length} events
        </span>
      </header>
      <div className="mt-4 space-y-4 max-h-64 overflow-y-auto pr-2">
        {items.map((event, index) => {
          const Icon = ICONS[event.kind];
          const time = new Intl.DateTimeFormat("en", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }).format(event.timestamp);
          return (
            <Fragment key={event.id}>
              <div className="flex items-start gap-3">
                <div className="rounded-full border bg-muted p-1.5">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">{event.label}</p>
                  <p className="text-xs text-muted-foreground">{event.detail}</p>
                </div>
                <span className="ml-auto text-xs text-muted-foreground">{time}</span>
              </div>
              {index !== items.length - 1 && (
                <div className="mx-8 border-l border-dashed border-muted-foreground/30" />
              )}
            </Fragment>
          );
        })}
      </div>
    </section>
  );
}

