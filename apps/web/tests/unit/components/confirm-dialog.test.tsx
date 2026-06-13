import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ConfirmDialog } from "../../../src/components/ui/confirm-dialog.js";

// ── Helpers ──

function renderDialog(overrides: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
  const props = {
    open: true,
    title: "Delete item?",
    children: "This action cannot be undone.",
    confirmLabel: "Delete item",
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
  return { ...render(<ConfirmDialog {...props} />), props };
}

// ── Tests ──

describe("ConfirmDialog", () => {
  describe("rendering", () => {
    it("renders the title", () => {
      renderDialog({ title: "Remove account?" });
      expect(screen.getByText("Remove account?")).toBeInTheDocument();
    });

    it("renders children as the consequence message", () => {
      renderDialog({ children: "Your data will be permanently deleted." });
      expect(screen.getByText("Your data will be permanently deleted.")).toBeInTheDocument();
    });

    it("renders the confirm button with given label", () => {
      renderDialog({ confirmLabel: "Remove account" });
      expect(screen.getByRole("button", { name: "Remove account" })).toBeInTheDocument();
    });

    it("renders the cancel button with given label", () => {
      renderDialog({ cancelLabel: "No, keep it" });
      expect(screen.getByRole("button", { name: "No, keep it" })).toBeInTheDocument();
    });

    it("renders cancel button with default label when cancelLabel is omitted", () => {
      renderDialog();
      expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    });

    it("renders nothing when open is false", () => {
      renderDialog({ open: false });
      // lazyMount + unmountOnExit — content not in DOM
      expect(screen.queryByRole("alertdialog")).toBeNull();
    });
  });

  describe("tone → button variant", () => {
    it("danger tone (default) → confirm has data-variant=danger", () => {
      renderDialog();
      const confirm = screen.getByRole("button", { name: "Delete item" });
      expect(confirm).toHaveAttribute("data-variant", "danger");
    });

    it("danger tone explicit → confirm has data-variant=danger", () => {
      renderDialog({ tone: "danger" });
      const confirm = screen.getByRole("button", { name: "Delete item" });
      expect(confirm).toHaveAttribute("data-variant", "danger");
    });

    it("default tone → confirm has data-variant=primary", () => {
      renderDialog({ tone: "default" });
      const confirm = screen.getByRole("button", { name: "Delete item" });
      expect(confirm).toHaveAttribute("data-variant", "primary");
    });

    it("cancel button always has data-variant=secondary", () => {
      renderDialog({ tone: "danger" });
      const cancel = screen.getByRole("button", { name: "Cancel" });
      expect(cancel).toHaveAttribute("data-variant", "secondary");
    });

    it("cancel button has data-variant=secondary with default tone", () => {
      renderDialog({ tone: "default" });
      const cancel = screen.getByRole("button", { name: "Cancel" });
      expect(cancel).toHaveAttribute("data-variant", "secondary");
    });
  });

  describe("interactions", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("confirm click fires onConfirm exactly once", async () => {
      const user = userEvent.setup();
      const { props } = renderDialog();

      await user.click(screen.getByRole("button", { name: "Delete item" }));

      expect(props.onConfirm).toHaveBeenCalledOnce();
    });

    it("confirm click does NOT fire onCancel", async () => {
      const user = userEvent.setup();
      const { props } = renderDialog();

      await user.click(screen.getByRole("button", { name: "Delete item" }));

      expect(props.onCancel).not.toHaveBeenCalled();
    });

    it("cancel click fires onCancel", async () => {
      const user = userEvent.setup();
      const { props } = renderDialog();

      await user.click(screen.getByRole("button", { name: "Cancel" }));

      expect(props.onCancel).toHaveBeenCalled();
    });
  });

  describe("isPending", () => {
    it("disables the confirm button when isPending is true", () => {
      renderDialog({ isPending: true });
      expect(screen.getByRole("button", { name: "Delete item" })).toBeDisabled();
    });

    it("disables the cancel button when isPending is true", () => {
      renderDialog({ isPending: true });
      expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    });

    it("does not disable buttons when isPending is false", () => {
      renderDialog({ isPending: false });
      expect(screen.getByRole("button", { name: "Delete item" })).not.toBeDisabled();
      expect(screen.getByRole("button", { name: "Cancel" })).not.toBeDisabled();
    });
  });

  describe("accessibility", () => {
    it("dialog content has role=alertdialog", () => {
      renderDialog();
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    });
  });
});
