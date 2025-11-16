"use client";

import { Fragment, useMemo, useState } from "react";
import type { ReactNode } from "react";

import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  Plus,
  RefreshCcw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import {
  DirectoryEntry,
  type FileEntry,
  usePlaygroundStore,
} from "../store";

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
  const stagedFileIds = usePlaygroundStore((state) => state.stagedFileIds);

  const [tab, setTab] = useState("tree");
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
        <span className="text-xs text-muted-foreground">
          {totalFiles} files · {stagedFileIds.length} staged
        </span>
      </header>

      <Tabs value={tab} onValueChange={setTab} className="mt-3 flex h-full flex-col">
        <TabsList className="w-full">
          <TabsTrigger value="tree" className="flex-1">
            Tree
          </TabsTrigger>
          <TabsTrigger value="status" className="flex-1">
            Git status
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tree" className="flex h-full flex-col">
          <div className="mt-2 flex items-center gap-2">
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
          <p className="mt-4 rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
            Tip: right-click a file or folder for rename/delete actions. Tree also reflects
            `git reset`, `touch`, and `rm` commands.
          </p>
        </TabsContent>

        <TabsContent value="status" className="flex h-full flex-col">
          <GitStatusPanel />
        </TabsContent>
      </Tabs>
    </section>
  );
}

function TreeNode({ entryId, depth = 0, expanded, onToggle }: TreeNodeProps) {
  const entry = usePlaygroundStore((state) => state.entries[entryId]);
  const activeFileId = usePlaygroundStore((state) => state.activeFileId);
  const selectFile = usePlaygroundStore((state) => state.selectFile);
  const entries = usePlaygroundStore((state) => state.entries);
  const deleteEntry = usePlaygroundStore((state) => state.deleteEntry);
  const renameEntry = usePlaygroundStore((state) => state.renameEntry);

  if (!entry) return null;

  const handleRename = () => {
    const nextName = window.prompt("Rename entry", entry.name);
    if (!nextName) return;
    renameEntry(entry.id, nextName);
  };

  const handleDelete = () => {
    const confirmed = window.confirm(`Delete ${entry.name}?`);
    if (!confirmed) return;
    deleteEntry(entry.id);
  };

  const wrapWithMenu = (node: React.ReactNode) => {
    if (entry.parentId == null) return <Fragment>{node}</Fragment>;
    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>{node}</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem
            onSelect={(event) => {
              event.preventDefault();
              handleRename();
            }}
          >
            Rename
          </ContextMenuItem>
          <ContextMenuItem
            className="text-red-600 focus:bg-red-50 focus:text-red-600"
            onSelect={(event) => {
              event.preventDefault();
              handleDelete();
            }}
          >
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

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
        {wrapWithMenu(
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
        )}
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
    wrapWithMenu(
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
    )
  );
}

function GitStatusPanel() {
  const entries = usePlaygroundStore((state) => state.entries);
  const stagedFileIds = usePlaygroundStore((state) => state.stagedFileIds);
  const stageEntryIds = usePlaygroundStore((state) => state.stageEntryIds);
  const unstageEntryIds = usePlaygroundStore((state) => state.unstageEntryIds);
  const stageAllDirty = usePlaygroundStore((state) => state.stageAllDirty);

  const stagedFiles = useMemo(
    () =>
      stagedFileIds
        .map((id) => entries[id])
        .filter((entry): entry is FileEntry => Boolean(entry && entry.type === "file" && !entry.hidden)),
    [entries, stagedFileIds]
  );

  const stagedSet = useMemo(() => new Set(stagedFileIds), [stagedFileIds]);

  const { unstagedFiles, untrackedFiles } = useMemo(() => {
    const unstaged: FileEntry[] = [];
    const untracked: FileEntry[] = [];
    Object.values(entries).forEach((entry) => {
      if (!entry || entry.type !== "file" || entry.hidden) return;
      if (!entry.tracked) {
        untracked.push(entry);
        return;
      }
      if (entry.isDirty && !stagedSet.has(entry.id)) {
        unstaged.push(entry);
      }
    });
    return { unstagedFiles: unstaged, untrackedFiles: untracked };
  }, [entries, stagedSet]);

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between rounded-xl border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        <span>
          Mirror of <code>git status</code>. Stage, unstage, or clean files before committing.
        </span>
        <Button size="xs" variant="ghost" onClick={() => stageAllDirty()}>
          <RefreshCcw className="mr-1 h-3.5 w-3.5" />
          Stage all
        </Button>
      </div>

      <StatusSection
        title="Staged changes"
        description="Ready to commit"
        icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
        files={stagedFiles}
        emptyText="No staged files."
        itemActionLabel="Unstage"
        onItemAction={(id) => unstageEntryIds([id])}
        bulkLabel="Unstage all"
        onBulkAction={() => unstageEntryIds(stagedFiles.map((file) => file.id))}
      />

      <StatusSection
        title="Changes not staged"
        description="Tracked files with modifications"
        icon={<AlertCircle className="h-4 w-4 text-amber-500" />}
        files={unstagedFiles}
        emptyText="Working tree clean."
        itemActionLabel="Stage"
        onItemAction={(id) => stageEntryIds([id])}
        bulkLabel="Stage all"
        onBulkAction={() => stageEntryIds(unstagedFiles.map((file) => file.id))}
      />

      <StatusSection
        title="Untracked files"
        description="Files outside the index"
        icon={<AlertCircle className="h-4 w-4 text-rose-500" />}
        files={untrackedFiles}
        emptyText="No untracked files."
        itemActionLabel="Stage"
        onItemAction={(id) => stageEntryIds([id])}
        bulkLabel="Stage all"
        onBulkAction={() => stageEntryIds(untrackedFiles.map((file) => file.id))}
      />
    </div>
  );
}

interface StatusSectionProps {
  title: string;
  description: string;
  icon: ReactNode;
  files: FileEntry[];
  emptyText: string;
  itemActionLabel: string;
  onItemAction: (id: string) => void;
  bulkLabel?: string;
  onBulkAction?: () => void;
}

function StatusSection({
  title,
  description,
  icon,
  files,
  emptyText,
  itemActionLabel,
  onItemAction,
  bulkLabel,
  onBulkAction,
}: StatusSectionProps) {
  return (
    <div className="rounded-2xl border bg-muted/30 p-3 text-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {title}
            </p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        {files.length > 0 && bulkLabel && onBulkAction && (
          <Button size="xs" variant="outline" onClick={onBulkAction}>
            {bulkLabel}
          </Button>
        )}
      </div>
      <div className="mt-3 space-y-2 max-h-28 overflow-y-auto pr-1">
        {files.length === 0 && (
          <p className="text-xs text-muted-foreground">{emptyText}</p>
        )}
        {files.map((file) => (
          <div
            key={file.id}
            className="flex items-center gap-3 rounded-lg bg-background px-3 py-2 text-xs shadow-sm"
          >
            <div className="flex-1 truncate font-mono text-[11px] text-muted-foreground">
              {file.path}
            </div>
            <Button
              size="xs"
              variant="secondary"
              onClick={() => onItemAction(file.id)}
            >
              {itemActionLabel}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
