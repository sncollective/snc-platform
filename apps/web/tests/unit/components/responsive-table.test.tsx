import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { ResponsiveTable } from "../../../src/components/ui/responsive-table.js";
import type { ResponsiveTableColumn } from "../../../src/components/ui/responsive-table.js";

// ── Fixtures ──

interface Row {
  id: string;
  name: string;
  status: string;
  secret: string;
}

const COLUMNS: readonly ResponsiveTableColumn<Row>[] = [
  {
    key: "name",
    header: "Name",
    cell: (row) => row.name,
    cardRole: "title",
  },
  {
    key: "status",
    header: "Status",
    cell: (row) => row.status,
  },
  {
    key: "secret",
    header: "Secret",
    cell: (row) => row.secret,
    cardRole: "hidden",
  },
];

const ROWS: readonly Row[] = [
  { id: "r1", name: "Alpha", status: "active", secret: "s1" },
  { id: "r2", name: "Beta", status: "inactive", secret: "s2" },
];

// ── Tests ──

describe("ResponsiveTable", () => {
  it("renders null when rows is empty", () => {
    const { container } = render(
      <ResponsiveTable
        columns={COLUMNS}
        rows={[]}
        rowKey={(row) => row.id}
        label="Items"
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders both table and card list in default mode", () => {
    render(
      <ResponsiveTable
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(row) => row.id}
        label="Items"
      />,
    );

    expect(screen.getByRole("table", { name: "Items" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Items" })).toBeInTheDocument();
  });

  it("renders no table when mode=cards", () => {
    render(
      <ResponsiveTable
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(row) => row.id}
        label="Items"
        mode="cards"
      />,
    );

    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByRole("list", { name: "Items" })).toBeInTheDocument();
  });

  it("applies tableAtMd class when tableAt=md", () => {
    const { container } = render(
      <ResponsiveTable
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(row) => row.id}
        label="Items"
        tableAt="md"
      />,
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toMatch(/tableAtMd/);
  });

  it("does not apply tableAtMd class when tableAt=sm (default)", () => {
    const { container } = render(
      <ResponsiveTable
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(row) => row.id}
        label="Items"
      />,
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).not.toMatch(/tableAtMd/);
  });

  it("applies cardsOnly class when mode=cards", () => {
    const { container } = render(
      <ResponsiveTable
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(row) => row.id}
        label="Items"
        mode="cards"
      />,
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toMatch(/cardsOnly/);
  });

  it("maps columns to th elements in the table header", () => {
    render(
      <ResponsiveTable
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(row) => row.id}
        label="Items"
      />,
    );

    const table = screen.getByRole("table", { name: "Items" });
    expect(within(table).getByRole("columnheader", { name: "Name" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Status" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Secret" })).toBeInTheDocument();
  });

  it("maps column cells to td elements for each row", () => {
    render(
      <ResponsiveTable
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(row) => row.id}
        label="Items"
      />,
    );

    const table = screen.getByRole("table", { name: "Items" });
    const cells = within(table).getAllByRole("cell");
    const cellTexts = cells.map((c) => c.textContent);

    expect(cellTexts).toContain("Alpha");
    expect(cellTexts).toContain("active");
    expect(cellTexts).toContain("s1");
    expect(cellTexts).toContain("Beta");
    expect(cellTexts).toContain("inactive");
  });

  it("renders cardRole=title as card title element", () => {
    render(
      <ResponsiveTable
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(row) => row.id}
        label="Items"
      />,
    );

    const list = screen.getByRole("list", { name: "Items" });
    const items = within(list).getAllByRole("group");
    const firstCard = items[0] as HTMLElement;

    // The "Name" column has cardRole: "title" — should render as cardTitle div
    // not as a cardField with a label
    expect(within(firstCard).getByText("Alpha")).toBeInTheDocument();
    // No "Name" label in the card (it's a title, not a field)
    expect(within(firstCard).queryByText("Name")).toBeNull();
  });

  it("renders cardRole=field (default) as labeled field with header as label", () => {
    render(
      <ResponsiveTable
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(row) => row.id}
        label="Items"
      />,
    );

    const list = screen.getByRole("list", { name: "Items" });
    const items = within(list).getAllByRole("group");
    const firstCard = items[0] as HTMLElement;

    // "Status" column has default cardRole (field) — should show "Status" label
    expect(within(firstCard).getByText("Status")).toBeInTheDocument();
    expect(within(firstCard).getByText("active")).toBeInTheDocument();
  });

  it("renders cardRole=hidden column in table but omits from card", () => {
    render(
      <ResponsiveTable
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(row) => row.id}
        label="Items"
      />,
    );

    // "Secret" column should appear in the table
    const table = screen.getByRole("table", { name: "Items" });
    expect(within(table).getByRole("columnheader", { name: "Secret" })).toBeInTheDocument();
    expect(within(table).getByText("s1")).toBeInTheDocument();

    // "Secret" column should NOT appear in the card list
    const list = screen.getByRole("list", { name: "Items" });
    const items = within(list).getAllByRole("group");
    const firstCard = items[0] as HTMLElement;
    expect(within(firstCard).queryByText("Secret")).toBeNull();
    expect(within(firstCard).queryByText("s1")).toBeNull();
  });

  it("uses cardLabel override instead of header when provided", () => {
    const columnsWithLabel: readonly ResponsiveTableColumn<Row>[] = [
      {
        key: "name",
        header: "Name",
        cell: (row) => row.name,
        cardRole: "field",
        cardLabel: "Full Name",
      },
    ];

    render(
      <ResponsiveTable
        columns={columnsWithLabel}
        rows={ROWS}
        rowKey={(row) => row.id}
        label="Items"
      />,
    );

    const list = screen.getByRole("list", { name: "Items" });
    const items = within(list).getAllByRole("group");
    const firstCard = items[0] as HTMLElement;

    // Should use cardLabel, not header
    expect(within(firstCard).getByText("Full Name")).toBeInTheDocument();
    expect(within(firstCard).queryByText("Name")).toBeNull();
  });

  it("renders actions in trailing table column with sr-only Actions header", () => {
    render(
      <ResponsiveTable
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(row) => row.id}
        label="Items"
        actions={(row) => <button type="button">Edit {row.name}</button>}
      />,
    );

    const table = screen.getByRole("table", { name: "Items" });

    // sr-only th — accessible name should still be "Actions"
    expect(
      within(table).getByRole("columnheader", { name: "Actions" }),
    ).toBeInTheDocument();

    // Action buttons appear in table cells
    expect(within(table).getByRole("button", { name: "Edit Alpha" })).toBeInTheDocument();
    expect(within(table).getByRole("button", { name: "Edit Beta" })).toBeInTheDocument();
  });

  it("renders actions in card footer", () => {
    render(
      <ResponsiveTable
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(row) => row.id}
        label="Items"
        actions={(row) => <button type="button">Edit {row.name}</button>}
      />,
    );

    const list = screen.getByRole("list", { name: "Items" });
    const items = within(list).getAllByRole("group");
    const firstCard = items[0] as HTMLElement;
    const secondCard = items[1] as HTMLElement;

    expect(within(firstCard).getByRole("button", { name: "Edit Alpha" })).toBeInTheDocument();
    expect(within(secondCard).getByRole("button", { name: "Edit Beta" })).toBeInTheDocument();
  });

  it("omits Actions column when actions prop is not provided", () => {
    render(
      <ResponsiveTable
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(row) => row.id}
        label="Items"
      />,
    );

    const table = screen.getByRole("table", { name: "Items" });
    expect(
      within(table).queryByRole("columnheader", { name: "Actions" }),
    ).toBeNull();
  });

  it("applies aria-label to both table and card list", () => {
    render(
      <ResponsiveTable
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(row) => row.id}
        label="My Label"
      />,
    );

    expect(screen.getByRole("table", { name: "My Label" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "My Label" })).toBeInTheDocument();
  });

  it("applies role=group to each card list item", () => {
    render(
      <ResponsiveTable
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(row) => row.id}
        label="Items"
      />,
    );

    const groups = screen.getAllByRole("group");
    expect(groups.length).toBe(ROWS.length);
  });

  it("applies cardAriaLabel to each card", () => {
    render(
      <ResponsiveTable
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(row) => row.id}
        label="Items"
        cardAriaLabel={(row) => `Row for ${row.name}`}
      />,
    );

    expect(screen.getByRole("group", { name: "Row for Alpha" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Row for Beta" })).toBeInTheDocument();
  });

  it("does not set aria-label on cards when cardAriaLabel is omitted", () => {
    render(
      <ResponsiveTable
        columns={COLUMNS}
        rows={ROWS}
        rowKey={(row) => row.id}
        label="Items"
      />,
    );

    const groups = screen.getAllByRole("group");
    for (const group of groups) {
      expect(group.getAttribute("aria-label")).toBeNull();
    }
  });
});
