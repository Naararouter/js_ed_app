"use client";

import { useCallback, useEffect, useRef } from "react";

import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";

import { usePlaygroundStore } from "../store";

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
      theme: {
        background: "#0b1021",
        foreground: "#f8fafc",
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
    <section className="rounded-2xl border bg-[#05060f] shadow-lg">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-white/60">
        terminal
        <span className="text-[10px] font-mono">xterm.js</span>
      </header>
      <div
        ref={containerRef}
        className="h-64 w-full overflow-hidden rounded-b-2xl bg-[#05060f]"
      />
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

  return useCallback(
    (input: string) => {
      const [command, ...rest] = input.split(/\s+/);
      const args = rest.join(" ");
      switch (command) {
        case "help":
          return [
            "Available commands:",
            "help, ls [path], open <path>, cat <path>, touch <name>, mkdir <name>, git status",
          ];
        case "ls": {
          const target = args || "/";
          const entry = getEntryByPath(target);
          if (!entry) return [`ls: cannot access '${target}': No such entry`];
          if (entry.type === "file") {
            return [entry.name];
          }
          const children = entry.children
            .map((childId) => usePlaygroundStore.getState().entries[childId])
            .filter(Boolean)
            .map((child) =>
              child!.type === "directory" ? `${child!.name}/` : child!.name
            );
          logEvent({ kind: "command", label: `ls ${target}` });
          return children.length ? children : ["(empty)"];
        }
        case "open": {
          if (!args) return ["Usage: open <path>"];
          const entry = getEntryByPath(args);
          if (!entry || entry.type !== "file") {
            return [`open: ${args} is not a file`];
          }
          selectFile(entry.id);
          logEvent({ kind: "command", label: `Opened ${entry.path}` });
          return [`Opened ${entry.path}`];
        }
        case "cat": {
          if (!args) return ["Usage: cat <path>"];
          const entry = getEntryByPath(args);
          if (!entry || entry.type !== "file") return [`cat: ${args}: not a file`];
          logEvent({ kind: "command", label: `Cat ${entry.path}` });
          return entry.content.split("\n");
        }
        case "touch": {
          if (!args) return ["Usage: touch <name>"];
          createEntry(usePlaygroundStore.getState().rootId, args, "file");
          return [`Created file ${args}`];
        }
        case "mkdir": {
          if (!args) return ["Usage: mkdir <name>"];
          createEntry(usePlaygroundStore.getState().rootId, args, "directory");
          return [`Created directory ${args}`];
        }
        case "git": {
          if (rest[0] === "status") {
            const files = Object.values(usePlaygroundStore.getState().entries)
              .filter((entry) => entry.type === "file" && entry.isDirty)
              .map((entry) => `modified:   ${entry.path}`);
            const lines = files.length ? files : ["nothing to commit, working tree clean"];
            logEvent({ kind: "git", label: "git status" });
            return ["On branch main", "", ...lines];
          }
          return ["Supported git commands: status"];
        }
        default:
          return [`Command not found: ${command}`];
      }
    },
    [createEntry, getEntryByPath, logEvent, selectFile]
  );
}

