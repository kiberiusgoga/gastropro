# Firebase Legacy Files

This folder contains Firebase configuration files from when GastroPro
was originally built on Firebase + Firestore. The project was migrated
to PostgreSQL + Express in April 2026.

These files are kept for historical reference only. They are NOT used
by the current application. Do not move them back to the project root.

If you need to understand the original Firebase data model, see
`firestore.rules` for the security rules that defined access patterns.

## Files

| File | Purpose |
|---|---|
| `firebase-applet-config.json` | Firebase project credentials (API keys, project ID) |
| `firebase-blueprint.json` | AI Studio Firebase app blueprint |
| `firestore.rules` | Firestore security rules — shows original data model and access patterns |

## Current stack

The application now uses:
- **Database**: PostgreSQL (see `schema.sql`)
- **Auth**: JWT (access + refresh tokens via `src/auth.ts`)
- **Backend**: Express.js (`server.ts`)
- **Seeding**: `scripts/seed-demo.sql`, `seed-db.ts` (legacy — see note below)

## Note on create-demo.ts and seed-db.ts

`create-demo.ts` and `seed-db.ts` in the project root also import Firebase
but are excluded from the TypeScript build (`tsconfig.json`). They are
legacy seeding scripts that were never converted to PostgreSQL and are not
run by any current npm script.
