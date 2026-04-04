import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ReactionPicker } from "../../../../src/components/chat/reaction-picker.js";
import type { MessageReaction } from "@snc/shared";

// ── Helpers ──

const makeExistingReactions = (overrides: Partial<MessageReaction>[] = []): MessageReaction[] =>
  overrides.map((o) => ({
    emoji: "👍" as const,
    count: 1,
    reactedByMe: false,
    ...o,
  }));

// ── Tests ──

describe("ReactionPicker", () => {
  const defaultProps = {
    messageId: "msg-1",
    existingReactions: [] as MessageReaction[],
    onReact: vi.fn(),
    onUnreact: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('"+" button opens picker on click — panel visible after click', async () => {
    const user = userEvent.setup();
    render(<ReactionPicker {...defaultProps} />);

    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(screen.getByLabelText("Add reaction"));

    expect(screen.getByRole("dialog", { name: "Reaction picker" })).toBeInTheDocument();
  });

  it("clicking outside closes picker — panel removed", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <ReactionPicker {...defaultProps} />
      </div>,
    );

    // Open the picker
    await user.click(screen.getByLabelText("Add reaction"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Click outside
    await user.click(screen.getByTestId("outside"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("clicking an emoji calls onReact and closes picker", async () => {
    const user = userEvent.setup();
    const onReact = vi.fn();
    render(<ReactionPicker {...defaultProps} onReact={onReact} />);

    await user.click(screen.getByLabelText("Add reaction"));
    await user.click(screen.getByLabelText("👍"));

    expect(onReact).toHaveBeenCalledWith("👍");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("already-reacted emoji shown as active in picker — calls onUnreact", async () => {
    const user = userEvent.setup();
    const onUnreact = vi.fn();
    const existingReactions = makeExistingReactions([
      { emoji: "👍" as const, count: 1, reactedByMe: true },
    ]);
    render(
      <ReactionPicker
        {...defaultProps}
        existingReactions={existingReactions}
        onUnreact={onUnreact}
      />,
    );

    await user.click(screen.getByLabelText("Add reaction"));

    // The thumbs up emoji should be aria-pressed=true
    const thumbsUpBtn = screen.getByLabelText("👍");
    expect(thumbsUpBtn).toHaveAttribute("aria-pressed", "true");

    await user.click(thumbsUpBtn);

    expect(onUnreact).toHaveBeenCalledWith("👍");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders all 6 supported emojis in picker", async () => {
    const user = userEvent.setup();
    render(<ReactionPicker {...defaultProps} />);

    await user.click(screen.getByLabelText("Add reaction"));

    const emojis = ["👍", "❤️", "😂", "😮", "😢", "🔥"];
    for (const emoji of emojis) {
      expect(screen.getByLabelText(emoji)).toBeInTheDocument();
    }
  });
});
