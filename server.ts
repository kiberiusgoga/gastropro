import 'dotenv/config';
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import morgan from "morgan";
import router from "./src/api";


async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 4000;

  app.use(cors());
  app.use(express.json());
  app.use(morgan('dev'));
  
  // Routes
  app.use("/api", router);


  // API Health Check
  app.get("/api/health", async (req, res) => {
    let dbStatus = "disconnected";
    try {
      const { default: pool } = await import("./src/db");
      await pool.query("SELECT 1");
      dbStatus = "connected";
    } catch (e) {
      dbStatus = `error: ${(e as Error).message}`;
    }
    res.json({ status: "ok", database: dbStatus, timestamp: new Date().toISOString() });
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
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`GastroPro server running on http://localhost:${PORT}`);
  });
}

startServer();
