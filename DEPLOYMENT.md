# Deployment Architecture: GastroPro

This document outlines the recommended production deployment architecture for the GastroPro restaurant management system.

## 1. High-Level Architecture

```mermaid
graph TD
    User((User)) -->|HTTPS| Frontend[Frontend: Vercel / Netlify]
    Frontend -->|API Calls| Backend[Backend: Render / Railway / Cloud Run]
    Backend -->|SQL| DB[(PostgreSQL: Supabase / Neon / RDS)]
```

## 2. Component Details

### A. Frontend Deployment
*   **Platform**: [Vercel](https://vercel.com) or [Netlify](https://netlify.com).
*   **Build Command**: `npm run build`
*   **Output Directory**: `dist`
*   **Reasoning**: These platforms provide global CDN distribution, automatic SSL, and seamless integration with GitHub for preview deployments.

### B. Backend Deployment
*   **Platform**: [Render](https://render.com), [Railway](https://railway.app), or [Google Cloud Run](https://cloud.google.com/run).
*   **Method**: Dockerized Container.
*   **Reasoning**: The Express server is stateless and scales horizontally. Cloud Run is particularly cost-effective as it scales to zero when not in use.

### C. Database Hosting
*   **Platform**: [Supabase](https://supabase.com) or [Neon](https://neon.tech).
*   **Type**: Managed PostgreSQL.
*   **Reasoning**: These providers offer managed backups, connection pooling (PgBouncer), and easy scaling. Neon is excellent for "serverless" Postgres that scales with the backend.

### D. Authentication
*   **Provider**: JWT (JSON Web Tokens) via Express (`src/auth.ts`).
*   **Reasoning**: Access tokens (short-lived) and refresh tokens (long-lived) are issued by the Express backend and stored in `localStorage`. The token refresh flow is handled transparently by the Axios interceptor in `src/lib/apiClient.ts`. No third-party auth service is required.

---

## 3. Environment Variables

You will need to configure these variables in your hosting provider's dashboard:

### Backend (.env)
| Variable | Description | Example |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string | `postgres://user:pass@host:5432/db` |
| `JWT_SECRET` | Secret for access tokens | `openssl rand -base64 32` |
| `REFRESH_SECRET` | Secret for refresh tokens | `openssl rand -base64 32` |
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Server port | `3000` |

### Frontend (.env.production)
| Variable | Description |
| :--- | :--- |
| `VITE_API_URL` | URL of your deployed backend |

---

## 4. CI/CD Suggestion: GitHub Actions

We recommend a two-stage pipeline using **GitHub Actions**:

### Pipeline Workflow:
1.  **Lint & Test**: On every Pull Request, run `npm run lint` and any unit tests.
2.  **Build & Deploy**:
    *   **Frontend**: Automatically handled by Vercel/Netlify on push to `main`.
    *   **Backend**: 
        *   Build Docker image.
        *   Push to Container Registry (e.g., GCR or DockerHub).
        *   Trigger deployment to Cloud Run / Render.
3.  **Database Migrations**: Run `npx knex migrate:latest` (or your preferred migration tool) as a pre-deploy step in the backend pipeline.

## 5. Security Recommendations
1.  **CORS**: Restrict `CORS` in `server.ts` to only allow your production frontend domain.
2.  **SSL**: Ensure all traffic is forced over HTTPS (standard on Vercel/Render).
3.  **Secrets**: Never commit `.env` files. Use the hosting provider's secret manager.
4.  **Database Access**: Use a "Least Privilege" user for the application connection.
