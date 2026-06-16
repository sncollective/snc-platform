import { describe, it, expect } from "vitest";

import { detectChannelSourceCycles } from "../../src/services/editorial-graph.js";
import type { ChannelSourceEdge } from "../../src/services/editorial-graph.js";

// ── Helpers ──

const edge = (channelId: string, sourceChannelId: string): ChannelSourceEdge => ({
  channelId,
  sourceChannelId,
});

// ── Tests ──

describe("detectChannelSourceCycles", () => {
  // ── Valid DAGs ──

  it("accepts an empty edge set", () => {
    const result = detectChannelSourceCycles([]);
    expect(result.ok).toBe(true);
  });

  it("accepts a single edge (A → B, no cycle)", () => {
    const result = detectChannelSourceCycles([edge("A", "B")]);
    expect(result.ok).toBe(true);
  });

  it("accepts a linear chain (A → B → C)", () => {
    const result = detectChannelSourceCycles([edge("A", "B"), edge("B", "C")]);
    expect(result.ok).toBe(true);
  });

  it("accepts a diamond DAG (A → B, A → C, B → D, C → D)", () => {
    const result = detectChannelSourceCycles([
      edge("A", "B"),
      edge("A", "C"),
      edge("B", "D"),
      edge("C", "D"),
    ]);
    expect(result.ok).toBe(true);
  });

  it("accepts multiple disconnected edges with no cycles", () => {
    const result = detectChannelSourceCycles([
      edge("A", "B"),
      edge("C", "D"),
      edge("E", "F"),
    ]);
    expect(result.ok).toBe(true);
  });

  // ── Self-loop ──

  it("rejects a self-loop (A → A)", () => {
    const result = detectChannelSourceCycles([edge("A", "A")]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("A");
      expect(result.error.message).toContain("cycle");
    }
  });

  // ── 2-cycles ──

  it("rejects a 2-cycle (A → B → A)", () => {
    const result = detectChannelSourceCycles([edge("A", "B"), edge("B", "A")]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("cycle");
      // Both A and B should appear in the cycle path
      expect(result.error.message).toContain("A");
      expect(result.error.message).toContain("B");
    }
  });

  it("returns the offending path for a 2-cycle", () => {
    const result = detectChannelSourceCycles([edge("X", "Y"), edge("Y", "X")]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // The path should name both nodes and be formatted as a chain
      expect(result.error.message).toMatch(/X.*Y|Y.*X/);
    }
  });

  // ── 3-cycles ──

  it("rejects a 3-cycle (A → B → C → A)", () => {
    const result = detectChannelSourceCycles([
      edge("A", "B"),
      edge("B", "C"),
      edge("C", "A"),
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("cycle");
      expect(result.error.message).toContain("A");
      expect(result.error.message).toContain("B");
      expect(result.error.message).toContain("C");
    }
  });

  it("rejects a 3-cycle with a valid subtree attached (A → B → C → A, D → A)", () => {
    const result = detectChannelSourceCycles([
      edge("A", "B"),
      edge("B", "C"),
      edge("C", "A"),
      edge("D", "A"), // valid edge into the cycle
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("cycle");
    }
  });

  // ── Returned path ──

  it("names the offending node path in the error message (self-loop)", () => {
    const result = detectChannelSourceCycles([edge("snctv", "snctv")]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("snctv");
    }
  });

  it("names all nodes in a 3-cycle path", () => {
    const result = detectChannelSourceCycles([
      edge("chan-1", "chan-2"),
      edge("chan-2", "chan-3"),
      edge("chan-3", "chan-1"),
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("chan-1");
      expect(result.error.message).toContain("chan-2");
      expect(result.error.message).toContain("chan-3");
    }
  });

  // ── ValidationError type ──

  it("returns a ValidationError with code VALIDATION_ERROR", () => {
    const result = detectChannelSourceCycles([edge("A", "A")]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.statusCode).toBe(400);
    }
  });
});
