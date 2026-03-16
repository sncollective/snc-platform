import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { makeMockCreatorProfileResponse } from "../../helpers/creator-fixtures.js";

// ── Hoisted Mocks ──

const { mockCreateCreatorEntity } = vi.hoisted(() => ({
  mockCreateCreatorEntity: vi.fn(),
}));

vi.mock("../../../src/lib/creator.js", () => ({
  createCreatorEntity: mockCreateCreatorEntity,
}));

// ── Component Under Test ──

import { CreateCreatorForm } from "../../../src/components/creator/create-creator-form.js";

// ── Lifecycle ──

beforeEach(() => {
  mockCreateCreatorEntity.mockResolvedValue(makeMockCreatorProfileResponse());
});

// ── Tests ──

describe("CreateCreatorForm", () => {
  it("renders form with displayName and handle inputs", () => {
    render(<CreateCreatorForm onCreated={vi.fn()} />);

    expect(screen.getByLabelText("Display Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Handle (optional)")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create Creator" }),
    ).toBeInTheDocument();
  });

  it("shows validation error when displayName is empty", async () => {
    const user = userEvent.setup();
    render(<CreateCreatorForm onCreated={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Create Creator" }));

    await waitFor(() => {
      expect(screen.getByText("Display name is required")).toBeInTheDocument();
    });
    expect(mockCreateCreatorEntity).not.toHaveBeenCalled();
  });

  it("calls createCreatorEntity on valid submit", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    render(<CreateCreatorForm onCreated={onCreated} />);

    await user.type(screen.getByLabelText("Display Name"), "My Band");
    await user.click(screen.getByRole("button", { name: "Create Creator" }));

    await waitFor(() => {
      expect(mockCreateCreatorEntity).toHaveBeenCalledWith({
        displayName: "My Band",
      });
    });
  });

  it("passes handle when provided", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    render(<CreateCreatorForm onCreated={onCreated} />);

    await user.type(screen.getByLabelText("Display Name"), "My Band");
    await user.type(screen.getByLabelText("Handle (optional)"), "my-band");
    await user.click(screen.getByRole("button", { name: "Create Creator" }));

    await waitFor(() => {
      expect(mockCreateCreatorEntity).toHaveBeenCalledWith({
        displayName: "My Band",
        handle: "my-band",
      });
    });
  });

  it("calls onCreated callback on success", async () => {
    const user = userEvent.setup();
    const profile = makeMockCreatorProfileResponse({ displayName: "My Band" });
    mockCreateCreatorEntity.mockResolvedValue(profile);
    const onCreated = vi.fn();
    render(<CreateCreatorForm onCreated={onCreated} />);

    await user.type(screen.getByLabelText("Display Name"), "My Band");
    await user.click(screen.getByRole("button", { name: "Create Creator" }));

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith(profile);
    });
  });

  it("shows server error on API failure", async () => {
    const user = userEvent.setup();
    mockCreateCreatorEntity.mockRejectedValue(new Error("Handle taken"));
    render(<CreateCreatorForm onCreated={vi.fn()} />);

    await user.type(screen.getByLabelText("Display Name"), "My Band");
    await user.click(screen.getByRole("button", { name: "Create Creator" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Handle taken");
    });
  });

  it("disables submit while submitting", async () => {
    const user = userEvent.setup();
    mockCreateCreatorEntity.mockReturnValue(new Promise(() => {}));
    render(<CreateCreatorForm onCreated={vi.fn()} />);

    await user.type(screen.getByLabelText("Display Name"), "My Band");
    await user.click(screen.getByRole("button", { name: "Create Creator" }));

    expect(
      screen.getByRole("button", { name: "Creating\u2026" }),
    ).toBeDisabled();
  });

  it("shows validation error for invalid handle format", async () => {
    const user = userEvent.setup();
    mockCreateCreatorEntity.mockClear();
    render(<CreateCreatorForm onCreated={vi.fn()} />);

    await user.type(screen.getByLabelText("Display Name"), "My Band");
    await user.type(screen.getByLabelText("Handle (optional)"), "AB");
    await user.click(screen.getByRole("button", { name: "Create Creator" }));

    await waitFor(() => {
      expect(
        screen.getByText(/Handle must be 3/),
      ).toBeInTheDocument();
    });
    expect(mockCreateCreatorEntity).not.toHaveBeenCalled();
  });
});
