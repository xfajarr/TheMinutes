import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { authMiddleware } from "./middleware/auth";
import { servicesRouter } from "./routes/services";
import { routeRouter } from "./routes/route";
import { keysRouter } from "./routes/keys";
import { walletRouter } from "./routes/wallet";
import { spendRouter } from "./routes/spend";

const app = new Hono();

// Global middleware
app.use("*", logger());
app.use("*", cors());

// Health check (no auth)
app.get("/health", (c) => c.json({ status: "ok", ts: new Date().toISOString() }));

// All v1 routes require auth
const v1 = new Hono();
v1.use("*", authMiddleware);

v1.route("/services", servicesRouter);
v1.route("/route", routeRouter);
v1.route("/keys", keysRouter);
v1.route("/wallet", walletRouter);
v1.route("/spend", spendRouter);

app.route("/v1", v1);

const port = Number(process.env["API_PORT"] ?? 3000);
console.log(`TheMinutes API running on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
