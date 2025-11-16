"use client";

import { useCallback, useEffect, useRef } from "react";

import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";

import { usePlaygroundStore, type Entry, type PlaygroundStore } from "../store";

const PROMPT = "git-lab$ ";

export function TerminalPanel() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const bufferRef = useRef("");

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
      handleData(data, term, bufferRef, runCommand, writePrompt);
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
      const output = runCommand(input);
      output.forEach((line) => term.writeln(line));
      writePrompt();
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

  return useCallback(
    (input: string) => {
      const tokens = tokenize(input);
      const command = tokens.shift()?.toLowerCase() ?? "";
      switch (command) {
        case "help":
          return [
            "Available commands:",
            "help, ls [path], open <path>, cat <path>, touch <name>, mkdir <name>",
            "git commands: status, add, commit, checkout, switch",
          ];
        case "ls": {
          const target = tokens[0] ?? "/";
          const entry = getEntryByPath(target);
          if (!entry) return [`ls: cannot access '${target}': No such entry`];
          if (entry.type === "file") {
            return [entry.name];
          }
          const children = entry.children
            .map((childId) => usePlaygroundStore.getState().entries[childId])
            .filter(
              (child): child is Entry =>
                Boolean(child && (child.type === "directory" || !child.hidden))
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
          if (!entry || entry.type !== "file") {
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
          if (!entry || entry.type !== "file")
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
            stageAllDirty,
            commitChanges,
            checkoutBranch,
            createBranch,
            checkoutCommit,
            getEntryByPath,
            headLabel,
            logEvent,
          });
        }
        default:
          return [`Command not found: ${command}`];
      }
    },
    [
      checkoutBranch,
      checkoutCommit,
      commitChanges,
      createBranch,
      createEntry,
      getEntryByPath,
      headLabel,
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
  stageAllDirty,
  commitChanges,
  checkoutBranch,
  createBranch,
  checkoutCommit,
  getEntryByPath,
  headLabel,
  logEvent,
}: {
  tokens: string[];
  stageEntryIds: (ids: string[]) => string[];
  stageAllDirty: () => string[];
  commitChanges: (message: string) => { success: boolean; output: string[] };
  checkoutBranch: (branch: string) => { success: boolean; output: string[] };
  createBranch: (branch: string) => { success: boolean; output: string[] };
  checkoutCommit: (commitId: string) => { success: boolean; output: string[] };
  getEntryByPath: (path: string) => Entry | null;
  headLabel: () => string;
  logEvent: PlaygroundStore["logEvent"];
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
  const staged: string[] = [];
  const modified: string[] = [];
  const untracked: string[] = [];
  Object.values(state.entries).forEach((entry) => {
    if (entry.type !== "file" || entry.hidden) return;
    if (stagedSet.has(entry.id)) {
      staged.push(entry.path);
      return;
    }
    if (!entry.tracked) {
      if (entry.isDirty) {
        untracked.push(entry.path);
      }
      return;
    }
    if (entry.isDirty) {
      modified.push(entry.path);
    }
  });
  const lines = [headLabel, ""];
  if (staged.length) {
    lines.push("Changes to be committed:", "  (use \"git reset HEAD <file>...\" to unstage)");
    staged.forEach((path) => lines.push(`        modified:   ${path}`));
    lines.push("");
  }
  if (modified.length) {
    lines.push("Changes not staged for commit:", "  (use \"git add <file>...\" to update what will be committed)");
    modified.forEach((path) => lines.push(`        modified:   ${path}`));
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

function collectVisibleFileIds(entry: Entry, entries: Record<string, Entry>) {
  if (entry.type === "file") {
    return entry.hidden ? [] : [entry.id];
  }
  return entry.children.flatMap((childId) => {
    const child = entries[childId];
    if (!child) return [];
    if (child.type === "file") {
      return child.hidden ? [] : [child.id];
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
