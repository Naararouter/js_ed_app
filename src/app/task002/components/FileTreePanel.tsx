"use client";

import { useMemo, useState } from "react";

import {
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  Plus,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { DirectoryEntry, usePlaygroundStore } from "../store";

interface TreeNodeProps {
  entryId: string;
  depth?: number;
  expanded: Record<string, boolean>;
  onToggle: (id: string) => void;
}

export function FileTreePanel() {
  const entries = usePlaygroundStore((state) => state.entries);
  const rootId = usePlaygroundStore((state) => state.rootId);
  const createEntry = usePlaygroundStore((state) => state.createEntry);
  const root = entries[rootId] as DirectoryEntry;
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    [rootId]: true,
  });

  const toggle = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const handleCreate = (type: "file" | "directory") => {
    const name = window.prompt(
      `Enter a ${type === "file" ? "file" : "folder"} name`
    );
    if (!name) return;
    createEntry(root.id, name, type);
  };

  const totalFiles = useMemo(
    () =>
      Object.values(entries).filter(
        (entry) => entry.type === "file" && !entry.hidden
      ).length,
    [entries]
  );

  return (
    <section className="flex h-full flex-col rounded-2xl border bg-card p-4 shadow-sm">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            files
          </p>
          <h2 className="text-lg font-semibold">Repository tree</h2>
        </div>
        <span className="text-xs text-muted-foreground">{totalFiles} files</span>
      </header>
      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => handleCreate("file")}>
          <Plus className="mr-1 h-4 w-4" />
          File
        </Button>
        <Button size="sm" variant="outline" onClick={() => handleCreate("directory")}>
          <Plus className="mr-1 h-4 w-4" />
          Folder
        </Button>
      </div>
      <div className="mt-4 flex-1 overflow-y-auto pr-2">
        <TreeNode
          entryId={rootId}
          depth={0}
          expanded={expanded}
          onToggle={toggle}
        />
      </div>
      <div className="mt-4 rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
        Tip: tree updates when you run `touch` or `mkdir` in the terminal.
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Trash2 className="h-4 w-4" />
        Delete via context actions coming next iteration.
      </div>
    </section>
  );
}

function TreeNode({ entryId, depth = 0, expanded, onToggle }: TreeNodeProps) {
  const entry = usePlaygroundStore((state) => state.entries[entryId]);
  const activeFileId = usePlaygroundStore((state) => state.activeFileId);
  const selectFile = usePlaygroundStore((state) => state.selectFile);
  const entries = usePlaygroundStore((state) => state.entries);

  if (!entry) return null;

  if (entry.type === "directory") {
    const isOpen = expanded[entry.id];
    const visibleChildren = entry.children.filter((childId) => {
      const child = entries[childId];
      if (!child) return false;
      if (child.type === "file" && child.hidden) return false;
      return true;
    });
    return (
      <div>
        <button
          type="button"
          onClick={() => onToggle(entry.id)}
          className="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left text-sm font-medium hover:bg-muted/60"
          style={{ paddingLeft: depth * 12 }}
        >
          <ChevronRight
            className={cn(
              "h-4 w-4 text-muted-foreground transition",
              isOpen && "rotate-90"
            )}
          />
          {isOpen ? (
            <FolderOpen className="h-4 w-4 text-amber-500" />
          ) : (
            <Folder className="h-4 w-4 text-amber-500" />
          )}
          <span>{entry.name}</span>
          <span className="ml-auto text-xs text-muted-foreground">
            {visibleChildren.length}
          </span>
        </button>
        {isOpen &&
          visibleChildren.map((childId) => (
            <TreeNode
              key={childId}
              entryId={childId}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
            />
          ))}
      </div>
    );
  }

  if (entry.hidden) {
    return null;
  }

  const isActive = activeFileId === entry.id;
  return (
    <button
      type="button"
      onClick={() => selectFile(entry.id)}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left text-sm hover:bg-muted/70",
        isActive && "bg-primary/10 text-primary"
      )}
      style={{ paddingLeft: depth * 12 + 24 }}
    >
      <FileText className="h-4 w-4 text-blue-500" />
      <span>{entry.name}</span>
      {entry.type === "file" && entry.isDirty && (
        <span className="ml-auto text-[10px] uppercase tracking-wide text-amber-600">
          dirty
        </span>
      )}
    </button>
  );
}
