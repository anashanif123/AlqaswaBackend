import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { sanitize } from "./middleware/validate.js";
import { errorHandler, notFoundRoute } from "./middleware/error.js";
import { UPLOAD_DIR } from "./middleware/upload.js";
import auth from "./routes/auth.js";
import catalog from "./routes/catalog.js";
import orders from "./routes/orders.js";
import misc from "./routes/misc.js";
import admin from "./routes/admin/index.js";

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: (process.env.CLIENT_URL || "http://localhost:3000").split(","), credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(sanitize);
if (process.env.NODE_ENV !== "test") app.use(morgan("dev"));

app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "30d" }));

const limiter = (max) => rateLimit({ windowMs: 15 * 60 * 1000, max, standardHeaders: true, legacyHeaders: false });
app.use("/api/auth/login", limiter(20));
app.use("/api/auth/register", limiter(20));
app.use(["/api/contact", "/api/newsletter"], limiter(30));

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", auth);
app.use("/api", catalog);
app.use("/api", orders);
app.use("/api", misc);
app.use("/api/admin", admin);

app.use(notFoundRoute);
app.use(errorHandler);

export default app;
