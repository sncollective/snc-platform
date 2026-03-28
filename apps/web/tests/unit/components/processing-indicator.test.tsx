import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { ProcessingIndicator } from "../../../src/components/content/processing-indicator.js";

// ── Tests ──

describe("ProcessingIndicator", () => {
  it("shows 'Processing media...' for processing status", () => {
    render(<ProcessingIndicator status="processing" />);
    expect(screen.getByText("Processing media...")).toBeInTheDocument();
  });

  it("shows 'Preparing...' for uploaded status", () => {
    render(<ProcessingIndicator status="uploaded" />);
    expect(screen.getByText("Preparing...")).toBeInTheDocument();
  });

  it("returns null for ready status", () => {
    const { container } = render(<ProcessingIndicator status="ready" />);
    expect(container.firstChild).toBeNull();
  });

  it("returns null for null status", () => {
    const { container } = render(<ProcessingIndicator status={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows 'Processing failed' for failed status", () => {
    render(<ProcessingIndicator status="failed" />);
    expect(screen.getByText("Processing failed")).toBeInTheDocument();
  });
});
