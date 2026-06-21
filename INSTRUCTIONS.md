# ArtHouse Development Instructions

This repo is scaffolded as a small server-rendered Node.js application. It is intentionally not a full implementation yet; the current code provides the app shell, route placeholders, static asset wiring, a SQLite schema, and scripts needed to start building.

## Stack

- Node.js with TypeScript
- Express for the HTTP server
- Nunjucks for server-rendered HTML templates
- SQLite via `better-sqlite3`
- Cookie sessions via `express-session`
- Plain CSS and small amounts of browser JavaScript when needed

## Project Layout

- `src/server.ts` starts the HTTP server.
- `src/app.ts` configures Express, sessions, templates, and static files.
- `src/routes/` contains public/private route groups.
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

5. Start the development server:

   ```sh
   npm run dev
   ```

6. Open `http://localhost:3000`.

## Useful Scripts

- `npm run dev` starts the server with file watching.
- `npm run typecheck` checks TypeScript without writing build output.
- `npm run build` compiles TypeScript into `dist/`.
- `npm run start` runs the compiled server.
- `npm run db:migrate` applies pending SQL migrations in development.
- `npm run db:migrate:compiled` applies pending SQL migrations after `npm run build`.

## Implementation Notes

- Public pages should live in `src/routes/public.ts` until they become large enough to split by domain.
- Registration, login, dashboard, and admin pages should live in `src/routes/private.ts` initially.
- Use the tables in `db/migrations/001_initial.sql` as the starting data model for artists, registration codes, items, item photos, and reservations.
- Uploaded banners and item photos should be stored under `uploads/` in development. Use `UPLOADS_DIR` to point production uploads at persistent storage.
- The existing `assets/` directory should stay for checked-in seed/demo imagery.
- Passwords must be hashed before storage. Add `bcrypt` or `argon2` when implementing registration.
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

7. Optionally remove development dependencies:

   ```sh
   npm prune --omit=dev
   ```

8. Start the server:

   ```sh
   npm run start
   ```

9. Put a reverse proxy such as Nginx or Caddy in front of the Node server for HTTPS, compression, and static-file caching.

For a platform deployment, use the same build/start commands and configure `NODE_ENV`, `PORT`, `DATABASE_PATH`, `UPLOADS_DIR`, and `SESSION_SECRET` in the platform settings. The app needs persistent storage for both the SQLite database and uploads; if the platform does not provide a persistent disk, use PostgreSQL and object storage instead of local SQLite/uploads.

## Production Checklist Before Launch

- Add real authentication and password hashing.
- Replace the default session store.
- Add authorization middleware for artist/admin routes.
- Add upload validation for file type, file size, and image dimensions.
- Add database backups.
- Add logging and error monitoring.
- Add tests for registration, item CRUD, reservation flow, and admin reports.
