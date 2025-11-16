"use client";

import { useMemo } from "react";

import dagre from "dagre";
import {
  Background,
  Controls,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { usePlaygroundStore, type CommitNode } from "../store";

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const NODE_WIDTH = 220;
const NODE_HEIGHT = 80;

export function GraphPanel() {
  const commits = usePlaygroundStore((state) => state.commits);
  const activeCommitId = usePlaygroundStore((state) => state.activeCommitId);
  const setActiveCommit = usePlaygroundStore((state) => state.setActiveCommit);

  const { nodes, edges } = useMemo(
    () => buildGraph(commits, activeCommitId),
    [commits, activeCommitId]
  );

  const activeCommit = commits.find((commit) => commit.id === activeCommitId);

  return (
    <section className="flex h-[420px] flex-col gap-4 rounded-2xl border bg-card p-4 shadow-sm">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            git graph
          </p>
          <h2 className="text-lg font-semibold">Commit explorer</h2>
        </div>
        <span className="text-xs text-muted-foreground">
          {commits.length} commits
        </span>
      </header>
      <div className="flex-1 rounded-xl border">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.4}
          nodesDraggable={false}
          nodesConnectable={false}
          onNodeClick={(_, node) => setActiveCommit(node.id)}
        >
          <Background gap={16} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      {activeCommit ? (
        <div className="rounded-xl border bg-muted/40 p-4 text-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            selected commit
          </p>
          <p className="text-base font-semibold">{activeCommit.message}</p>
          <p className="text-xs text-muted-foreground">
            {activeCommit.id} • {activeCommit.branch} •{" "}
            {new Intl.DateTimeFormat("en", {
              hour: "2-digit",
              minute: "2-digit",
              month: "short",
              day: "numeric",
            }).format(activeCommit.timestamp)}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
          Select a commit to inspect metadata.
        </div>
      )}
    </section>
  );
}

const nodeTypes = {
  commit: CommitNodeComponent,
};

function CommitNodeComponent({ data }: { data: CommitNode }) {
  return (
    <div className="rounded-xl border bg-background px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-foreground">{data.message}</p>
      <p className="text-muted-foreground">
        {data.id} • {data.branch}
      </p>
    </div>
  );
}

function buildGraph(commits: CommitNode[], activeId: string | null) {
  dagreGraph.setGraph({
    rankdir: "TB",
    nodesep: 40,
    ranksep: 70,
  });
  commits.forEach((commit) => {
    dagreGraph.setNode(commit.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
    commit.parents.forEach((parent) => {
      dagreGraph.setEdge(parent, commit.id);
    });
  });
  dagre.layout(dagreGraph);

  const nodes: Node[] = commits.map((commit) => {
    const position = dagreGraph.node(commit.id);
    return {
      id: commit.id,
      type: "commit",
      data: commit,
      position: {
        x: position.x - NODE_WIDTH / 2,
        y: position.y - NODE_HEIGHT / 2,
      },
      className:
        commit.id === activeId
          ? "border-2 border-primary shadow-lg"
          : "opacity-90",
    };
  });

  const edges: Edge[] = commits.flatMap((commit) =>
    commit.parents.map((parentId) => ({
      id: `${parentId}-${commit.id}`,
      source: parentId,
      target: commit.id,
      animated: commit.id === activeId,
    }))
  );

  return { nodes, edges };
}

