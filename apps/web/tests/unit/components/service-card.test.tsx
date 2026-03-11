import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ── Import component under test (no external mocks needed) ──

import { ServiceCard } from "../../../src/components/booking/service-card.js";
import { makeMockService } from "../../helpers/booking-fixtures.js";

// ── Tests ──

describe("ServiceCard", () => {
  it("renders service name as heading", () => {
    const service = makeMockService({ name: "Recording Session" });
    const onRequestBooking = vi.fn();

    render(
      <ServiceCard service={service} onRequestBooking={onRequestBooking} />,
    );

    expect(
      screen.getByRole("heading", { name: "Recording Session" }),
    ).toBeInTheDocument();
  });

  it("renders service description", () => {
    const service = makeMockService({
      description: "Professional studio recording.",
    });
    const onRequestBooking = vi.fn();

    render(
      <ServiceCard service={service} onRequestBooking={onRequestBooking} />,
    );

    expect(
      screen.getByText("Professional studio recording."),
    ).toBeInTheDocument();
  });

  it("renders pricing info", () => {
    const service = makeMockService({ pricingInfo: "$50/hour" });
    const onRequestBooking = vi.fn();

    render(
      <ServiceCard service={service} onRequestBooking={onRequestBooking} />,
    );

    expect(screen.getByText("$50/hour")).toBeInTheDocument();
  });

  it("renders 'Request Booking' button", () => {
    const service = makeMockService();
    const onRequestBooking = vi.fn();

    render(
      <ServiceCard service={service} onRequestBooking={onRequestBooking} />,
    );

    expect(
      screen.getByRole("button", { name: "Request Booking" }),
    ).toBeInTheDocument();
  });

  it("calls onRequestBooking with service ID when button is clicked", async () => {
    const user = userEvent.setup();
    const service = makeMockService({ id: "svc_studio" });
    const onRequestBooking = vi.fn();

    render(
      <ServiceCard service={service} onRequestBooking={onRequestBooking} />,
    );

    await user.click(
      screen.getByRole("button", { name: "Request Booking" }),
    );

    expect(onRequestBooking).toHaveBeenCalledTimes(1);
    expect(onRequestBooking).toHaveBeenCalledWith("svc_studio");
  });

  it("renders different service data via overrides", () => {
    const service = makeMockService({
      name: "Label Services",
      description: "Distribution and marketing support.",
      pricingInfo: "Contact for pricing",
    });
    const onRequestBooking = vi.fn();

    render(
      <ServiceCard service={service} onRequestBooking={onRequestBooking} />,
    );

    expect(
      screen.getByRole("heading", { name: "Label Services" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Distribution and marketing support."),
    ).toBeInTheDocument();
    expect(screen.getByText("Contact for pricing")).toBeInTheDocument();
  });
});
