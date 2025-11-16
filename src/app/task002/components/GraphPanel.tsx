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
const NODE_HEIGHT = 90;

interface GraphNodeData {
  commit: CommitNode;
  badges: string[];
  isHead: boolean;
}

export function GraphPanel() {
  const commits = usePlaygroundStore((state) => state.commits);
  const branches = usePlaygroundStore((state) => state.branches);
  const headCommitId = usePlaygroundStore((state) => state.headCommitId);
  const headDetached = usePlaygroundStore((state) => state.headDetached);
  const currentBranch = usePlaygroundStore((state) => state.currentBranch);
  const checkoutCommit = usePlaygroundStore((state) => state.checkoutCommit);
  const headLabel = usePlaygroundStore((state) => state.headLabel);

  const branchBadges = useMemo(() => {
    const map: Record<string, string[]> = {};
    Object.entries(branches).forEach(([branch, commitId]) => {
      if (!commitId) return;
      map[commitId] = [...(map[commitId] ?? []), branch];
    });
    return map;
  }, [branches]);

  const { nodes, edges } = useMemo(
    () => buildGraph(commits, headCommitId, branchBadges),
    [commits, headCommitId, branchBadges]
  );

  const headCommit = commits.find((commit) => commit.id === headCommitId) ?? null;

  return (
    <section className="flex h-[430px] flex-col gap-4 rounded-2xl border bg-card p-4 shadow-sm">
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
          onNodeClick={(_, node) => checkoutCommit(node.id)}
        >
          <Background gap={16} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      {headCommit ? (
        <div className="rounded-xl border bg-muted/40 p-4 text-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {headDetached ? "detached head" : `on branch ${currentBranch}`}
          </p>
          <p className="text-base font-semibold">{headCommit.message}</p>
          <p className="text-xs text-muted-foreground">
            {headLabel()} •{" "}
            {new Intl.DateTimeFormat("en", {
              hour: "2-digit",
              minute: "2-digit",
              month: "short",
              day: "numeric",
            }).format(headCommit.timestamp)}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
          No commits yet. Run `git commit` to populate the history.
        </div>
      )}
    </section>
  );
}

const nodeTypes = {
  commit: CommitNodeComponent,
};

function CommitNodeComponent({ data }: { data: GraphNodeData }) {
  return (
    <div
      className={`rounded-xl border bg-background px-3 py-2 text-xs shadow-md ${
        data.isHead ? "border-primary ring-1 ring-primary/40" : ""
      }`}
    >
      <p className="font-semibold text-foreground line-clamp-1">
        {data.commit.message}
      </p>
      <p className="text-muted-foreground">{data.commit.id}</p>
      {data.badges.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {data.badges.map((badge) => (
            <span
              key={badge}
              className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary"
            >
              {badge}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function buildGraph(
  commits: CommitNode[],
  headId: string | null,
  badgeMap: Record<string, string[]>
) {
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

  const nodes: Node<GraphNodeData>[] = commits.map((commit) => {
    const position = dagreGraph.node(commit.id);
    return {
      id: commit.id,
      type: "commit",
      data: {
        commit,
        badges: badgeMap[commit.id] ?? [],
        isHead: commit.id === headId,
      },
      position: {
        x: position.x - NODE_WIDTH / 2,
        y: position.y - NODE_HEIGHT / 2,
      },
    };
  });

  const edges: Edge[] = commits.flatMap((commit) =>
    commit.parents.map((parentId) => ({
      id: `${parentId}-${commit.id}`,
      source: parentId,
      target: commit.id,
      animated: commit.id === headId,
    }))
  );

  return { nodes, edges };
}
