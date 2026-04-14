import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { FormField, FieldInput } from "../../../../src/components/ui/field.js";

describe("FormField", () => {
  it("renders the label text", () => {
    render(
      <FormField label="Email" htmlFor="email">
        <FieldInput id="email" />
      </FormField>,
    );
    expect(screen.getByText("Email")).toBeInTheDocument();
  });

  it("renders the child input", () => {
    render(
      <FormField label="Email" htmlFor="email">
        <FieldInput id="email" />
      </FormField>,
    );
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("renders hint text when hint prop is provided", () => {
    render(
      <FormField label="Email" htmlFor="email" hint="We never share this.">
        <FieldInput id="email" />
      </FormField>,
    );
    expect(screen.getByText("We never share this.")).toBeInTheDocument();
  });

  it("does not render hint when not provided", () => {
    render(
      <FormField label="Email" htmlFor="email">
        <FieldInput id="email" />
      </FormField>,
    );
    expect(screen.queryByText(/never share/)).toBeNull();
  });

  it("renders error text when error prop is provided", () => {
    render(
      <FormField label="Email" htmlFor="email" error="Invalid email">
        <FieldInput id="email" />
      </FormField>,
    );
    expect(screen.getByText("Invalid email")).toBeInTheDocument();
  });

  it("does not render error text when error is not provided", () => {
    render(
      <FormField label="Email" htmlFor="email">
        <FieldInput id="email" />
      </FormField>,
    );
    expect(screen.queryByText(/invalid/i)).toBeNull();
  });

  it("renders required indicator when required prop is true", () => {
    render(
      <FormField label="Email" htmlFor="email" required>
        <FieldInput id="email" />
      </FormField>,
    );
    // The required indicator asterisk should be visible
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("does not render required indicator when required is false", () => {
    render(
      <FormField label="Email" htmlFor="email">
        <FieldInput id="email" />
      </FormField>,
    );
    expect(screen.queryByText("*")).toBeNull();
  });

  describe("aria wiring (via Ark UI Field context)", () => {
    it("marks input aria-invalid when error is provided", () => {
      render(
        <FormField label="Email" htmlFor="email" error="Required">
          <FieldInput id="email" />
        </FormField>,
      );
      expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
    });

    it("marks input as required (via native required attribute) when required is true", () => {
      render(
        <FormField label="Email" htmlFor="email" required>
          <FieldInput id="email" />
        </FormField>,
      );
      // Ark UI propagates required as the native HTML attribute, not aria-required
      expect(screen.getByRole("textbox")).toBeRequired();
    });

    it("links label to input via htmlFor / id", () => {
      render(
        <FormField label="Email" htmlFor="email">
          <FieldInput />
        </FormField>,
      );
      // getByLabelText verifies the label's for attribute is wired to the input's id
      // Ark UI derives both from the FieldRoot's id prop
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    });

    it("links input to helper text via aria-describedby when hint is present", () => {
      render(
        <FormField label="Email" htmlFor="email" hint="We never share this.">
          <FieldInput id="email" />
        </FormField>,
      );
      const input = screen.getByRole("textbox");
      const describedBy = input.getAttribute("aria-describedby");
      expect(describedBy).toBeTruthy();
      // The described element should contain the hint text
      const hintEl = document.getElementById(describedBy!.split(" ")[0]!);
      // aria-describedby may reference multiple ids; check any contains the hint
      const ids = describedBy!.split(" ");
      const hintFound = ids.some((id) => {
        const el = document.getElementById(id);
        return el?.textContent?.includes("We never share this.");
      });
      expect(hintFound).toBe(true);
    });
  });
});
