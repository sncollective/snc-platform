import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { extractRouteComponent } from "../../../../helpers/route-test-utils.js";
import { createRouterMock } from "../../../../helpers/router-mock.js";

// ── Hoisted Mocks ──

const { mockUseParams, mockApiGet, mockApiMutate, mockToString } = vi.hoisted(() => ({
  mockUseParams: vi.fn(() => ({ creatorId: "c1" })),
  mockApiGet: vi.fn(),
  mockApiMutate: vi.fn(),
  mockToString: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => {
  const base = createRouterMock({ getRouteApi: () => ({ useParams: mockUseParams }) });
  base.createFileRoute = () => (routeOptions: Record<string, unknown>) => ({
    ...routeOptions,
    useParams: mockUseParams,
  });
  return base;
});
vi.mock("../../../../../src/lib/fetch-utils.js", () => ({
  apiGet: mockApiGet,
  apiMutate: mockApiMutate,
}));
vi.mock("qrcode", () => ({ default: { toString: mockToString } }));

const ManageJoinPage = extractRouteComponent(
  () => import("../../../../../src/routes/creators/$creatorId/manage/join.js"),
);

beforeEach(() => {
  vi.clearAllMocks();
  mockUseParams.mockReturnValue({ creatorId: "c1" });
  mockApiGet.mockResolvedValue({ incentiveText: "Free sticker", showSncExplainer: true, showSubscribeCta: false });
  mockApiMutate.mockResolvedValue({ incentiveText: "Updated", showSncExplainer: false, showSubscribeCta: false });
  mockToString.mockResolvedValue("<svg>qr</svg>");
});

describe("ManageJoinPage", () => {
  it("renders the join URL and generates a QR for it", async () => {
    render(<ManageJoinPage />);

    expect(screen.getByText(/\/join\/c1/)).toBeInTheDocument();
    await waitFor(() =>
      expect(mockToString).toHaveBeenCalledWith(
        expect.stringContaining("/join/c1"),
        expect.objectContaining({ type: "svg" }),
      ),
    );
  });

  it("loads existing config (defaults reflected in the form)", async () => {
    render(<ManageJoinPage />);
    const incentive = await screen.findByLabelText(/Incentive line/);
    expect(incentive).toHaveValue("Free sticker");
  });

  it("round-trips a config edit via PATCH", async () => {
    render(<ManageJoinPage />);
    const explainerToggle = await screen.findByRole("checkbox", { name: /What is S\/NC/ });
    await userEvent.click(explainerToggle);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(mockApiMutate).toHaveBeenCalledWith(
        "/api/creators/c1/join-config",
        expect.objectContaining({ method: "PATCH" }),
      ),
    );
    expect(await screen.findByText("Saved")).toBeInTheDocument();
  });
});
