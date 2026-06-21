# ArtHouse Development Instructions

This repo is a small server-rendered Node.js application. It currently includes authentication, artist profile editing, artist item CRUD, public storefront pages, reservation records, upload handling, static asset wiring, a SQLite schema, and scripts needed for local development/deployment.

## Stack

- Node.js with TypeScript
- Express for the HTTP server
- Nunjucks for server-rendered HTML templates
- SQLite via `better-sqlite3`
- Cookie sessions via `express-session`
- `multer` for uploaded banners and item photos
- Plain CSS and small amounts of browser JavaScript when needed

## Project Layout

- `src/server.ts` starts the HTTP server.
- `src/app.ts` configures Express, sessions, templates, and static files.
- `src/routes/` contains public/private route groups.
- `src/db/` contains the SQLite connection helper, typed data models, and repository functions.
- `src/uploads.ts` configures image upload validation and storage paths.
- `src/views/` contains Nunjucks templates.
- `public/` contains CSS and future browser-side JavaScript.
- `assets/` contains tracked sample/static artwork and banner images.
- `uploads/` is for runtime artist uploads and is ignored by git.
- `db/migrations/` contains SQL migrations.
- `data/` contains the local SQLite database and is ignored by git.

## Local Development

1. Install Node.js 20 or newer.
2. Install dependencies:

   ```sh
   npm install
   ```

3. Create a local environment file:

   ```sh
   cp .env.example .env
   ```

4. Create/update the SQLite database:

   ```sh
   npm run db:migrate
   ```

5. Seed an admin account:

   ```sh
   ADMIN_PASSWORD="choose-a-password" npm run seed:admin
   ```

6. Seed the demo public catalog from checked-in assets:

   ```sh
   npm run seed:demo
   ```

7. Start the development server:

   ```sh
   npm run dev
   ```

8. Open `http://localhost:3000`.

## Useful Scripts

- `npm run dev` starts the server with file watching.
- `npm run typecheck` checks TypeScript without writing build output.
- `npm run build` compiles TypeScript into `dist/`.
- `npm run start` runs the compiled server.
- `npm run db:migrate` applies pending SQL migrations in development.
- `npm run db:migrate:compiled` applies pending SQL migrations after `npm run build`.
- `npm run seed:admin` creates or updates the admin account in development.
- `npm run seed:admin:compiled` creates or updates the admin account after `npm run build`.
- `npm run seed:demo` creates or updates six asset-backed demo artists and demo items in development.
- `npm run seed:demo:compiled` creates or updates the demo public catalog after `npm run build`.

## Implementation Notes

- Public pages should live in `src/routes/public.ts` until they become large enough to split by domain.
- The public home, artist, and product pages read from SQLite. Run `npm run seed:demo` to populate them from `assets/`.
- `seed:demo` assigns grouped item photos from `assets/items` across the six banner artists using a stable shuffled seed. Set `DEMO_SEED` to change the assignment.
- Public reservations are created from `/reserve/:itemId`. A reservation stores the customer's Telegram contact, marks the item `reserved`, and shows the customer the amount, artist bank account, and required payment description.
- Registration, login, dashboard, artist profile editing, item CRUD, and admin pages currently live in `src/routes/private.ts`.
- Use the repository exports from `src/db/index.ts` for database access instead of preparing SQL directly in route handlers.
- Use the tables in `db/migrations/001_initial.sql` as the starting data model for artists, registration codes, items, item photos, and reservations.
- Auth uses cookie sessions and Node's built-in `scrypt` password hashing via `src/auth/passwords.ts`.
- Admin accounts are seeded with `ADMIN_PASSWORD`, `ADMIN_NAME`, `ADMIN_SLUG`, and `ADMIN_BANK_ACCOUNT`.
- Uploaded banners and item photos are stored under `uploads/` in development. Use `UPLOADS_DIR` to point production uploads at persistent storage.
- Uploads currently accept JPEG, PNG, GIF, and WebP files up to 5 MB each.
- The existing `assets/` directory should stay for checked-in seed/demo imagery.
- The current session store is Express's default in-memory store. Replace it with a persistent session store before production use if user sessions need to survive restarts.

## Deployment

For a simple VPS deployment:

1. Install Node.js 20 or newer on the server.
2. Clone the repo and install dependencies:

   ```sh
   npm ci
   ```

3. Create a production `.env` file:

   ```sh
   NODE_ENV=production
   PORT=3000
   DATABASE_PATH=/var/lib/arthouse/arthouse.sqlite
   UPLOADS_DIR=/var/lib/arthouse/uploads
   SESSION_SECRET=<long-random-secret>
   ADMIN_PASSWORD=<temporary-admin-password>
   ADMIN_NAME=Admin
   ADMIN_SLUG=admin
   ADMIN_BANK_ACCOUNT=<admin-bank-account>
   ```

4. Ensure the database and upload directories are persistent and writable by the app user:

   ```sh
   mkdir -p /var/lib/arthouse /var/lib/arthouse/uploads
   ```

5. Build the app:

   ```sh
   npm run build
   ```

6. Apply migrations from the compiled script:

   ```sh
   npm run db:migrate:compiled
   ```

7. Seed or update the admin account:

   ```sh
   npm run seed:admin:compiled
   ```

8. Seed or update the demo public catalog if you want the asset-backed catalog:

   ```sh
   npm run seed:demo:compiled
   ```

9. Optionally remove development dependencies:

   ```sh
   npm prune --omit=dev
   ```

10. Start the server:

   ```sh
   npm run start
   ```

11. Put a reverse proxy such as Nginx or Caddy in front of the Node server for HTTPS, compression, and static-file caching.

For a platform deployment, use the same build/start commands and configure `NODE_ENV`, `PORT`, `DATABASE_PATH`, `UPLOADS_DIR`, and `SESSION_SECRET` in the platform settings. The app needs persistent storage for both the SQLite database and uploads; if the platform does not provide a persistent disk, use PostgreSQL and object storage instead of local SQLite/uploads.

## Production Checklist Before Launch

- Replace the default session store.
- Add CSRF protection for POST forms.
- Add image dimension validation if artists need strict banner/photo aspect ratios.
- Add database backups.
- Add logging and error monitoring.
- Add tests for registration, item CRUD, reservation flow, and admin reports.
