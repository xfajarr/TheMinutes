import { Hono } from "hono";
import { db } from "../db/client";
import { errorResponse } from "../middleware/error";

export const walletRouter = new Hono();

// GET /v1/wallet — operator take-rate balance + settlement history
walletRouter.get("/", async (c) => {
  try {
    const [{ unsettled }] = await db`
      SELECT COALESCE(SUM(amount), 0)::float AS unsettled
      FROM take_rate_events
      WHERE settled = FALSE
    `;

    const [{ total }] = await db`
      SELECT COALESCE(SUM(amount), 0)::float AS total
      FROM take_rate_events
    `;

    const [{ last_settled_at }] = await db`
      SELECT MAX(settled_at)::text AS last_settled_at
      FROM take_rate_events
      WHERE settled = TRUE
    `;

    return c.json({
      balance: unsettled,
      totalEarned: total,
      lastSettledAt: last_settled_at ?? null,
      tempoWalletAddress: process.env["OPERATOR_WALLET_ADDRESS"] ?? "",
    });
  } catch (err) {
    return errorResponse(c, err);
  }
});
