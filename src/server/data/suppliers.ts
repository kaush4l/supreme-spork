import "server-only";
import { z } from "zod";
import { backend } from "../api/backend";
import { read } from "../api/call";
import { ApiFailure } from "../api/errors";

export const supplierSchema = z.object({
  id: z.string(),
  name: z.string(),
  aliases: z.array(z.string()),
  category: z.string().nullable(),
  provisional: z.boolean(),
  payment_terms_days: z.number().nullable(),
});
export type Supplier = z.infer<typeof supplierSchema>;

const path = (venueId: string) => ({ params: { path: { venue_id: venueId } } });

export function listSuppliers(token: string, venueId: string, next: string) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/suppliers", path(venueId)),
    z.array(supplierSchema),
    next,
  );
}

export const pricePointSchema = z.object({
  date: z.string(),
  qty: z.number(),
  unit: z.string().nullable(),
  unit_price_cents: z.number().nullable(),
  total_cents: z.number().nullable(),
  document_id: z.string().nullable().optional(),
  purchase_id: z.string(),
});

export const priceHistorySchema = z.object({
  supplier: supplierSchema,
  items: z.array(
    z.object({
      item_id: z.string(),
      item: z.string().nullable(),
      points: z.array(pricePointSchema),
    }),
  ),
});
export type PriceHistory = z.infer<typeof priceHistorySchema>;

export function supplierPrices(
  token: string,
  venueId: string,
  supplierId: string,
  next: string,
) {
  return read(
    backend(token).GET("/v1/venues/{venue_id}/suppliers/{supplier_id}/prices", {
      params: { path: { venue_id: venueId, supplier_id: supplierId } },
    }),
    priceHistorySchema,
    next,
  );
}

const dearerSchema = z.object({
  supplier: z.string(),
  supplier_id: z.string(),
  price_cents: z.number(),
  diff_cents: z.number(),
  last_bought: z.string(),
  bought_last_4_weeks: z.string(),
  weekly_cents: z.number(),
});

export const compareSchema = z.object({
  week_start: z.string(),
  week_end: z.string(),
  from: z.string(),
  comparisons: z.array(
    z.object({
      item: z.string(),
      item_id: z.string(),
      unit: z.string(),
      cheaper: z.object({
        supplier: z.string(),
        supplier_id: z.string(),
        price_cents: z.number(),
        last_bought: z.string(),
      }),
      dearer: z.array(dearerSchema),
      same_price: z.boolean(),
      weekly_difference_cents: z.number(),
    }),
  ),
  unmatched: z.array(
    z.object({
      item: z.string(),
      supplier: z.string(),
      reason: z.string(),
      trading_day: z.string(),
    }),
  ),
  unmatched_note: z.string(),
  basis: z.string(),
});
export type Compare = z.infer<typeof compareSchema>;

/** The comparison for a week (a Monday). A week the backend refuses comes back as a plain message, not a crash. */
export async function supplierCompare(
  token: string,
  venueId: string,
  week: string | undefined,
  next: string,
): Promise<{ ok: true; data: Compare } | { ok: false; message: string }> {
  try {
    const data = await read(
      backend(token).GET("/v1/venues/{venue_id}/suppliers/compare", {
        params: {
          path: { venue_id: venueId },
          query: week ? { week } : {},
        },
      }),
      compareSchema,
      next,
    );
    return { ok: true, data };
  } catch (error) {
    if (error instanceof ApiFailure && error.status === 422)
      return { ok: false, message: error.message };
    throw error;
  }
}
