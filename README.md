# BalanceX

A retail-finance manager for a single-shop telecom reseller in the Maldives — daily entries, credit sales, wallet top-ups, bank ledger, and screenshot-verified end-of-day reconciliation.

Built with Next.js 16 (App Router, React Compiler), Prisma 7, PostgreSQL 14+. Self-hosted on the owner's hardware; data never leaves the LAN.

## Prerequisites

- **Node.js 20+** (Next.js 16 requirement)
- **PostgreSQL 14+** running locally or on the same network
- **npm** (uses `package-lock.json`)

## First-time setup

```bash
git clone <repo-url> balancex
cd balancex
npm install

# Copy and fill in env vars
cp .env.example .env
# Edit .env: set DATABASE_URL, NEXTAUTH_URL, NEXTAUTH_SECRET

# Generate NEXTAUTH_SECRET
openssl rand -hex 32

# Apply schema to a fresh database
npm run db:push

# (Optional) Seed demo data — see "Seeding" below for warnings
npm run db:seed
```

Then start it:

```bash
npm run dev      # development on http://localhost:3500
# or
npm run build && npm run start   # production on http://localhost:3500
```

## Environment variables

All settings live in `.env` (see [.env.example](.env.example) for the template):

| Var | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string. URL-encode special chars in the password (`@` → `%40`, `%` → `%25`). |
| `NEXTAUTH_URL` | Yes | Public URL the app is reached at. Include port if non-standard (e.g. `http://192.168.1.10:3500`). |
| `NEXTAUTH_SECRET` | Yes | Session-cookie signing key. Generate with `openssl rand -hex 32`. **Rotate when standing up production for the first time** — never reuse the dev value. |
| `DEV_ORIGINS` | No | Comma-separated LAN IPs allowed to access `npm run dev` from other devices. Dev-mode only. Example: `DEV_ORIGINS="192.168.1.10,172.18.3.138"`. |

## Database management

This project uses **`prisma db push`** (no migrations directory). Schema changes are applied directly:

```bash
npm run db:push       # apply schema.prisma to the database
npm run db:generate   # regenerate the Prisma client only
npm run db:studio     # open Prisma Studio (GUI) on http://localhost:5555
```

**`prisma db push` vs `prisma migrate dev`:**

`db push` mutates the database to match the schema with no migration history. It's faster for solo development on a single machine but has no rollback path and no audit trail. **For a future multi-developer or production deployment**, switch to `prisma migrate` by running `npx prisma migrate dev --name init` (this generates a `prisma/migrations/` directory) and check it in. After that, never run `db push` against the same database.

Type-changing or column-renaming alterations sometimes need manual SQL when `db push` would otherwise drop data — `db push` will refuse and ask for `--accept-data-loss` in those cases. Don't pass that flag blindly: open a `psql` session, run the `ALTER TABLE ... USING ...` cast yourself, and only then re-run `db push` (it should report "already in sync").

## Seeding

```bash
npm run db:seed         # populate demo users, customers, sample entries
npm run db:seed-float   # cash-float defaults only (safe to run alongside)
npm run db:clean        # delete ALL rows (keeps schema)
```

> **Warning:** `db:seed` truncates every table before re-inserting (see [prisma/seed.ts:38-51](prisma/seed.ts#L38)). Never run it against a database with real data. The demo password for all seeded users is `password123`.

> `db:clean` is functionally identical to a destructive `TRUNCATE … CASCADE` of every model. There is no confirmation prompt.

## Backup & restore

The app's persistent state lives in two places:

1. **PostgreSQL database** — all transactions, users, audit logs, settings.
2. **`./storage/uploads/screenshots/`** — uploaded screenshot files. Filenames are referenced from the `TelcoScreenshot` rows; losing the dir orphans those rows.

A complete backup is both. **Backing up only the database silently loses screenshots.**

### Backup

```bash
# Database — custom-format dump (compressed, restorable via pg_restore)
pg_dump -U <user> -h <host> -d balancex -F c -f balancex-$(date +%Y%m%d).dump

# Uploads
tar czf uploads-$(date +%Y%m%d).tar.gz storage/uploads/
```

For nightly automation, schedule both via `cron` and rotate the output to off-machine storage (USB, network share, S3-compatible bucket). Encrypt the archive at rest if it leaves the LAN.

### Restore

```bash
# Database — fresh database first
createdb -U <user> balancex
pg_restore -U <user> -h <host> -d balancex balancex-YYYYMMDD.dump

# Uploads — extract relative to project root
tar xzf uploads-YYYYMMDD.tar.gz
```

After restore, restart the app so the connection pool picks up the new DB state.

## LAN access during development

By default Next.js's dev server blocks cross-origin requests. To use the dev server from another device on the LAN, add that device's IP to `DEV_ORIGINS` in `.env` and restart `npm run dev` — see [next.config.ts:9-15](next.config.ts#L9). The setting is dev-mode only; production (`npm run start`) does not enforce it, so configure your reverse proxy / firewall there instead.

## Tech reference

| Layer | Tool |
|---|---|
| Framework | Next.js 16 (App Router, React Compiler, Turbopack) |
| ORM | Prisma 7 with `@prisma/adapter-pg` (Node `pg` driver) |
| Database | PostgreSQL 14+ (uses `jsonb`, `text`, `numeric`) |
| Auth | NextAuth 4 (credentials provider, bcrypt password hashes) |
| UI | Radix primitives + Tailwind 4 + lucide-react |
| Tests | Vitest 3 |
| Linting | ESLint 9 + Husky pre-commit hook |

## Scripts

```
npm run dev          Start dev server (port 3500, Turbopack)
npm run build        Production build
npm run start        Run production build
npm run lint         ESLint
npm run test         Vitest one-shot
npm run test:watch   Vitest in watch mode
npm run db:push      Apply schema to database
npm run db:generate  Regenerate Prisma client
npm run db:seed      Seed demo data (DESTRUCTIVE)
npm run db:seed-float  Seed cash-float defaults
npm run db:clean     Delete all rows (DESTRUCTIVE)
npm run db:studio    Prisma Studio GUI
```
