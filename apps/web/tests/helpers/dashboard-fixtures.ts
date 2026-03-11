import type {
  RevenueResponse,
  MonthlyRevenue,
  SubscriberSummary,
  BookingSummary,
  PendingBookingItem,
} from "@snc/shared";

// ── Web-level Fixtures (API response shapes consumed by frontend components) ──

export const makeMockMonthlyRevenue = (
  overrides?: Partial<MonthlyRevenue>,
): MonthlyRevenue => ({
  month: 2,
  year: 2026,
  amount: 5000,
  ...overrides,
});

export const makeMockRevenueResponse = (
  overrides?: Partial<RevenueResponse>,
): RevenueResponse => ({
  currentMonth: 5000,
  monthly: [
    { month: 2, year: 2026, amount: 5000 },
    { month: 1, year: 2026, amount: 4200 },
    { month: 12, year: 2025, amount: 3800 },
    { month: 11, year: 2025, amount: 4500 },
    { month: 10, year: 2025, amount: 3000 },
    { month: 9, year: 2025, amount: 2800 },
    { month: 8, year: 2025, amount: 3500 },
    { month: 7, year: 2025, amount: 4100 },
    { month: 6, year: 2025, amount: 2500 },
    { month: 5, year: 2025, amount: 3200 },
    { month: 4, year: 2025, amount: 2900 },
    { month: 3, year: 2025, amount: 3600 },
  ],
  ...overrides,
});

export const makeMockSubscriberSummary = (
  overrides?: Partial<SubscriberSummary>,
): SubscriberSummary => ({
  active: 42,
  ...overrides,
});

export const makeMockBookingSummary = (
  overrides?: Partial<BookingSummary>,
): BookingSummary => ({
  pending: 3,
  total: 10,
  ...overrides,
});

export const makeMockPendingBookingItem = (
  overrides?: Partial<PendingBookingItem>,
): PendingBookingItem => ({
  id: "bk_pending_001",
  userId: "user_requester1",
  serviceId: "svc_test_recording",
  preferredDates: ["2026-03-15", "2026-03-20"],
  notes: "Afternoon session preferred",
  status: "pending",
  reviewedBy: null,
  reviewNote: null,
  createdAt: "2026-02-20T14:30:00.000Z",
  updatedAt: "2026-02-20T14:30:00.000Z",
  service: {
    id: "svc_test_recording",
    name: "Recording Session",
    description: "Professional studio recording session with engineer.",
    pricingInfo: "$50/hour",
    active: true,
    sortOrder: 0,
    createdAt: "2026-01-15T10:00:00.000Z",
    updatedAt: "2026-01-15T10:00:00.000Z",
  },
  requester: {
    id: "user_requester1",
    name: "Jane Doe",
    email: "jane@example.com",
  },
  ...overrides,
});
