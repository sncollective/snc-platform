// ── Private Types ──

type DbCalendarEventRow = {
  id: string;
  title: string;
  description: string;
  startAt: Date;
  endAt: Date | null;
  allDay: boolean;
  eventType: string;
  location: string;
  createdBy: string;
  creatorId: string | null;
  projectId: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type DbCalendarFeedTokenRow = {
  id: string;
  userId: string;
  token: string;
  createdAt: Date;
};

type DbProjectRow = {
  id: string;
  name: string;
  description: string;
  creatorId: string | null;
  createdBy: string;
  completed: boolean;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

// ── DB Record Fixtures ──

export const makeMockCalendarEvent = (
  overrides?: Partial<DbCalendarEventRow>,
): DbCalendarEventRow => ({
  id: "evt_test001",
  title: "Recording Session",
  description: "Tracking drums for new album",
  startAt: new Date("2026-03-20T14:00:00.000Z"),
  endAt: new Date("2026-03-20T18:00:00.000Z"),
  allDay: false,
  eventType: "recording-session",
  location: "Studio A",
  createdBy: "user_test123",
  creatorId: null,
  projectId: null,
  deletedAt: null,
  createdAt: new Date("2026-03-15T10:00:00.000Z"),
  updatedAt: new Date("2026-03-15T10:00:00.000Z"),
  ...overrides,
});

export const makeMockFeedToken = (
  overrides?: Partial<DbCalendarFeedTokenRow>,
): DbCalendarFeedTokenRow => ({
  id: "ft_test001",
  userId: "user_test123",
  token: "test-feed-token-uuid",
  createdAt: new Date("2026-03-15T10:00:00.000Z"),
  ...overrides,
});

export const makeMockProject = (
  overrides?: Partial<DbProjectRow>,
): DbProjectRow => ({
  id: "proj_test001",
  name: "New Album",
  description: "Working on the new album",
  creatorId: null,
  createdBy: "user_test123",
  completed: false,
  completedAt: null,
  createdAt: new Date("2026-03-15T10:00:00.000Z"),
  updatedAt: new Date("2026-03-15T10:00:00.000Z"),
  ...overrides,
});
