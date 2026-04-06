import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
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

  it("pressing Escape closes picker — trigger no longer expanded", async () => {
    const user = userEvent.setup();
    render(<ReactionPicker {...defaultProps} />);

    // Open the picker
    await user.click(screen.getByLabelText("Add reaction"));
    const trigger = screen.getByLabelText("Add reaction");
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "true"));

    // Ark Popover closes on Escape key
    await user.keyboard("{Escape}");
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));
  });

  it("clicking an emoji calls onReact and closes picker", async () => {
    const user = userEvent.setup();
    const onReact = vi.fn();
    render(<ReactionPicker {...defaultProps} onReact={onReact} />);

    const trigger = screen.getByLabelText("Add reaction");
    await user.click(trigger);
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "true"));
    await user.click(screen.getByLabelText("👍"));

    expect(onReact).toHaveBeenCalledWith("👍");
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));
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

    const trigger = screen.getByLabelText("Add reaction");
    await user.click(thumbsUpBtn);

    expect(onUnreact).toHaveBeenCalledWith("👍");
    await waitFor(() => expect(trigger).toHaveAttribute("aria-expanded", "false"));
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
