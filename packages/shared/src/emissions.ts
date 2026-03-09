import { z } from "zod";

// ── Public Schemas ──

export const EmissionEntrySchema = z.object({
  id: z.string(),
  date: z.iso.date(),
  scope: z.number().int(),
  category: z.string(),
  subcategory: z.string(),
  source: z.string(),
  description: z.string(),
  amount: z.number(),
  unit: z.string(),
  co2Kg: z.number(),
  method: z.string(),
  projected: z.boolean(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const CreateEmissionEntrySchema = z.object({
  date: z.iso.date(),
  scope: z.number().int(),
  category: z.string().min(1),
  subcategory: z.string().min(1),
  source: z.string().min(1),
  description: z.string().min(1),
  amount: z.number().positive(),
  unit: z.string().min(1),
  co2Kg: z.number().min(0),
  method: z.string().min(1),
  projected: z.boolean().optional().default(false),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const CreateOffsetEntrySchema = z.object({
  date: z.iso.date(),
  source: z.string().min(1),
  description: z.string().min(1),
  amount: z.number().positive(),
  unit: z.string().min(1),
  co2Kg: z.number().min(0),
  method: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const EmissionsSummarySchema = z.object({
  totalCo2Kg: z.number(),
  grossCo2Kg: z.number(),
  offsetCo2Kg: z.number(),
  netCo2Kg: z.number(),
  entryCount: z.number().int(),
  latestDate: z.string().nullable(),
  projectedGrossCo2Kg: z.number(),
  doubleOffsetTargetCo2Kg: z.number(),
  additionalOffsetCo2Kg: z.number(),
});

export const EmissionsBreakdownSchema = z.object({
  summary: EmissionsSummarySchema,
  byScope: z.array(
    z.object({
      scope: z.number().int(),
      co2Kg: z.number(),
      entryCount: z.number().int(),
    }),
  ),
  byCategory: z.array(
    z.object({
      category: z.string(),
      co2Kg: z.number(),
      entryCount: z.number().int(),
    }),
  ),
  monthly: z.array(
    z.object({
      month: z.string(), // "YYYY-MM"
      actualCo2Kg: z.number(),
      projectedCo2Kg: z.number(),
      offsetCo2Kg: z.number(),
    }),
  ),
  entries: z.array(EmissionEntrySchema),
});

// ── Public Types ──

export type EmissionEntry = z.infer<typeof EmissionEntrySchema>;
export type CreateEmissionEntry = z.infer<typeof CreateEmissionEntrySchema>;
export type CreateOffsetEntry = z.infer<typeof CreateOffsetEntrySchema>;
export type EmissionsSummary = z.infer<typeof EmissionsSummarySchema>;
export type EmissionsBreakdown = z.infer<typeof EmissionsBreakdownSchema>;
