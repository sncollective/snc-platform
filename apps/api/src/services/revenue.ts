import { AppError, ok, err, type Result, type MonthlyRevenue } from "@snc/shared";

import { wrapExternalError } from "./external-error.js";
import { getStripe, ensureConfigured } from "./stripe-client.js";

// ── Private Helpers ──

const wrapRevenueError = wrapExternalError("REVENUE_ERROR");

// ── Public API ──

export const getMonthlyRevenue = async (
  months: number,
): Promise<Result<MonthlyRevenue[], AppError>> => {
  const configured = ensureConfigured();
  if (!configured.ok) return err(configured.error);

  try {
    const stripe = getStripe();
    const now = new Date();
    const startDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months + 1, 1),
    );
    const gte = Math.floor(startDate.getTime() / 1000);
    const lt = Math.floor(now.getTime() / 1000);

    // Auto-paginate all paid invoices in the date range
    const totals = new Map<string, number>();
    for await (const invoice of stripe.invoices.list({
      status: "paid",
      created: { gte, lt },
      limit: 100,
    })) {
      const date = new Date(invoice.created * 1000);
      const key = `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}`;
      totals.set(key, (totals.get(key) ?? 0) + invoice.amount_paid);
    }

    // Build zero-filled array from start month to current month
    const result: MonthlyRevenue[] = [];
    const cursor = new Date(
      Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1),
    );

    while (cursor.getTime() < now.getTime()) {
      const month = cursor.getUTCMonth() + 1;
      const year = cursor.getUTCFullYear();
      const key = `${year}-${month}`;
      result.push({ month, year, amount: totals.get(key) ?? 0 });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }

    result.reverse();
    return ok(result);
  } catch (e) {
    return err(wrapRevenueError(e));
  }
};
