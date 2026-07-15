# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project purpose & working convention

`http-lab` is a learning project: the user is building it to grow into a senior
backend engineer, not shipping it as a product. **Check `TODO.md` first** —
it's a week-by-week roadmap (in Turkish) with checkboxes; it tells you which
week/milestone is currently active and what's already done. `TODO.md`'s own
header contains the user's original standing instructions to Claude: act as a
mentor, and after every meaningful change, update `LEARNING_LOG.md` with an
entry in this exact format (Turkish): **Yapılan Değişiklik** (what changed,
which files) / **Mimari Karar** (why this approach, not another) / **Mentör
Notu** (the one best-practice takeaway). This is not optional flavor — it's
the user's explicit mechanism for learning from the work, so keep doing it as
each new step of the roadmap is completed, and keep checking off `TODO.md`
items (with a short note/link to the relevant `LEARNING_LOG.md` entry) as they
land.

`REFACTORING_DIARY.md` documents a completed SOLID refactor (BEFORE/AFTER/
NEDEN format) from Week 4. `README.md` has the current feature list, data
model, API table, and setup instructions. Code comments in this repo are
unusually dense Turkish explanations of *why* a design decision was made
(SRP/OCP/DIP notes, or references to a past bug) — read them before changing
a file, don't just skim past them.

**Git workflow preference**: unless explicitly told otherwise in a given
session, the user prefers to run `git commit`/`git push` themselves — don't
push to GitHub on your own initiative. Do stage/commit locally only if asked.

## Roadmap status (update this section as weeks complete)

- Weeks 1–6 (Terminal/Git, HTTP/REST, DB/ORM, Auth/Security, Testing, Docker): ✅ done.
- **Week 7 (CI/CD & Cloud Deployment): ✅ done.** GitHub Actions CI (lint/test/build,
  all parallel) + CD (Render deploy hook + smoke test) are live and green.
  App is deployed at **https://http-lab.onrender.com** (verify with `curl
  https://http-lab.onrender.com/health`).
- Week 8 (Monitoring/Logging/Observability — pino, prom-client, Grafana Cloud,
  UptimeRobot) is next, not yet started.
- Weeks 9–10 (Frontend/full-stack, AI/RAG portfolio #3) not started.

Known still-open item from Week 7: GitHub branch protection on `main` exists
(requires PR) but does **not** yet enforce required status checks, and repo
admins can bypass it — this was observed empirically (a direct push
succeeded with a "Bypassed rule violations" warning). Flagged for the user to
tighten in GitHub UI (Settings → Branches), not something fixable via files.

## Commands

```bash
npm install              # triggers `postinstall` -> prisma generate
npm run lint              # eslint . (flat config, see eslint.config.js)
npm run dev               # nodemon src/server.js — native, fast-reload dev
npm start                 # node src/server.js (prod)

npm test                  # all tests, --runInBand --forceExit
npm run test:unit         # tests/unit only, no DB needed
npm run test:integration  # tests/integration only, needs the test DB running
npm run test:coverage     # coverage report; enforced thresholds: 80/70/80/80 stmt/branch/fn/line

# single test file / single test name
npx jest tests/unit/tokenService.test.js
npx jest -t "name of the test"

npx prisma migrate dev    # create/apply a new migration (dev DB)
npx prisma migrate deploy
npx prisma studio

docker compose up --build # canonical way to run the FULL stack locally (see below)
```

Tests run against a **real PostgreSQL database**, never mocks for the
"happy path" — `pretest` auto-runs `db:migrate:test` (via `dotenv-cli -e
.env.test`) before `npm test`. `tests/testUtils/resetDb.js` truncates `Item`
→ `User` → `Category` (FK order) before each integration test. `.env.test`
must point at a *separate* DB from `.env` (default: `http_lab_test`) — it
gets wiped on every run. If `.env.test` is missing, `tests/jest.setup.js`
throws an explicit setup error instead of a cryptic `secretOrPrivateKey`
failure. For scenarios that need a *broken* dependency (e.g. DB down), the
project's pattern is to `jest.mock('../../src/db/prisma')` in a **unit**
test rather than trying to force it against the real DB — a real
`prisma.$disconnect()` was tried first and found to auto-reconnect on the
next query, making that approach unreliable (see `tests/unit/health.test.js`
and `LEARNING_LOG.md` Adım 3).

Do **not** run `npx prisma migrate deploy` directly without `dotenv-cli` —
Prisma CLI defaults to reading `.env`, so an unscoped call applies migrations
to the dev DB instead of the test DB (this exact mistake happened once; see
`README.md` → "Bilinen Sorunlar").

## Local dev: docker-compose is canonical, not `npm run dev`

Decision (see `LEARNING_LOG.md` Adım 2): since the app deploys as a
container in production (Render, building from this repo's `Dockerfile`),
running it the same way locally (`docker compose up --build`) is the
default/recommended workflow — it catches container-networking bugs before
they reach production. Consequences:

- `.env`'s `DATABASE_URL` host is **`db`** (the compose service name), not
  `localhost` — this only resolves from inside the Docker network.
- `db`'s Postgres port is **not** published to the host (removed
  intentionally, see "Known rough edges" below) — don't add `ports:
  ["5432:5432"]` back to `docker-compose.yml` as a "fix" without asking; if
  the user wants native `npm run dev` + a dockerized Postgres, that requires
  *temporarily* re-adding that port mapping and switching `.env`'s host back
  to `localhost` (documented in `README.md` as "Yöntem B").
- `.env.test` is unaffected by any of this — Jest always runs natively
  (never in a container) and connects via `localhost`, matching CI's
  Postgres service container.

## Architecture

**Request flow**: `server.js` (binds the port) → `app.js` (builds the Express
app, no side effects) → `requestLogger` → route → `authMiddleware` →
`itemsDb`/`prisma` → `errorHandler`. This app/server split exists specifically
so `app.js` can be `require`d by Supertest without opening a real port.

**Dependency direction (DIP)**: `src/db/prisma.js` exports a single lazily-
created `PrismaClient` singleton (via `@prisma/adapter-pg` + `pg.Pool`).
Every module that touches the DB (`routes/auth.js`, `store/itemsDb.js`,
`app.js`'s health check) calls `getPrismaClient()` — never construct a
second `PrismaClient`/`Pool` anywhere; a prior bug was two independent
connection pools before this was centralized. This singleton is also the
project's mocking seam: `jest.mock('../../src/db/prisma')` in a test file
swaps in a fake client without touching any consuming module.

**Auth is two-gate**: `authenticateToken` (verifies JWT via
`utils/tokenService.js`, sets `req.user`) then `requireRole(roles)` (RBAC gate;
`ADMIN` always bypasses). Token *generation/verification* logic and *policy*
(expiry durations, secrets) live only in `tokenService.js`; password hashing
policy (bcrypt, salt rounds = 12) lives only in `passwordService.js`. Routes
just orchestrate — don't inline `jwt.sign`/`bcrypt.hash` calls into a route
again, that's the exact SRP violation the Week 4 refactor removed.

**Ownership vs. role**: role (`EDITOR`/`ADMIN`) gates *which endpoints* a user
can call; ownership (`item.userId === req.user.userId`) gates *which rows*,
currently enforced only on `DELETE /api/items/:id` (`ADMIN` bypasses). `PUT`/
`PATCH` do not yet check ownership — this is a known gap, not an oversight to
silently fix without flagging it (see `TODO.md` → "Test" section).

**itemsDb.create/replace/update use Prisma relation `connect`**, not raw FK
assignment (`category: { connect: { id } }` not `categoryId: id`) — keep this
pattern when touching that file, and keep `user.connect` as a sibling of
`category` in the `data` object, not nested inside it (a prior regression put
it inside `category` and broke every `POST /api/items` with a 500).

**Data model** (`prisma/schema.prisma`): `User` (role enum `ADMIN`/`EDITOR`/
`VIEWER`, default `VIEWER`) 1—N `Item`; `Item` N—1 `Category`; `Item.userId`
is optional (items can exist without an owning user).

**Health check** (`GET /health` in `app.js`, not under `src/routes/`): pings
`prisma.$queryRaw\`SELECT 1\`` to verify DB connectivity, not just process
liveness. Returns `200` + `db:"connected"` or `503` + `db:"disconnected"` +
`status:"error"`; also includes `version` (from `package.json`) and
`uptime`. This is what both the CD smoke test and (eventually, Week 8)
UptimeRobot poll — don't change its response shape without checking those
consumers.

## CI/CD (`.github/workflows/`)

**`ci.yml`** — triggers on push to `main` and on PRs targeting `main`; three
independent/parallel jobs (no `needs:` between them): `lint` (`npm run
lint`), `test` (spins up a `postgres:15-alpine` **service container**,
generates a `.env.test` file on the fly from the `TEST_DATABASE_URL` repo
secret before `npm test` — `jest.setup.js` requires an actual file to exist,
setting only `process.env` isn't enough), and `build` (`docker build`, no
push). Required secret: `TEST_DATABASE_URL`.

**`deploy.yml`** — triggers only on push to `main`; POSTs to a Render deploy
hook (`RENDER_DEPLOY_HOOK` secret, called with `curl -sf` — the `-f` matters,
plain `curl` returns exit 0 even on an HTTP error response, which would
silently mask a broken hook), waits 60s, then polls `/health` every 15s (12
tries) for a `200`. Target URL comes from the `RENDER_SERVICE_URL` repo
*variable* with a hardcoded fallback (`https://http-lab.onrender.com`) if
unset. Both secrets/vars are injected via a step's `env:` block, not
interpolated directly into `run:` — keep that pattern for new steps.

**ESLint** (`eslint.config.js`, flat config, ESLint 10 + `@eslint/js`):
`no-unused-vars` is relaxed with `{ args: 'none', caughtErrors: 'none' }`
because this codebase's idiom is `catch (err) { return res.status(...).json(...) }`
without using `err` — that's intentional style here, not something to "fix"
by adding logging or renaming to `_err`.

## Known rough edges (intentionally not auto-fixed)

`PUT`/`PATCH /api/items/:id` don't check ownership (only `DELETE` does) —
flagged in `TODO.md`, not silently patched.

Branch protection on `main` requires a PR but doesn't yet require CI to
pass, and is bypassable by admins — see "Roadmap status" above.
