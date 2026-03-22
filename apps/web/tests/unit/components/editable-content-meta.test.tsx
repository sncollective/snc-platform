import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ── Hoisted Mocks ──

const { mockFormatDate } = vi.hoisted(() => ({
  mockFormatDate: vi.fn(),
}));

vi.mock("../../../src/lib/format.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/lib/format.js")>();
  return { ...actual, formatDate: mockFormatDate };
});

// ── Component Under Test ──

import { EditableContentMeta } from "../../../src/components/content/editable-content-meta.js";

// ── Lifecycle ──

beforeEach(() => {
  mockFormatDate.mockReturnValue("Jan 1, 2026");
});

// ── Tests ──

describe("EditableContentMeta", () => {
  const baseProps = {
    title: "My Content Title",
    creatorName: "Test Creator",
    publishedAt: "2026-01-01T00:00:00.000Z",
    description: "A test description",
    visibility: "public" as const,
    isEditing: false,
    onTitleChange: vi.fn(),
    onDescriptionChange: vi.fn(),
    onVisibilityChange: vi.fn(),
  };

  describe("non-edit mode", () => {
    it("renders title as static text", () => {
      render(<EditableContentMeta {...baseProps} />);
      expect(screen.getByText("My Content Title")).toBeInTheDocument();
      expect(screen.queryByRole("textbox", { name: "Title" })).toBeNull();
    });

    it("renders creator name", () => {
      render(<EditableContentMeta {...baseProps} />);
      expect(screen.getByText("Test Creator")).toBeInTheDocument();
    });

    it("renders formatted date when publishedAt is present", () => {
      render(<EditableContentMeta {...baseProps} />);
      expect(screen.getByText("Jan 1, 2026")).toBeInTheDocument();
    });

    it("renders description as static text", () => {
      render(<EditableContentMeta {...baseProps} />);
      expect(screen.getByText("A test description")).toBeInTheDocument();
    });

    it("does not render description when it is null", () => {
      render(<EditableContentMeta {...baseProps} description={null} />);
      expect(screen.queryByText("A test description")).toBeNull();
    });

    it("does not render date when publishedAt is null", () => {
      render(<EditableContentMeta {...baseProps} publishedAt={null} />);
      expect(screen.queryByText("Jan 1, 2026")).toBeNull();
    });
  });

  describe("edit mode", () => {
    it("renders title as input", () => {
      render(<EditableContentMeta {...baseProps} isEditing={true} />);
      expect(screen.getByRole("textbox", { name: "Title" })).toBeInTheDocument();
    });

    it("title input has correct value", () => {
      render(<EditableContentMeta {...baseProps} isEditing={true} />);
      expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue("My Content Title");
    });

    it("renders description as textarea", () => {
      render(<EditableContentMeta {...baseProps} isEditing={true} />);
      expect(screen.getByRole("textbox", { name: "Description" })).toBeInTheDocument();
    });

    it("description textarea has correct value", () => {
      render(<EditableContentMeta {...baseProps} isEditing={true} />);
      expect(screen.getByRole("textbox", { name: "Description" })).toHaveValue("A test description");
    });

    it("description textarea is empty when description is null", () => {
      render(<EditableContentMeta {...baseProps} isEditing={true} description={null} />);
      expect(screen.getByRole("textbox", { name: "Description" })).toHaveValue("");
    });

    it("renders visibility as select", () => {
      render(<EditableContentMeta {...baseProps} isEditing={true} />);
      expect(screen.getByRole("combobox", { name: "Visibility" })).toBeInTheDocument();
    });

    it("visibility select has correct value", () => {
      render(<EditableContentMeta {...baseProps} isEditing={true} visibility="subscribers" />);
      expect(screen.getByRole("combobox", { name: "Visibility" })).toHaveValue("subscribers");
    });

    it("title input change fires onTitleChange callback", () => {
      const onTitleChange = vi.fn();
      render(<EditableContentMeta {...baseProps} isEditing={true} onTitleChange={onTitleChange} />);
      fireEvent.change(screen.getByRole("textbox", { name: "Title" }), {
        target: { value: "New Title" },
      });
      expect(onTitleChange).toHaveBeenCalledWith("New Title");
    });

    it("description textarea change fires onDescriptionChange callback", () => {
      const onDescriptionChange = vi.fn();
      render(<EditableContentMeta {...baseProps} isEditing={true} onDescriptionChange={onDescriptionChange} />);
      fireEvent.change(screen.getByRole("textbox", { name: "Description" }), {
        target: { value: "New description" },
      });
      expect(onDescriptionChange).toHaveBeenCalledWith("New description");
    });

    it("visibility select change fires onVisibilityChange callback", () => {
      const onVisibilityChange = vi.fn();
      render(<EditableContentMeta {...baseProps} isEditing={true} onVisibilityChange={onVisibilityChange} />);
      fireEvent.change(screen.getByRole("combobox", { name: "Visibility" }), {
        target: { value: "subscribers" },
      });
      expect(onVisibilityChange).toHaveBeenCalledWith("subscribers");
    });

    it("does not render a static title heading in edit mode", () => {
      render(<EditableContentMeta {...baseProps} isEditing={true} />);
      expect(screen.queryByRole("heading")).toBeNull();
    });

    it("renders visible Title label in edit mode", () => {
      render(<EditableContentMeta {...baseProps} isEditing={true} />);
      expect(screen.getByText("Title")).toBeInTheDocument();
    });

    it("renders visible Description label in edit mode", () => {
      render(<EditableContentMeta {...baseProps} isEditing={true} />);
      expect(screen.getByText("Description")).toBeInTheDocument();
    });

    it("renders visible Visibility label in edit mode", () => {
      render(<EditableContentMeta {...baseProps} isEditing={true} />);
      expect(screen.getByText("Visibility")).toBeInTheDocument();
    });
  });
});
