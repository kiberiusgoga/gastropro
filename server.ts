import 'dotenv/config';
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import hpp from "hpp";
import mongoSanitize from "express-mongo-sanitize";
import router from "./src/api";
import { errorMiddleware } from "./src/middleware/errorMiddleware";

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 4000;

  // 1. Helmet — sets ~15 security response headers
  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production'
      ? undefined  // default strict CSP in prod
      : false,     // disabled in dev so Vite HMR works
  }));

  // 2. CORS — restrict to known origins only
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map(s => s.trim());

  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no Origin (mobile apps, curl, same-origin)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  }));

  // 3. Body size limits — prevent DoS via oversized payloads
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));

  // 4. Sanitize req.body/query/params keys (strips $ and . operator keys)
  app.use(mongoSanitize() as express.RequestHandler);

  // 5. HTTP Parameter Pollution prevention
  app.use(hpp());

  // 6. Request logging
  app.use(morgan('dev'));

  // 7. Global rate limit — 1000 req / IP / 15 min across all API routes
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
  });
  app.use('/api', globalLimiter);

  // 8. Strict auth rate limit — 5 failed attempts / IP / 15 min (brute-force guard).
  // skipSuccessfulRequests: true means only 401/5xx responses count toward the cap,
  // so a legitimate user who eventually succeeds doesn't burn their quota.
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts, please try again in 15 minutes.' },
  });
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/reset-password', authLimiter);

  // forgot-password always returns 200 (anti-enumeration), so skipSuccessfulRequests
  // would skip every request — useless for that endpoint. Use a plain 5/15min limiter.
  const forgotPasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again in 15 minutes.' },
  });
  app.use('/api/auth/forgot-password', forgotPasswordLimiter);

  // Routes
  app.use("/api", router);
  app.use(errorMiddleware as express.ErrorRequestHandler);

  // Health check — generic response so DB errors don't leak connection details
  app.get("/api/health", async (_req, res) => {
    try {
      const { default: pool } = await import("./src/db");
      await pool.query("SELECT 1");
      res.json({ status: "ok", timestamp: new Date().toISOString() });
    } catch (e) {
      console.error('Health check DB failure:', e);
      res.status(503).json({ status: "error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`GastroPro server running on http://localhost:${PORT}`);
  });
}

startServer();
