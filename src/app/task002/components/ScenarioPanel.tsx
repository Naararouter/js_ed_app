"use client";

import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { usePlaygroundStore } from "../store";

export function ScenarioPanel() {
  const scenarios = usePlaygroundStore((state) => state.scenarioCatalog);
  const activeScenarioId = usePlaygroundStore((state) => state.scenarioId);
  const loadScenario = usePlaygroundStore((state) => state.loadScenario);

  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            scenarios
          </p>
          <h2 className="text-lg font-semibold">Choose a challenge</h2>
        </div>
        <Sparkles className="h-5 w-5 text-primary" />
      </header>
      <div className="mt-4 space-y-3">
        {scenarios.map((scenario) => {
          const isActive = scenario.id === activeScenarioId;
          return (
            <article
              key={scenario.id}
              className={cn(
                "rounded-xl border p-3 transition",
                isActive ? "border-primary/60 bg-primary/5" : "border-border"
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{scenario.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {scenario.summary}
                  </p>
                </div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {scenario.difficulty}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-end">
                {isActive ? (
                  <span className="text-xs font-semibold text-primary">Active</span>
                ) : (
                  <Button size="sm" onClick={() => loadScenario(scenario.id)}>
                    Activate
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

