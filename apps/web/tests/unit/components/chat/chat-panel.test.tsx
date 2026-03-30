import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// jsdom does not implement scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn();

// Mock chat context
const { mockUseChat } = vi.hoisted(() => ({
  mockUseChat: vi.fn(),
}));

vi.mock("../../../../src/contexts/chat-context.js", () => ({
  useChat: mockUseChat,
}));

vi.mock("../../../../src/lib/fetch-utils.js", () => ({
  apiGet: vi.fn().mockResolvedValue({ rooms: [] }),
}));

import { ChatPanel } from "../../../../src/components/chat/chat-panel.js";

const DEFAULT_CHAT_STATE = {
  rooms: [],
  activeRoomId: null,
  messages: [],
  hasMore: false,
  isConnected: true,
};

const DEFAULT_CHAT_ACTIONS = {
  joinRoom: vi.fn(),
  leaveRoom: vi.fn(),
  sendMessage: vi.fn(),
  setActiveRoom: vi.fn(),
  setRooms: vi.fn(),
};

beforeEach(() => {
  mockUseChat.mockReturnValue({
    state: DEFAULT_CHAT_STATE,
    actions: DEFAULT_CHAT_ACTIONS,
  });
});

describe("ChatPanel collapse button", () => {
  it("does not render collapse button when onCollapse is omitted", () => {
    render(<ChatPanel />);
    expect(screen.queryByLabelText("Collapse chat")).toBeNull();
  });

  it("renders collapse button when onCollapse is provided", () => {
    render(<ChatPanel onCollapse={vi.fn()} />);
    expect(screen.getByLabelText("Collapse chat")).toBeInTheDocument();
  });

  it("calls onCollapse when collapse button is clicked", async () => {
    const user = userEvent.setup();
    const onCollapse = vi.fn();
    render(<ChatPanel onCollapse={onCollapse} />);

    await user.click(screen.getByLabelText("Collapse chat"));

    expect(onCollapse).toHaveBeenCalledOnce();
  });
});
