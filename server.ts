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
import logger from "./src/lib/logger";

// Crash safety — let process managers (PM2/systemd) restart on fatal errors
process.on('uncaughtException', (err: Error) => {
  logger.error('Uncaught Exception — shutting down', { message: err.message, stack: err.stack });
  setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason: unknown) => {
  logger.error('Unhandled Rejection', { reason: String(reason) });
});

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
  const defaultOrigins = process.env.NODE_ENV !== 'production'
    ? `http://localhost:5173,http://localhost:${PORT}`
    : '';
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || defaultOrigins)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

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
  // multer handles multipart/form-data for image uploads; express.json only handles JSON

  // 4. Sanitize req.body/query/params keys (strips $ and . operator keys)
  app.use(mongoSanitize() as express.RequestHandler);

  // 5. HTTP Parameter Pollution prevention
  app.use(hpp());

  // 6. Request logging
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

  // 7. Global rate limit — 1000 req / IP / 15 min across all API routes
  // NOTE: express-rate-limit v7+ uses `limit` (not `max`) as the option name.
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 1000,
    skip: (req) => req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1',
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
    limit: 5,
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
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again in 15 minutes.' },
  });
  app.use('/api/auth/forgot-password', forgotPasswordLimiter);

  // Public guest-menu endpoints — no auth, but still rate-limited
  const publicMenuLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
  });
  app.use('/api/public/menu', publicMenuLimiter);

  const publicNotifyLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many notification requests, please try again later.' },
  });
  app.use('/api/public/notify', publicNotifyLimiter);

  // Serve locally-uploaded images (used when Cloudinary is not configured)
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads'), {
    maxAge: '7d',
    immutable: false,
  }));

  // Health check — must be registered BEFORE the API router so auth middleware
  // in the router doesn't intercept /api/health and return 401
  app.get("/api/health", async (_req, res) => {
    try {
      const { default: pool } = await import("./src/db");
      await pool.query("SELECT 1");
      res.json({ status: "ok", db: "connected", timestamp: new Date().toISOString() });
    } catch (e) {
      logger.error('Health check DB failure', { error: String(e) });
      res.status(503).json({ status: "error", db: "disconnected" });
    }
  });

  // Routes
  app.use("/api", router);
  app.use(errorMiddleware as express.ErrorRequestHandler);

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
