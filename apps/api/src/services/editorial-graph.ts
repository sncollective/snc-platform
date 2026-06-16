import { ok, err } from "@snc/shared";
import type { Result } from "@snc/shared";
import { ValidationError } from "@snc/shared";

// ── Types ──

/**
 * A directed edge in the channel-as-source carry graph.
 * `channelId` carries `sourceChannelId` (i.e. channelId → sourceChannelId).
 */
export interface ChannelSourceEdge {
  readonly channelId: string;
  readonly sourceChannelId: string;
}

// ── Internals ──

/** DFS state for cycle detection. */
const enum VisitState {
  Unvisited = 0,
  InProgress = 1,
  Done = 2,
}

/**
 * Walk the carry graph from `node` via DFS, collecting the path for cycle
 * reporting. Returns the cycle path (array of channel IDs) if a cycle is
 * found starting from `node`, or null if no cycle exists in this subtree.
 */
const dfsVisit = (
  node: string,
  graph: Map<string, string[]>,
  state: Map<string, VisitState>,
  path: string[],
): string[] | null => {
  state.set(node, VisitState.InProgress);
  path.push(node);

  const neighbors = graph.get(node) ?? [];
  for (const neighbor of neighbors) {
    const neighborState = state.get(neighbor) ?? VisitState.Unvisited;

    if (neighborState === VisitState.InProgress) {
      // Cycle found — return the path from the cycle start
      const cycleStart = path.indexOf(neighbor);
      return [...path.slice(cycleStart), neighbor];
    }

    if (neighborState === VisitState.Unvisited) {
      const cyclePath = dfsVisit(neighbor, graph, state, path);
      if (cyclePath !== null) return cyclePath;
    }
  }

  path.pop();
  state.set(node, VisitState.Done);
  return null;
};

// ── Public API ──

/**
 * Detect cycles in the channel-as-source carry graph.
 *
 * Runs a DFS over the directed edge set (channelId → sourceChannelId) and
 * returns `err` naming the offending cycle path if one exists, or `ok(void)`
 * for a valid DAG. Self-loops (A → A) are caught as a cycle of length 1.
 *
 * Pure function — no DB or filesystem access. The caller is responsible for
 * passing the complete edge set representing the current (or proposed) graph
 * state. On config writes that add or modify channel-as-source edges, pass
 * the full proposed graph to detect cycles before persisting.
 *
 * @param edges - All channel-as-source edges in the graph (current or proposed).
 * @returns `ok(void)` for a valid DAG; `err(ValidationError)` naming the cycle path.
 */
export const detectChannelSourceCycles = (
  edges: readonly ChannelSourceEdge[],
): Result<void, ValidationError> => {
  // Build adjacency list: channelId → [sourceChannelId, ...]
  // (In practice each channelId has at most one sourceChannelId per tier, but
  // a channel may carry multiple other channels via multiple tiers.)
  const graph = new Map<string, string[]>();
  for (const { channelId, sourceChannelId } of edges) {
    const neighbors = graph.get(channelId) ?? [];
    neighbors.push(sourceChannelId);
    graph.set(channelId, neighbors);
    // Ensure all nodes are present even if they have no outgoing edges
    if (!graph.has(sourceChannelId)) {
      graph.set(sourceChannelId, []);
    }
  }

  const state = new Map<string, VisitState>();
  for (const node of graph.keys()) {
    if ((state.get(node) ?? VisitState.Unvisited) === VisitState.Unvisited) {
      const cyclePath = dfsVisit(node, graph, state, []);
      if (cyclePath !== null) {
        return err(
          new ValidationError(
            `Channel-as-source cycle detected: ${cyclePath.join(" → ")}`,
          ),
        );
      }
    }
  }

  return ok(undefined);
};
