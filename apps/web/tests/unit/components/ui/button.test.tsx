import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Button, BUTTON_VARIANTS, BUTTON_SIZES } from "../../../../src/components/ui/button.js";

describe("Button", () => {
  describe("variants", () => {
    it.each(BUTTON_VARIANTS)("renders %s variant with correct data attribute", (variant) => {
      render(<Button variant={variant}>Label</Button>);
      expect(screen.getByRole("button")).toHaveAttribute("data-variant", variant);
    });

    it("defaults to primary variant", () => {
      render(<Button>Label</Button>);
      expect(screen.getByRole("button")).toHaveAttribute("data-variant", "primary");
    });
  });

  describe("sizes", () => {
    it.each(BUTTON_SIZES)("renders %s size with correct data attribute", (size) => {
      render(<Button size={size}>Label</Button>);
      expect(screen.getByRole("button")).toHaveAttribute("data-size", size);
    });

    it("defaults to md size", () => {
      render(<Button>Label</Button>);
      expect(screen.getByRole("button")).toHaveAttribute("data-size", "md");
    });
  });

  describe("loading state", () => {
    it("sets aria-busy when loading", () => {
      render(<Button loading>Submit</Button>);
      expect(screen.getByRole("button")).toHaveAttribute("aria-busy", "true");
    });

    it("disables the button when loading", () => {
      render(<Button loading>Submit</Button>);
      expect(screen.getByRole("button")).toBeDisabled();
    });

    it("renders a spinner overlay when loading", () => {
      const { container } = render(<Button loading>Submit</Button>);
      // Spinner is aria-hidden (decorative — button's aria-busy carries the semantics)
      // Check for the SVG circle element as a proxy for spinner presence
      expect(container.querySelector("svg")).toBeInTheDocument();
    });

    it("keeps children in DOM while loading", () => {
      render(<Button loading>Submit</Button>);
      expect(screen.getByText("Submit")).toBeInTheDocument();
    });
  });

  describe("disabled state", () => {
    it("disables the button when disabled prop is set", () => {
      render(<Button disabled>Label</Button>);
      expect(screen.getByRole("button")).toBeDisabled();
    });

    it("does not fire onClick when disabled", async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(<Button disabled onClick={onClick}>Label</Button>);
      await user.click(screen.getByRole("button"));
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe("asChild", () => {
    it("renders child element instead of a button when asChild", () => {
      render(
        <Button asChild>
          <a href="/path">Go</a>
        </Button>,
      );
      expect(screen.queryByRole("button")).toBeNull();
      expect(screen.getByRole("link", { name: "Go" })).toBeInTheDocument();
    });

    it("merges className onto child element", () => {
      render(
        <Button asChild>
          <a href="/path">Go</a>
        </Button>,
      );
      const link = screen.getByRole("link");
      expect(link.className).toContain("button");
    });

    it("passes data-variant to child element", () => {
      render(
        <Button asChild variant="secondary">
          <a href="/path">Go</a>
        </Button>,
      );
      expect(screen.getByRole("link")).toHaveAttribute("data-variant", "secondary");
    });

    it("passes data-size to child element", () => {
      render(
        <Button asChild size="lg">
          <a href="/path">Go</a>
        </Button>,
      );
      expect(screen.getByRole("link")).toHaveAttribute("data-size", "lg");
    });
  });

  describe("a11y", () => {
    it("renders as button type=button by default", () => {
      render(<Button>Label</Button>);
      expect(screen.getByRole("button")).toHaveAttribute("type", "button");
    });

    it("accepts type=submit override", () => {
      render(<Button type="submit">Submit</Button>);
      expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
    });
  });
});
