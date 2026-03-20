import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../../../../src/components/calendar/time-picker-select.module.css", () => ({
  default: {
    container: "container",
    separator: "separator",
  },
}));

vi.mock("../../../../src/styles/form.module.css", () => ({
  default: {
    select: "select",
  },
}));

import { TimePickerSelect } from "../../../../src/components/calendar/time-picker-select.js";

// ── Tests ──

describe("TimePickerSelect", () => {
  it("renders three selects: hour, minute, period", () => {
    render(<TimePickerSelect value="14:30" onChange={vi.fn()} />);

    expect(screen.getByRole("combobox", { name: "Hour" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Minute" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "AM or PM" })).toBeInTheDocument();
  });

  it('value="14:30" renders as hour=2, minute=30, period=PM', () => {
    render(<TimePickerSelect value="14:30" onChange={vi.fn()} />);

    const hourSelect = screen.getByRole("combobox", { name: "Hour" }) as HTMLSelectElement;
    const minuteSelect = screen.getByRole("combobox", { name: "Minute" }) as HTMLSelectElement;
    const periodSelect = screen.getByRole("combobox", { name: "AM or PM" }) as HTMLSelectElement;

    expect(hourSelect.value).toBe("2");
    expect(minuteSelect.value).toBe("30");
    expect(periodSelect.value).toBe("PM");
  });

  it('value="00:00" renders as hour=12, minute=00, period=AM', () => {
    render(<TimePickerSelect value="00:00" onChange={vi.fn()} />);

    const hourSelect = screen.getByRole("combobox", { name: "Hour" }) as HTMLSelectElement;
    const minuteSelect = screen.getByRole("combobox", { name: "Minute" }) as HTMLSelectElement;
    const periodSelect = screen.getByRole("combobox", { name: "AM or PM" }) as HTMLSelectElement;

    expect(hourSelect.value).toBe("12");
    expect(minuteSelect.value).toBe("00");
    expect(periodSelect.value).toBe("AM");
  });

  it('value="12:00" renders as hour=12, minute=00, period=PM', () => {
    render(<TimePickerSelect value="12:00" onChange={vi.fn()} />);

    const hourSelect = screen.getByRole("combobox", { name: "Hour" }) as HTMLSelectElement;
    const minuteSelect = screen.getByRole("combobox", { name: "Minute" }) as HTMLSelectElement;
    const periodSelect = screen.getByRole("combobox", { name: "AM or PM" }) as HTMLSelectElement;

    expect(hourSelect.value).toBe("12");
    expect(minuteSelect.value).toBe("00");
    expect(periodSelect.value).toBe("PM");
  });

  it("empty value defaults to 12:00 AM display", () => {
    render(<TimePickerSelect value="" onChange={vi.fn()} />);

    const hourSelect = screen.getByRole("combobox", { name: "Hour" }) as HTMLSelectElement;
    const minuteSelect = screen.getByRole("combobox", { name: "Minute" }) as HTMLSelectElement;
    const periodSelect = screen.getByRole("combobox", { name: "AM or PM" }) as HTMLSelectElement;

    expect(hourSelect.value).toBe("12");
    expect(minuteSelect.value).toBe("00");
    expect(periodSelect.value).toBe("AM");
  });

  it("changing hour calls onChange with correct 24h value (PM context)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TimePickerSelect value="14:30" onChange={onChange} />);

    // Currently 2:30 PM — change hour from 2 to 3
    await user.selectOptions(screen.getByRole("combobox", { name: "Hour" }), "3");

    expect(onChange).toHaveBeenCalledWith("15:30");
  });

  it("changing period from PM to AM calls onChange with correct 24h value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TimePickerSelect value="14:30" onChange={onChange} />);

    // Currently 2:30 PM — change period to AM
    await user.selectOptions(screen.getByRole("combobox", { name: "AM or PM" }), "AM");

    expect(onChange).toHaveBeenCalledWith("02:30");
  });

  it("changing minute calls onChange with correct 24h value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TimePickerSelect value="14:30" onChange={onChange} />);

    // Currently 2:30 PM — change minute to 45
    await user.selectOptions(screen.getByRole("combobox", { name: "Minute" }), "45");

    expect(onChange).toHaveBeenCalledWith("14:45");
  });

  it("sets id attributes on selects when id prop is provided", () => {
    render(<TimePickerSelect value="10:00" onChange={vi.fn()} id="event-start-time" />);

    expect(document.getElementById("event-start-time-hour")).toBeInTheDocument();
    expect(document.getElementById("event-start-time-minute")).toBeInTheDocument();
    expect(document.getElementById("event-start-time-period")).toBeInTheDocument();
  });

  it("does not set id attributes when id prop is omitted", () => {
    render(<TimePickerSelect value="10:00" onChange={vi.fn()} />);

    const hourSelect = screen.getByRole("combobox", { name: "Hour" });
    expect(hourSelect.id).toBe("");
  });
});
