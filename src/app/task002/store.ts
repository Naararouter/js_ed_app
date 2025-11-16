"use client";

import { create } from "zustand";

type EntryType = "file" | "directory";

interface BaseEntry {
  id: string;
  name: string;
  parentId: string | null;
  path: string;
}

export interface DirectoryEntry extends BaseEntry {
  type: "directory";
  children: string[];
  hidden?: boolean;
}

export interface FileEntry extends BaseEntry {
  type: "file";
  content: string;
  initialContent: string;
  baselinePath: string;
  language?: string;
  isDirty: boolean;
  lastEdited?: number;
  tracked: boolean;
  hidden?: boolean;
  deleted?: boolean;
}

export type Entry = DirectoryEntry | FileEntry;

export interface Task {
  id: string;
  title: string;
  detail: string;
  done: boolean;
}

export interface Hint {
  id: string;
  title: string;
  body: string;
}

export interface TimelineEvent {
  id: string;
  kind: "command" | "edit" | "hint" | "git";
  label: string;
  detail?: string;
  timestamp: number;
}

export interface CommitNode {
  id: string;
  message: string;
  parents: string[];
  author: string;
  timestamp: number;
}

export interface GitCommandResult {
  success: boolean;
  output: string[];
}

interface PlaygroundState {
  entries: Record<string, Entry>;
  rootId: string;
  activeFileId: string | null;
  timeline: TimelineEvent[];
  tasks: Task[];
  hints: Hint[];
  activeHintId: string | null;
  commits: CommitNode[];
  commitSnapshots: Record<string, Record<string, string>>;
  branches: Record<string, string | null>;
  currentBranch: string;
  headCommitId: string | null;
  headDetached: boolean;
  stagedFileIds: string[];
  selectFile: (id: string) => void;
  updateFileContent: (id: string, content: string) => void;
  createEntry: (parentId: string, name: string, type: EntryType) => void;
  deleteEntry: (id: string) => void;
  logEvent: (event: Omit<TimelineEvent, "id" | "timestamp"> & { timestamp?: number }) => void;
  toggleTask: (id: string) => void;
  viewHint: (id: string) => void;
  getEntryByPath: (path: string) => Entry | null;
  stageEntryIds: (ids: string[]) => string[];
  stageAllDirty: () => string[];
  unstageEntryIds: (ids: string[]) => string[];
  clearStage: () => void;
  renameEntry: (id: string, name: string) => boolean;
  commitChanges: (message: string) => GitCommandResult;
  checkoutBranch: (branch: string) => GitCommandResult;
  createBranch: (branch: string) => GitCommandResult;
  renameBranch: (oldName: string, newName: string, force?: boolean) => GitCommandResult;
  deleteBranch: (branch: string, force?: boolean) => GitCommandResult;
  checkoutCommit: (commitId: string) => GitCommandResult;
  headLabel: () => string;
  listBranches: () => { name: string; commitId: string | null; isCurrent: boolean }[];
  getCommitLog: (limit?: number) => CommitNode[];
  hardReset: (target?: string) => GitCommandResult;
}

const ROOT_ID = "repo";

const initialEntries: Record<string, Entry> = {
  [ROOT_ID]: {
    id: ROOT_ID,
    name: "git-playground",
    type: "directory",
    path: "/",
    parentId: null,
    children: ["readme", "src", "notes"],
  },
  readme: {
    id: "readme",
    name: "README.md",
    type: "file",
    parentId: ROOT_ID,
    path: "/README.md",
    content: "# Git Practice Playground\n\nStart by exploring tasks in the left panel.",
    initialContent: "# Git Practice Playground\n\nStart by exploring tasks in the left panel.",
    baselinePath: "/README.md",
    isDirty: false,
    language: "markdown",
    tracked: true,
  },
  src: {
    id: "src",
    name: "src",
    type: "directory",
    parentId: ROOT_ID,
    path: "/src",
    children: ["main"],
  },
  main: {
    id: "main",
    name: "main.ts",
    type: "file",
    parentId: "src",
    path: "/src/main.ts",
    content: `export function greet(name: string) {
  return \`Hello, \${name}! Welcome to the Git lab.\`;
}`,
    initialContent: `export function greet(name: string) {
  return \`Hello, \${name}! Welcome to the Git lab.\`;
}`,
    baselinePath: "/src/main.ts",
    isDirty: false,
    language: "typescript",
    tracked: true,
  },
  notes: {
    id: "notes",
    name: "notes",
    type: "directory",
    parentId: ROOT_ID,
    path: "/notes",
    children: ["journal"],
  },
  journal: {
    id: "journal",
    name: "journal.md",
    type: "file",
    parentId: "notes",
    path: "/notes/journal.md",
    content: "- [ ] Record what you learned today.\n",
    initialContent: "- [ ] Record what you learned today.\n",
    baselinePath: "/notes/journal.md",
    isDirty: false,
    language: "markdown",
    tracked: true,
  },
};

const initialTasks: Task[] = [
  {
    id: "task-1",
    title: "Explore the repo",
    detail: "Read README.md and inspect src/main.ts.",
    done: false,
  },
  {
    id: "task-2",
    title: "Practice file edits",
    detail: "Modify journal.md and note the timeline update.",
    done: false,
  },
  {
    id: "task-3",
    title: "Review git graph",
    detail: "Select a commit in the graph to see metadata.",
    done: false,
  },
];

const initialHints: Hint[] = [
  {
    id: "hint-1",
    title: "Getting started",
    body: "Use the terminal to run `ls` and see folders. Type `help` to view available commands.",
  },
  {
    id: "hint-2",
    title: "Editing files",
    body: "Select a file in the tree, edit in Monaco, and the dirty badge will reflect unsaved changes vs. baseline.",
  },
  {
    id: "hint-3",
    title: "Graph insight",
    body: "Click commits in the graph to sync the details panel and timeline.",
  },
];

const initialCommitId = "c1";

const initialCommits: CommitNode[] = [
  {
    id: initialCommitId,
    message: "feat: bootstrap playground",
    parents: [],
    author: "mentor",
    timestamp: Date.now() - 1000 * 60 * 60 * 24,
  },
];

const initialSnapshot = snapshotEntries(initialEntries);

const createId = () => Math.random().toString(36).slice(2, 10);

const appendEvent = (timeline: TimelineEvent[], event: TimelineEvent) => {
  const next = [...timeline, event];
  if (next.length > 100) {
    next.shift();
  }
  return next;
};

const sanitizePath = (raw: string) => {
  if (!raw) return "/";
  const cleaned = raw.trim();
  if (!cleaned.startsWith("/")) {
    return `/${cleaned}`;
  }
  return cleaned.replace(/\/+$/, "") || "/";
};

interface ResolvedRef {
  commitId: string;
  branchName?: string;
}

function snapshotEntries(entries: Record<string, Entry>) {
  const snapshot: Record<string, string> = {};
  Object.values(entries).forEach((entry) => {
    if (entry.type === "file" && entry.tracked && !entry.deleted) {
      const key = entry.baselinePath ?? entry.path;
      snapshot[key] = entry.content;
    }
  });
  return snapshot;
}

function applySnapshotToEntries(
  entries: Record<string, Entry>,
  snapshot: Record<string, string>,
  activeFileId: string | null
) {
  const nextEntries: Record<string, Entry> = { ...entries };
  let nextActive = activeFileId;
  Object.values(entries).forEach((entry) => {
    if (entry.type !== "file" || !entry.tracked) return;
    const headPath = entry.baselinePath ?? entry.path;
    const value = snapshot[headPath];
    if (value != null) {
      nextEntries[entry.id] = {
        ...entry,
        path: headPath,
        baselinePath: headPath,
        hidden: false,
        deleted: false,
        content: value,
        initialContent: value,
        isDirty: false,
      };
    } else {
      nextEntries[entry.id] = {
        ...entry,
        hidden: true,
        deleted: true,
        content: "",
        initialContent: "",
        isDirty: false,
      };
      if (nextActive === entry.id) {
        nextActive = null;
      }
    }
  });
  return { entries: nextEntries, activeFileId: nextActive };
}

function generateCommitId() {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function resolveRef(state: PlaygroundState, ref?: string): ResolvedRef | null {
  if (!ref || ref === "HEAD") {
    if (!state.headCommitId) return null;
    return { commitId: state.headCommitId };
  }
  if (Object.prototype.hasOwnProperty.call(state.branches, ref)) {
    const commitId = state.branches[ref];
    if (!commitId) return null;
    return { commitId, branchName: ref };
  }
  if (state.commitSnapshots[ref]) {
    return { commitId: ref };
  }
  return null;
}

function recomputePaths(entries: Record<string, Entry>, startId: string) {
  const nextEntries = { ...entries };
  const updatePath = (entryId: string) => {
    const node = nextEntries[entryId];
    if (!node) return;
    let newPath = "/";
    if (node.parentId != null) {
      const parent = nextEntries[node.parentId];
      const parentPath = parent?.path ?? "/";
      newPath = parentPath === "/" ? `/${node.name}` : `${parentPath}/${node.name}`;
    }
    if (node.parentId == null) {
      newPath = "/";
    }
    if (node.type === "file") {
      nextEntries[entryId] = { ...node, path: newPath };
    } else {
      nextEntries[entryId] = { ...node, path: newPath, children: [...node.children] };
      node.children.forEach(updatePath);
    }
  };
  updatePath(startId);
  return nextEntries;
}

function cleanupDanglingChildren(entries: Record<string, Entry>, entryId: string) {
  const node = entries[entryId];
  if (!node || node.type !== "directory") return;
  const nextChildren = node.children.filter((childId) => entries[childId]);
  if (nextChildren.length !== node.children.length) {
    entries[entryId] = { ...node, children: nextChildren };
  }
  nextChildren.forEach((childId) => cleanupDanglingChildren(entries, childId));
}

export const usePlaygroundStore = create<PlaygroundState>((set, get) => ({
  entries: initialEntries,
  rootId: ROOT_ID,
  activeFileId: "readme",
  timeline: [
    {
      id: createId(),
      kind: "command",
      label: "Workspace initialized",
      detail: "Loaded starter repository snapshot.",
      timestamp: Date.now(),
    },
  ],
  tasks: initialTasks,
  hints: initialHints,
  activeHintId: initialHints[0]?.id ?? null,
  commits: initialCommits,
  commitSnapshots: { [initialCommitId]: initialSnapshot },
  branches: { main: initialCommitId },
  currentBranch: "main",
  headCommitId: initialCommitId,
  headDetached: false,
  stagedFileIds: [],
  selectFile: (id) => {
    const entry = get().entries[id];
    if (!entry || entry.type !== "file" || entry.hidden) return;
    set({ activeFileId: id });
    get().logEvent({
      kind: "command",
      label: `Opened ${entry.name}`,
      detail: `Path ${entry.path}`,
    });
  },
  updateFileContent: (id, content) => {
    set((state) => {
      const entry = state.entries[id];
      if (!entry || entry.type !== "file") return state;
      if (entry.hidden) return state;
      const updated: FileEntry = {
        ...entry,
        content,
        isDirty: content !== entry.initialContent,
        lastEdited: Date.now(),
      };
      const entries = { ...state.entries, [id]: updated };
      const timeline = appendEvent(state.timeline, {
        id: createId(),
        kind: "edit",
        label: `Edited ${entry.name}`,
        detail: `${content.length} chars`,
        timestamp: Date.now(),
      });
      return { entries, timeline };
    });
  },
  createEntry: (parentId, rawName, type) => {
    set((state) => {
      const parent = state.entries[parentId];
      if (!parent || parent.type !== "directory") return state;
      const name = rawName.trim();
      if (!name) return state;
      const id = createId();
      const path = parent.path === "/" ? `/${name}` : `${parent.path}/${name}`;
      const entries = { ...state.entries };
      if (type === "directory") {
        entries[id] = {
          id,
          name,
          type: "directory",
          parentId,
          path,
          children: [],
          hidden: false,
        };
      } else {
        entries[id] = {
          id,
          name,
          type: "file",
          parentId,
          path,
          content: "",
          initialContent: "",
          baselinePath: path,
          isDirty: true,
          tracked: false,
          hidden: false,
          deleted: false,
        };
      }
      entries[parentId] = { ...parent, children: [...parent.children, id] };
      const timeline = appendEvent(state.timeline, {
        id: createId(),
        kind: "command",
        label: `${type === "file" ? "Created file" : "Created folder"} ${name}`,
        detail: `Parent ${parent.path}`,
        timestamp: Date.now(),
      });
      return { entries, timeline };
    });
  },
  deleteEntry: (id) => {
    set((state) => {
      const entry = state.entries[id];
      if (!entry || entry.parentId == null) return state;
      const entries: Record<string, Entry> = { ...state.entries };
      const now = Date.now();

      const markDeleted = (entryId: string) => {
        const node = entries[entryId];
        if (!node) return;
        if (node.type === "directory") {
          node.children.forEach((childId) => markDeleted(childId));
          const remainingChildren = node.children.filter((childId) => entries[childId]);
          entries[entryId] = { ...node, hidden: true, children: remainingChildren };
          return;
        }
        if (node.tracked) {
          entries[entryId] = {
            ...node,
            hidden: true,
            deleted: true,
            isDirty: true,
            content: "",
            lastEdited: now,
          };
        } else {
          delete entries[entryId];
        }
      };

      markDeleted(id);

      const parent = entries[entry.parentId];
      if (parent && parent.type === "directory") {
        entries[parent.id] = {
          ...parent,
          children: parent.children.filter((childId) => entries[childId]),
        };
      }

      const timeline = appendEvent(state.timeline, {
        id: createId(),
        kind: "command",
        label: `Deleted ${entry.name}`,
        detail: `Path ${entry.path}`,
        timestamp: now,
      });
      const activeFileId = state.activeFileId === id ? null : state.activeFileId;
      return { entries, timeline, activeFileId };
    });
  },
  logEvent: (event) => {
    set((state) => {
      const timeline = appendEvent(state.timeline, {
        id: createId(),
        timestamp: event.timestamp ?? Date.now(),
        ...event,
      });
      return { timeline };
    });
  },
  toggleTask: (id) => {
    set((state) => {
      const tasks = state.tasks.map((task) =>
        task.id === id ? { ...task, done: !task.done } : task
      );
      return { tasks };
    });
  },
  viewHint: (id) => {
    const hint = get().hints.find((item) => item.id === id);
    if (!hint) return;
    set({ activeHintId: id });
    get().logEvent({
      kind: "hint",
      label: `Viewed hint: ${hint.title}`,
    });
  },
  getEntryByPath: (path) => {
    const state = get();
    const normalized = sanitizePath(path);
    if (normalized === "/") {
      return state.entries[state.rootId] ?? null;
    }
    const segments = normalized.split("/").filter(Boolean);
    let current: Entry | undefined = state.entries[state.rootId];
    for (const segment of segments) {
      if (!current || current.type !== "directory") return null;
      const childId = current.children
        .map((child) => state.entries[child])
        .find((child) => child && child.name === segment)?.id;
      if (!childId) return null;
      current = state.entries[childId];
    }
    return current ?? null;
  },
  stageEntryIds: (ids) => {
    const state = get();
    const staged = new Set(state.stagedFileIds);
    const stagedPaths: string[] = [];
    ids.forEach((id) => {
      const entry = state.entries[id];
      if (!entry || entry.type !== "file") return;
      if (entry.hidden && !entry.deleted) return;
      if (!entry.deleted && !entry.isDirty && entry.tracked) return;
      if (staged.has(id)) return;
      staged.add(id);
      const displayPath = entry.deleted ? entry.baselinePath ?? entry.path : entry.path;
      stagedPaths.push(displayPath);
    });
    if (stagedPaths.length === 0) {
      return [];
    }
    set({ stagedFileIds: Array.from(staged) });
    get().logEvent({
      kind: "git",
      label: `Staged ${stagedPaths.length} file(s)`,
      detail: stagedPaths.join(", "),
    });
    return stagedPaths;
  },
  stageAllDirty: () => {
    const state = get();
    const dirtyIds = Object.values(state.entries)
      .filter(
        (entry): entry is FileEntry =>
          entry.type === "file" &&
          (entry.deleted || !entry.hidden) &&
          (entry.isDirty || entry.deleted || !entry.tracked)
      )
      .map((entry) => entry.id);
    return state.stageEntryIds(dirtyIds);
  },
  unstageEntryIds: (ids) => {
    const state = get();
    const staged = new Set(state.stagedFileIds);
    const removed: string[] = [];
    ids.forEach((id) => {
      if (!staged.has(id)) return;
      staged.delete(id);
      const entry = state.entries[id];
      if (entry && entry.type === "file") {
        const displayPath = entry.deleted ? entry.baselinePath ?? entry.path : entry.path;
        removed.push(displayPath);
      }
    });
    if (removed.length === 0) {
      return [];
    }
    const timeline = appendEvent(state.timeline, {
      id: createId(),
      kind: "git",
      label: `Unstaged ${removed.length} file(s)`,
      detail: removed.join(", "),
      timestamp: Date.now(),
    });
    set({ stagedFileIds: Array.from(staged), timeline });
    return removed;
  },
  clearStage: () => {
    set({ stagedFileIds: [] });
  },
  renameEntry: (id, rawName) => {
    const nextName = rawName.trim();
    if (!nextName) return false;
    const state = get();
    const entry = state.entries[id];
    if (!entry || entry.parentId == null) return false;
    const parent = state.entries[entry.parentId];
    if (!parent || parent.type !== "directory") return false;
    const entries: Record<string, Entry> = { ...state.entries };
    const markDirty = (entryId: string) => {
      const node = entries[entryId];
      if (!node) return;
      if (node.type === "file") {
        entries[entryId] = { ...node, isDirty: true };
      } else {
        node.children.forEach(markDirty);
      }
    };
    if (entry.type === "file") {
      entries[id] = { ...entry, name: nextName, isDirty: true };
    } else {
      entries[id] = { ...entry, name: nextName, children: [...entry.children] };
      entry.children.forEach(markDirty);
    }
    const updatedEntries = recomputePaths(entries, id);
    const timeline = appendEvent(state.timeline, {
      id: createId(),
      kind: "command",
      label: `Renamed ${entry.name} -> ${nextName}`,
      detail: updatedEntries[id]?.path,
      timestamp: Date.now(),
    });
    set({ entries: updatedEntries, timeline });
    return true;
  },
  hardReset: (target) => {
    const state = get();
    const resolved = resolveRef(state, target);
    if (!resolved) {
      return {
        success: false,
        output: [`fatal: reference '${target ?? "HEAD"}' not found`],
      };
    }
    const snapshot = state.commitSnapshots[resolved.commitId];
    if (!snapshot) {
      return {
        success: false,
        output: [`fatal: snapshot for '${resolved.commitId}' missing`],
      };
    }
    const { entries, activeFileId } = applySnapshotToEntries(
      state.entries,
      snapshot,
      state.activeFileId
    );
    const branches = state.headDetached
      ? { ...state.branches }
      : { ...state.branches, [state.currentBranch]: resolved.commitId };
    const timeline = appendEvent(state.timeline, {
      id: createId(),
      kind: "git",
      label: `git reset --hard ${target ?? "HEAD"}`,
      detail: resolved.commitId,
      timestamp: Date.now(),
    });
    set({
      entries,
      activeFileId,
      branches,
      headCommitId: resolved.commitId,
      headDetached: state.headDetached,
      stagedFileIds: [],
      timeline,
    });
    return {
      success: true,
      output: [
        `HEAD is now at ${resolved.commitId}`,
        "Working tree reset to snapshot.",
      ],
    };
  },
  listBranches: () => {
    const state = get();
    return Object.keys(state.branches)
      .sort()
      .map((name) => ({
        name,
        commitId: state.branches[name] ?? null,
        isCurrent: !state.headDetached && state.currentBranch === name,
      }));
  },
  getCommitLog: (limit = 10) => {
    const state = get();
    const commitMap = new Map(state.commits.map((commit) => [commit.id, commit]));
    const log: CommitNode[] = [];
    let current = state.headCommitId;
    while (current && log.length < limit) {
      const commit = commitMap.get(current);
      if (!commit) break;
      log.push(commit);
      current = commit.parents[0];
    }
    if (log.length === 0) {
      return [...state.commits].slice(-limit).reverse();
    }
    return log;
  },
  commitChanges: (message) => {
    const state = get();
    if (state.headDetached) {
      return {
        success: false,
        output: ["error: detached HEAD. Switch to a branch before committing."],
      };
    }
    if (!message.trim()) {
      return {
        success: false,
        output: ["error: please provide a commit message (use -m \"msg\")."],
      };
    }
    if (state.stagedFileIds.length === 0) {
      return {
        success: false,
        output: ["nothing to commit (use \"git add\" to stage files)"],
      };
    }
    const parentId = state.headCommitId;
    const baseSnapshot = parentId
      ? { ...state.commitSnapshots[parentId] }
      : {};
    const entries = { ...state.entries };
    const stagedSet = new Set(state.stagedFileIds);
    Object.values(entries).forEach((entry) => {
      if (entry.type !== "file" || !stagedSet.has(entry.id)) return;
      if (entry.deleted) {
        delete baseSnapshot[entry.baselinePath ?? entry.path];
        return;
      }
      if (entry.baselinePath && entry.baselinePath !== entry.path) {
        delete baseSnapshot[entry.baselinePath];
      }
      baseSnapshot[entry.path] = entry.content;
    });
    const commitId = generateCommitId();
    const commit: CommitNode = {
      id: commitId,
      message,
      parents: parentId ? [parentId] : [],
      author: "student",
      timestamp: Date.now(),
    };
    stagedSet.forEach((id) => {
      const entry = entries[id];
      if (!entry || entry.type !== "file") return;
      if (entry.deleted) {
        if (entry.parentId) {
          const parent = entries[entry.parentId];
          if (parent && parent.type === "directory") {
            entries[entry.parentId] = {
              ...parent,
              children: parent.children.filter((child) => child !== id),
            };
          }
        }
        delete entries[id];
        return;
      }
      entries[id] = {
        ...entry,
        tracked: true,
        hidden: false,
        deleted: false,
        baselinePath: entry.path,
        initialContent: entry.content,
        isDirty: false,
      };
    });
    cleanupDanglingChildren(entries, state.rootId);
    const branches = {
      ...state.branches,
      [state.currentBranch]: commitId,
    };
    const commits = [...state.commits, commit];
    const commitSnapshots = { ...state.commitSnapshots, [commitId]: baseSnapshot };
    const timeline = appendEvent(state.timeline, {
      id: createId(),
      kind: "git",
      label: `Commit ${commitId}`,
      detail: message,
      timestamp: Date.now(),
    });
    set({
      entries,
      commits,
      commitSnapshots,
      branches,
      headCommitId: commitId,
      activeFileId: state.activeFileId,
      headDetached: false,
      stagedFileIds: [],
      timeline,
    });
    return {
      success: true,
      output: [
        `[${state.currentBranch}] ${commitId}`,
        ` ${message}`,
        "",
        `${stagedSet.size} file(s) committed.`,
      ],
    };
  },
  checkoutBranch: (branch) => {
    const state = get();
    const target = state.branches[branch];
    if (!target) {
      return {
        success: false,
        output: [`error: branch '${branch}' not found`],
      };
    }
    const snapshot = state.commitSnapshots[target];
    if (!snapshot) {
      return {
        success: false,
        output: [`error: missing snapshot for ${target}`],
      };
    }
    const { entries, activeFileId } = applySnapshotToEntries(
      state.entries,
      snapshot,
      state.activeFileId
    );
    const timeline = appendEvent(state.timeline, {
      id: createId(),
      kind: "git",
      label: `Checkout ${branch}`,
      detail: `HEAD -> ${target}`,
      timestamp: Date.now(),
    });
    set({
      entries,
      activeFileId,
      headCommitId: target,
      headDetached: false,
      currentBranch: branch,
      stagedFileIds: [],
      timeline,
    });
    return {
      success: true,
      output: [`Switched to branch '${branch}'`],
    };
  },
  createBranch: (branch) => {
    const state = get();
    if (state.branches[branch]) {
      return {
        success: false,
        output: [`fatal: branch '${branch}' already exists`],
      };
    }
    if (!state.headCommitId) {
      return {
        success: false,
        output: ["error: no commits yet"],
      };
    }
    const branches = { ...state.branches, [branch]: state.headCommitId };
    const timeline = appendEvent(state.timeline, {
      id: createId(),
      kind: "git",
      label: `Created branch ${branch}`,
      detail: `HEAD @ ${state.headCommitId}`,
      timestamp: Date.now(),
    });
    set({ branches, timeline });
    return {
      success: true,
      output: [`Branch '${branch}' created pointing to ${state.headCommitId}`],
    };
  },
  renameBranch: (oldName, newName, force = false) => {
    const state = get();
    const trimmedOld = oldName.trim();
    const trimmedNew = newName.trim();
    if (!trimmedOld || !trimmedNew) {
      return { success: false, output: ["usage: git branch -m <old> <new>"] };
    }
    if (!Object.prototype.hasOwnProperty.call(state.branches, trimmedOld)) {
      return { success: false, output: [`error: branch '${trimmedOld}' not found`] };
    }
    if (
      trimmedOld !== trimmedNew &&
      Object.prototype.hasOwnProperty.call(state.branches, trimmedNew) &&
      !force
    ) {
      return {
        success: false,
        output: [
          `fatal: A branch named '${trimmedNew}' already exists.`,
          "Use -M to force rename.",
        ],
      };
    }
    const branches = { ...state.branches };
    const commitId = branches[trimmedOld];
    delete branches[trimmedOld];
    branches[trimmedNew] = commitId ?? null;
    const currentBranch =
      state.currentBranch === trimmedOld ? trimmedNew : state.currentBranch;
    const timeline = appendEvent(state.timeline, {
      id: createId(),
      kind: "git",
      label: `Renamed branch ${trimmedOld} -> ${trimmedNew}`,
      timestamp: Date.now(),
    });
    set({ branches, currentBranch, timeline });
    return {
      success: true,
      output: [`Branch '${trimmedOld}' renamed to '${trimmedNew}'`],
    };
  },
  deleteBranch: (branch, force = false) => {
    const state = get();
    if (!Object.prototype.hasOwnProperty.call(state.branches, branch)) {
      return { success: false, output: [`error: branch '${branch}' not found`] };
    }
    if (!force && state.currentBranch === branch && !state.headDetached) {
      return {
        success: false,
        output: ["error: Cannot delete the branch you are currently on."],
      };
    }
    const branchHead = state.branches[branch];
    if (!force && branchHead && state.headCommitId && branchHead !== state.headCommitId) {
      return {
        success: false,
        output: [
          `error: The branch '${branch}' is not fully merged.`,
          "Use -D to force delete.",
        ],
      };
    }
    const branches = { ...state.branches };
    delete branches[branch];
    const timeline = appendEvent(state.timeline, {
      id: createId(),
      kind: "git",
      label: `Deleted branch ${branch}${force ? " (force)" : ""}`,
      timestamp: Date.now(),
    });
    set({ branches, timeline });
    return { success: true, output: [`Deleted branch '${branch}'`] };
  },
  checkoutCommit: (commitId) => {
    const state = get();
    const snapshot = state.commitSnapshots[commitId];
    if (!snapshot) {
      return {
        success: false,
        output: [`error: commit '${commitId}' not found`],
      };
    }
    const { entries, activeFileId } = applySnapshotToEntries(
      state.entries,
      snapshot,
      state.activeFileId
    );
    const timeline = appendEvent(state.timeline, {
      id: createId(),
      kind: "git",
      label: `Checkout commit ${commitId}`,
      detail: "HEAD detached",
      timestamp: Date.now(),
    });
    set({
      entries,
      activeFileId,
      headCommitId: commitId,
      headDetached: true,
      stagedFileIds: [],
      timeline,
    });
    return {
      success: true,
      output: [`Note: switching to '${commitId}'. HEAD is now detached.`],
    };
  },
  headLabel: () => {
    const state = get();
    if (state.headDetached) {
      return `HEAD (detached at ${state.headCommitId ?? "??"})`;
    }
    return `HEAD -> ${state.currentBranch}`;
  },
}));

export type PlaygroundStore = ReturnType<typeof usePlaygroundStore.getState>;
