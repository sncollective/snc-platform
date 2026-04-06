import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { Heading } from "../../../../src/components/ui/heading.js";

describe("Heading", () => {
  describe("level rendering", () => {
    it.each([1, 2, 3, 4, 5, 6] as const)("renders h%s element for level=%s", (level) => {
      render(<Heading level={level}>Title</Heading>);
      expect(screen.getByRole("heading", { level })).toBeInTheDocument();
    });
  });

  describe("default size per level", () => {
    it("h1 defaults to 3xl size", () => {
      render(<Heading level={1}>Title</Heading>);
      expect(screen.getByRole("heading")).toHaveAttribute("data-size", "3xl");
    });

    it("h2 defaults to 2xl size", () => {
      render(<Heading level={2}>Title</Heading>);
      expect(screen.getByRole("heading")).toHaveAttribute("data-size", "2xl");
    });

    it("h3 defaults to xl size", () => {
      render(<Heading level={3}>Title</Heading>);
      expect(screen.getByRole("heading")).toHaveAttribute("data-size", "xl");
    });

    it("h4 defaults to lg size", () => {
      render(<Heading level={4}>Title</Heading>);
      expect(screen.getByRole("heading")).toHaveAttribute("data-size", "lg");
    });

    it("h5 defaults to md size", () => {
      render(<Heading level={5}>Title</Heading>);
      expect(screen.getByRole("heading")).toHaveAttribute("data-size", "md");
    });

    it("h6 defaults to sm size", () => {
      render(<Heading level={6}>Title</Heading>);
      expect(screen.getByRole("heading")).toHaveAttribute("data-size", "sm");
    });
  });

  describe("custom size override", () => {
    it("applies custom size when provided, overriding level default", () => {
      render(<Heading level={1} size="sm">Small Heading</Heading>);
      expect(screen.getByRole("heading")).toHaveAttribute("data-size", "sm");
    });

    it("renders h3 with xl size when overridden", () => {
      render(<Heading level={3} size="2xl">Big Sub</Heading>);
      expect(screen.getByRole("heading", { level: 3 })).toHaveAttribute("data-size", "2xl");
    });
  });

  describe("className passthrough", () => {
    it("merges custom className with heading class", () => {
      render(<Heading level={2} className="custom">Title</Heading>);
      const el = screen.getByRole("heading");
      expect(el.className).toContain("heading");
      expect(el.className).toContain("custom");
    });
  });
});
