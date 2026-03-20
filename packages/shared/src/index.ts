// Shared Zod schemas, TypeScript types, and API client definitions
// for the S/NC platform. Consumed by apps/api and apps/web.

export * from "./errors.js";
export * from "./result.js";
export * from "./auth.js";
export * from "./content.js";
export * from "./creator.js";
export * from "./storage.js";
export * from "./subscription.js";
export * from "./merch.js";
export * from "./booking.js";
export * from "./dashboard.js";
export * from "./emissions.js";
export * from "./admin.js";
export * from "./calendar.js";
export * from "./project.js";
export * from "./features.js";
export * from "./federation.js";
export * from "./streaming.js";
export * from "./studio.js";
export { textToStream, streamToText } from "./storage-contract.js";
