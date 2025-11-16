"use client";

import { useCallback, useEffect, useRef } from "react";

import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";

import {
  usePlaygroundStore,
  type CommitNode,
  type Entry,
  type GitCommandResult,
  type PlaygroundStore,
} from "../store";

const PROMPT = "git-lab$ ";

export function TerminalPanel() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const bufferRef = useRef("");
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef(0);

  const runCommand = useCommandProcessor();

  const writePrompt = useCallback(() => {
    terminalRef.current?.write(`\r\n${PROMPT}`);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const term = new Terminal({
      convertEol: true,
      fontSize: 13,
      cursorBlink: true,
      scrollback: 1000,
      theme: {
        background: "#f8fafc",
        foreground: "#0f172a",
        cursor: "#111827",
        selectionBackground: "#c7d2fe",
      },
    });
    terminalRef.current = term;
    term.open(containerRef.current);
    term.writeln("Interactive shell ready. Type `help` to list commands.");
    term.write(PROMPT);

    const disposable = term.onData((data) => {
      handleData(
        data,
        term,
        bufferRef,
        historyRef,
        historyIndexRef,
        runCommand,
        writePrompt
      );
    });

    const resizeObserver = new ResizeObserver(() => {
      term.scrollToBottom();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      disposable.dispose();
      resizeObserver.disconnect();
      term.dispose();
    };
  }, [runCommand, writePrompt]);

  return (
    <section className="rounded-2xl border bg-white shadow-sm">
      <header className="flex items-center justify-between border-b px-4 py-2 text-xs uppercase tracking-[0.3em] text-slate-500">
        terminal
        <span className="text-[10px] font-mono text-slate-400">xterm.js</span>
      </header>
      <div ref={containerRef} className="h-72 w-full rounded-b-2xl bg-white" />
    </section>
  );
}

function handleData(
  data: string,
  term: Terminal,
  bufferRef: React.MutableRefObject<string>,
  historyRef: React.MutableRefObject<string[]>,
  historyIndexRef: React.MutableRefObject<number>,
  runCommand: (input: string) => string[],
  writePrompt: () => void
) {
  switch (data) {
    case "\u0003": // ctrl+c
      term.write("^C");
      bufferRef.current = "";
      writePrompt();
      return;
    case "\r":
      const input = bufferRef.current.trim();
      bufferRef.current = "";
      term.write("\r\n");
      if (input.length === 0) {
        writePrompt();
        return;
      }
      if (input.length > 0) {
        historyRef.current.push(input);
        historyIndexRef.current = historyRef.current.length;
      }
      const output = runCommand(input);
      output.forEach((line) => term.writeln(line));
      writePrompt();
      return;
    case "\u001b[A":
      navigateHistory(-1, term, bufferRef, historyRef, historyIndexRef);
      return;
    case "\u001b[B":
      navigateHistory(1, term, bufferRef, historyRef, historyIndexRef);
      return;
    case "\u007F": {
      if (bufferRef.current.length === 0) return;
      bufferRef.current = bufferRef.current.slice(0, -1);
      term.write("\b \b");
      return;
    }
    default:
      bufferRef.current += data;
      term.write(data);
  }
}

function navigateHistory(
  direction: number,
  term: Terminal,
  bufferRef: React.MutableRefObject<string>,
  historyRef: React.MutableRefObject<string[]>,
  historyIndexRef: React.MutableRefObject<number>
) {
  const history = historyRef.current;
  if (history.length === 0) return;
  let nextIndex = historyIndexRef.current + direction;
  nextIndex = Math.max(0, Math.min(history.length, nextIndex));
  historyIndexRef.current = nextIndex;
  const value = history[nextIndex] ?? "";
  bufferRef.current = value;
  term.write(`\x1b[2K\r${PROMPT}${value}`);
}

function useCommandProcessor() {
  const logEvent = usePlaygroundStore((state) => state.logEvent);
  const selectFile = usePlaygroundStore((state) => state.selectFile);
  const createEntry = usePlaygroundStore((state) => state.createEntry);
  const getEntryByPath = usePlaygroundStore((state) => state.getEntryByPath);
  const stageEntryIds = usePlaygroundStore((state) => state.stageEntryIds);
  const stageAllDirty = usePlaygroundStore((state) => state.stageAllDirty);
  const commitChanges = usePlaygroundStore((state) => state.commitChanges);
  const checkoutBranch = usePlaygroundStore((state) => state.checkoutBranch);
  const createBranch = usePlaygroundStore((state) => state.createBranch);
  const checkoutCommit = usePlaygroundStore((state) => state.checkoutCommit);
  const headLabel = usePlaygroundStore((state) => state.headLabel);
  const listBranches = usePlaygroundStore((state) => state.listBranches);
  const getCommitLog = usePlaygroundStore((state) => state.getCommitLog);
  const hardReset = usePlaygroundStore((state) => state.hardReset);
  const clearStage = usePlaygroundStore((state) => state.clearStage);
  const renameBranch = usePlaygroundStore((state) => state.renameBranch);
  const deleteBranch = usePlaygroundStore((state) => state.deleteBranch);

  return useCallback(
    (input: string) => {
      const tokens = tokenize(input);
      const command = tokens.shift()?.toLowerCase() ?? "";
      switch (command) {
        case "help":
          return [
            "Available commands:",
            "help, ls [path], open <path>, cat <path>, touch <name>, mkdir <name>",
            "git commands: status, add, commit, checkout, switch, branch, log, reset",
          ];
        case "ls": {
          const target = tokens[0] ?? "/";
          const entry = getEntryByPath(target);
          if (!entry || entry.hidden)
            return [`ls: cannot access '${target}': No such entry`];
          if (entry.type === "file") {
            return [entry.name];
          }
          const children = entry.children
            .map((childId) => usePlaygroundStore.getState().entries[childId])
            .filter(
              (child): child is Entry =>
                Boolean(child && !child.hidden)
            )
            .map((child) =>
              child!.type === "directory" ? `${child!.name}/` : child!.name
            );
          logEvent({ kind: "command", label: `ls ${target}` });
          return children.length ? children : ["(empty)"];
        }
        case "open": {
          const target = tokens[0];
          if (!target) return ["Usage: open <path>"];
          const entry = getEntryByPath(target);
          if (!entry || entry.type !== "file" || entry.hidden) {
            return [`open: ${target} is not a file`];
          }
          selectFile(entry.id);
          logEvent({ kind: "command", label: `Opened ${entry.path}` });
          return [`Opened ${entry.path}`];
        }
        case "cat": {
          const target = tokens[0];
          if (!target) return ["Usage: cat <path>"];
          const entry = getEntryByPath(target);
          if (!entry || entry.type !== "file" || entry.hidden)
            return [`cat: ${target}: not a file`];
          logEvent({ kind: "command", label: `Cat ${entry.path}` });
          return entry.content.split("\n");
        }
        case "touch": {
          const name = tokens[0];
          if (!name) return ["Usage: touch <name>"];
          createEntry(usePlaygroundStore.getState().rootId, name, "file");
          return [`Created file ${name}`];
        }
        case "mkdir": {
          const name = tokens[0];
          if (!name) return ["Usage: mkdir <name>"];
          createEntry(usePlaygroundStore.getState().rootId, name, "directory");
          return [`Created directory ${name}`];
        }
        case "git": {
          return runGitCommand({
            tokens,
            stageEntryIds,
            clearStage,
            stageAllDirty,
            commitChanges,
            checkoutBranch,
            createBranch,
            renameBranch,
            deleteBranch,
            checkoutCommit,
            getEntryByPath,
            headLabel,
            logEvent,
            listBranches,
            getCommitLog,
            hardReset,
          });
        }
        default:
          return [`Command not found: ${command}`];
      }
    },
    [
      checkoutBranch,
      checkoutCommit,
      clearStage,
      commitChanges,
      createBranch,
      deleteBranch,
      createEntry,
      getCommitLog,
      getEntryByPath,
      renameBranch,
      hardReset,
      headLabel,
      listBranches,
      logEvent,
      selectFile,
      stageAllDirty,
      stageEntryIds,
    ]
  );
}

function runGitCommand({
  tokens,
  stageEntryIds,
  clearStage,
  stageAllDirty,
  commitChanges,
  checkoutBranch,
  createBranch,
  renameBranch,
  deleteBranch,
  checkoutCommit,
  getEntryByPath,
  headLabel,
  logEvent,
  listBranches,
  getCommitLog,
  hardReset,
}: {
  tokens: string[];
  stageEntryIds: (ids: string[]) => string[];
  clearStage: () => void;
  stageAllDirty: () => string[];
  commitChanges: (message: string) => { success: boolean; output: string[] };
  checkoutBranch: (branch: string) => { success: boolean; output: string[] };
  createBranch: (branch: string) => { success: boolean; output: string[] };
  renameBranch: (oldName: string, newName: string, force?: boolean) => GitCommandResult;
  deleteBranch: (branch: string, force?: boolean) => GitCommandResult;
  checkoutCommit: (commitId: string) => { success: boolean; output: string[] };
  getEntryByPath: (path: string) => Entry | null;
  headLabel: () => string;
  logEvent: PlaygroundStore["logEvent"];
  listBranches: () => { name: string; commitId: string | null; isCurrent: boolean }[];
  getCommitLog: (limit?: number) => CommitNode[];
  hardReset: (target?: string) => GitCommandResult;
}): string[] {
  if (tokens.length === 0) {
    return ["usage: git <command>"];
  }
  const sub = tokens.shift()!;
  switch (sub) {
    case "status":
      logEvent({ kind: "git", label: "git status" });
      return formatGitStatus(headLabel());
    case "add": {
      if (tokens.length === 0) return ["usage: git add <path|.>"];
      const target = tokens[0];
      const entries = usePlaygroundStore.getState().entries;
      if (target === ".") {
        const staged = stageAllDirty();
        return staged.length
          ? [`Staged ${staged.length} file(s).`]
          : ["Nothing to stage."];
      }
      const entry = getEntryByPath(target);
      if (!entry) return [`fatal: pathspec '${target}' did not match any files`];
      const ids =
        entry.type === "file"
          ? [entry.id]
          : collectVisibleFileIds(entry, entries);
      const staged = stageEntryIds(ids);
      if (staged.length) {
        logEvent({ kind: "git", label: `git add ${target}` });
      }
      return staged.length
        ? staged.map((path) => `staged: ${path}`)
        : ["Nothing new to stage."];
    }
    case "commit": {
      const messageIndex = tokens.findIndex((token) => token === "-m");
      if (messageIndex === -1 || !tokens[messageIndex + 1]) {
        return ["error: use git commit -m \"message\""];
      }
      const message = tokens[messageIndex + 1];
      const result = commitChanges(message);
      if (result.success) {
        logEvent({ kind: "git", label: `git commit`, detail: message });
      }
      return result.output;
    }
    case "checkout": {
      if (tokens.length === 0) return ["usage: git checkout <branch|commit>"];
      if (tokens[0] === "-b") {
        const branch = tokens[1];
        if (!branch) return ["usage: git checkout -b <branch>"];
        const createResult = createBranch(branch);
        if (!createResult.success) {
          return createResult.output;
        }
        return checkoutBranch(branch).output;
      }
      return checkoutTarget(tokens[0], checkoutBranch, checkoutCommit);
    }
    case "switch": {
      if (tokens.length === 0) return ["usage: git switch <branch>"];
      if (tokens[0] === "-c") {
        const branch = tokens[1];
        if (!branch) return ["usage: git switch -c <branch>"];
        const createResult = createBranch(branch);
        if (!createResult.success) {
          return createResult.output;
        }
        return checkoutBranch(branch).output;
      }
      return checkoutBranch(tokens[0]).output;
    }
    case "branch": {
      if (tokens.length === 0) {
        const branches = listBranches();
        if (branches.length === 0) return ["No branches created yet."];
        return branches.map((branch) => {
          const marker = branch.isCurrent ? "*" : " ";
          const suffix = branch.commitId ? ` (${branch.commitId})` : "";
          return `${marker} ${branch.name}${suffix}`;
        });
      }
      const flag = tokens[0];
      if (flag === "-m" || flag === "-M") {
        const force = flag === "-M";
        let oldName: string | undefined;
        let newName: string | undefined;
        if (tokens.length === 2) {
          oldName = usePlaygroundStore.getState().currentBranch;
          newName = tokens[1];
        } else if (tokens.length >= 3) {
          oldName = tokens[1];
          newName = tokens[2];
        }
        if (!oldName || !newName) {
          return ["usage: git branch -m [old] <new>"];
        }
        const result = renameBranch(oldName, newName, force);
        if (result.success) {
          logEvent({
            kind: "git",
            label: `git branch ${force ? "-M" : "-m"}`,
            detail: `${oldName} -> ${newName}`,
          });
        }
        return result.output;
      }
      if (flag === "-d" || flag === "-D") {
        const target = tokens[1];
        if (!target) {
          return ["usage: git branch -d <branch>"];
        }
        const result = deleteBranch(target, flag === "-D");
        if (result.success) {
          logEvent({
            kind: "git",
            label: `git branch ${flag}`,
            detail: target,
          });
        }
        return result.output;
      }
      const name = flag;
      const result = createBranch(name);
      if (result.success) {
        logEvent({ kind: "git", label: `git branch ${name}` });
      }
      return result.output;
    }
    case "log": {
      let limit = 10;
      const nIndex = tokens.indexOf("-n");
      if (nIndex !== -1 && tokens[nIndex + 1]) {
        const parsed = Number(tokens[nIndex + 1]);
        if (!Number.isNaN(parsed) && parsed > 0) {
          limit = parsed;
        }
      }
      const commits = getCommitLog(limit);
      if (commits.length === 0) {
        return ["No commits yet. Make one with git commit -m \"message\"."];
      }
      logEvent({ kind: "git", label: "git log" });
      const lines: string[] = [];
      commits.forEach((commit, index) => {
        lines.push(`commit ${commit.id}`);
        lines.push(`Author: ${commit.author}`);
        lines.push(`Date:   ${formatLogDate(commit.timestamp)}`);
        lines.push("");
        lines.push(`    ${commit.message}`);
        if (index !== commits.length - 1) {
          lines.push("");
        }
      });
      return lines;
    }
    case "reset": {
      if (tokens.length === 0) {
        clearStage();
        return ["Unstaged all files (mixed reset)."];
      }
      if (tokens[0] === "--hard") {
        const target = tokens[1];
        const result = hardReset(target);
        if (result.success) {
          logEvent({
            kind: "git",
            label: "git reset --hard",
            detail: target ?? "HEAD",
          });
        }
        return result.output;
      }
      return ["Supported reset commands: git reset, git reset --hard [ref]"];
    }
    default:
      return [`git: '${sub}' is not supported yet.`];
  }
}

function checkoutTarget(
  target: string,
  checkoutBranch: (branch: string) => { success: boolean; output: string[] },
  checkoutCommit: (commitId: string) => { success: boolean; output: string[] }
) {
  const branches = usePlaygroundStore.getState().branches;
  if (Object.prototype.hasOwnProperty.call(branches, target)) {
    return checkoutBranch(target).output;
  }
  return checkoutCommit(target).output;
}

function formatGitStatus(headLabel: string) {
  const state = usePlaygroundStore.getState();
  const stagedSet = new Set(state.stagedFileIds);
  const staged: Array<{ path: string; type: "modified" | "deleted" }> = [];
  const modified: Array<{ path: string; type: "modified" | "deleted" }> = [];
  const untracked: string[] = [];
  Object.values(state.entries).forEach((entry) => {
    if (entry.type !== "file") return;
    const displayPath = entry.deleted ? entry.baselinePath ?? entry.path : entry.path;
    if (entry.hidden && !entry.deleted) return;
    if (stagedSet.has(entry.id)) {
      staged.push({ path: displayPath, type: entry.deleted ? "deleted" : "modified" });
      return;
    }
    if (!entry.tracked) {
      if (!entry.hidden && entry.isDirty) {
        untracked.push(entry.path);
      }
      return;
    }
    if (entry.deleted) {
      modified.push({ path: displayPath, type: "deleted" });
      return;
    }
    if (entry.isDirty) {
      modified.push({ path: entry.path, type: "modified" });
    }
  });
  const lines = [headLabel, ""];
  if (staged.length) {
    lines.push("Changes to be committed:", "  (use \"git reset HEAD <file>...\" to unstage)");
    staged.forEach((item) =>
      lines.push(
        `        ${item.type === "deleted" ? "deleted:   " : "modified:  "}${item.path}`
      )
    );
    lines.push("");
  }
  if (modified.length) {
    lines.push("Changes not staged for commit:", "  (use \"git add <file>...\" to update what will be committed)");
    modified.forEach((item) =>
      lines.push(
        `        ${item.type === "deleted" ? "deleted:   " : "modified:  "}${item.path}`
      )
    );
    lines.push("");
  }
  if (untracked.length) {
    lines.push("Untracked files:", "  (use \"git add <file>...\" to include in what will be committed)");
    untracked.forEach((path) => lines.push(`        ${path}`));
    lines.push("");
  }
  if (staged.length === 0 && modified.length === 0 && untracked.length === 0) {
    lines.push("nothing to commit, working tree clean");
  }
  return lines;
}

const LOG_DATE_FORMATTER = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatLogDate(timestamp: number) {
  return LOG_DATE_FORMATTER.format(timestamp);
}

function collectVisibleFileIds(entry: Entry, entries: Record<string, Entry>) {
  if (entry.type === "file") {
    if (entry.hidden && !entry.deleted) return [];
    return [entry.id];
  }
  return entry.children.flatMap((childId) => {
    const child = entries[childId];
    if (!child) return [];
    if (child.type === "file") {
      if (child.hidden && !child.deleted) return [];
      return [child.id];
    }
    return collectVisibleFileIds(child, entries);
  });
}

function tokenize(input: string) {
  const tokens: string[] = [];
  const regex = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(input))) {
    tokens.push(match[1] ?? match[2] ?? match[3]);
  }
  return tokens;
}
