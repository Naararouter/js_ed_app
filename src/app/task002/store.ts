"use client";

import { create } from "zustand";

type EntryType = "file" | "directory";

export interface DirectoryEntry {
  id: string;
  name: string;
  type: "directory";
  parentId: string | null;
  path: string;
  children: string[];
}

export interface FileEntry {
  id: string;
  name: string;
  type: "file";
  parentId: string | null;
  path: string;
  content: string;
  initialContent: string;
  language?: string;
  isDirty: boolean;
  lastEdited?: number;
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
  branch: string;
  parents: string[];
  author: string;
  timestamp: number;
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
  activeCommitId: string | null;
  selectFile: (id: string) => void;
  updateFileContent: (id: string, content: string) => void;
  createEntry: (parentId: string, name: string, type: EntryType) => void;
  deleteEntry: (id: string) => void;
  logEvent: (event: Omit<TimelineEvent, "id" | "timestamp"> & { timestamp?: number }) => void;
  setActiveCommit: (id: string) => void;
  toggleTask: (id: string) => void;
  viewHint: (id: string) => void;
  getEntryByPath: (path: string) => Entry | null;
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
    isDirty: false,
    language: "markdown",
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
    isDirty: false,
    language: "typescript",
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
    isDirty: false,
    language: "markdown",
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

const initialCommits: CommitNode[] = [
  {
    id: "c1",
    message: "feat: bootstrap playground",
    branch: "main",
    parents: [],
    author: "mentor",
    timestamp: Date.now() - 1000 * 60 * 60 * 24,
  },
  {
    id: "c2",
    message: "feat: add terminal shell",
    branch: "main",
    parents: ["c1"],
    author: "mentor",
    timestamp: Date.now() - 1000 * 60 * 60 * 12,
  },
  {
    id: "c3",
    message: "feat: graph prototype",
    branch: "feature/graph",
    parents: ["c2"],
    author: "mentor",
    timestamp: Date.now() - 1000 * 60 * 30,
  },
];

const createId = () => Math.random().toString(36).slice(2, 10);

const appendEvent = (timeline: TimelineEvent[], event: TimelineEvent) => {
  const next = [...timeline, event];
  if (next.length > 75) {
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
  activeCommitId: initialCommits[initialCommits.length - 1]?.id ?? null,
  selectFile: (id) => {
    const entry = get().entries[id];
    if (!entry || entry.type !== "file") return;
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
  createEntry: (parentId, name, type) => {
    set((state) => {
      const parent = state.entries[parentId];
      if (!parent || parent.type !== "directory") return state;
      if (!name.trim()) return state;
      const id = createId();
      const path =
        parent.path === "/" ? `/${name.trim()}` : `${parent.path}/${name.trim()}`;
      const nextEntries = { ...state.entries };
      if (type === "directory") {
        nextEntries[id] = {
          id,
          name: name.trim(),
          type: "directory",
          parentId,
          path,
          children: [],
        };
      } else {
        nextEntries[id] = {
          id,
          name: name.trim(),
          type: "file",
          parentId,
          path,
          content: "",
          initialContent: "",
          isDirty: true,
        };
      }
      nextEntries[parentId] = {
        ...parent,
        children: [...parent.children, id],
      };
      const timeline = appendEvent(state.timeline, {
        id: createId(),
        kind: "command",
        label: `${type === "file" ? "Created file" : "Created folder"} ${name.trim()}`,
        detail: `Parent ${parent.path}`,
        timestamp: Date.now(),
      });
      return { entries: nextEntries, timeline };
    });
  },
  deleteEntry: (id) => {
    set((state) => {
      const entry = state.entries[id];
      if (!entry || entry.parentId == null) return state;
      const nextEntries = { ...state.entries };
      const removeRecursive = (entryId: string) => {
        const node = nextEntries[entryId];
        if (!node) return;
        if (node.type === "directory") {
          node.children.forEach(removeRecursive);
        }
        delete nextEntries[entryId];
      };
      removeRecursive(id);
      const parent = state.entries[entry.parentId];
      if (parent && parent.type === "directory") {
        nextEntries[parent.id] = {
          ...parent,
          children: parent.children.filter((childId) => childId !== id),
        };
      }
      const timeline = appendEvent(state.timeline, {
        id: createId(),
        kind: "command",
        label: `Deleted ${entry.name}`,
        detail: `Path ${entry.path}`,
        timestamp: Date.now(),
      });
      const activeFileId =
        state.activeFileId === id ? null : state.activeFileId;
      return { entries: nextEntries, timeline, activeFileId };
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
  setActiveCommit: (id) => {
    set((state) => {
      if (!state.commits.some((commit) => commit.id === id)) return state;
      const timeline = appendEvent(state.timeline, {
        id: createId(),
        kind: "git",
        label: `Selected commit ${id}`,
        detail: state.commits.find((commit) => commit.id === id)?.message,
        timestamp: Date.now(),
      });
      return { activeCommitId: id, timeline };
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
        .find((child) => child?.name === segment)?.id;
      if (!childId) return null;
      current = state.entries[childId];
    }
    return current ?? null;
  },
}));

export type PlaygroundStore = ReturnType<typeof usePlaygroundStore.getState>;
