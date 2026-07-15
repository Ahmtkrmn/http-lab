# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project purpose

`http-lab` is a learning project: the user is building it to grow into a senior
backend engineer, not shipping it as a product. The roadmap and current phase
live in `TODO.md` (in Turkish) — check it first to see what week/milestone is
active before starting work. `REFACTORING_DIARY.md` documents a completed SOLID
refactor (BEFORE/AFTER/NEDEN format) and `README.md` has the full feature list,
data model, and API table. Code comments in this repo are unusually dense
Turkish explanations of *why* a design decision was made (SRP/OCP/DIP notes) —
read them before changing the file, they usually explain a past bug or
regression that motivated the current shape.

When asked to advance the roadmap, act as a mentor: make the change, then
explain the architectural reasoning, not just the diff.

## Commands

```bash
npm install              # triggers `postinstall` -> prisma generate
npm run dev              # nodemon src/server.js (dev)
npm start                # node src/server.js (prod)

npm test                 # all tests, --runInBand --forceExit
npm run test:unit        # tests/unit only, no DB needed
npm run test:integration # tests/integration only, needs the test DB running
npm run test:coverage    # coverage report; enforced thresholds: 80/70/80/80 stmt/branch/fn/line

# single test file / single test name
npx jest tests/unit/tokenService.test.js
npx jest -t "name of the test"

npx prisma migrate dev   # create/apply a new migration (dev DB)
npx prisma migrate deploy
npx prisma studio
```

Tests run against a **real PostgreSQL database**, never mocks — `pretest`
auto-runs `db:migrate:test` (via `dotenv-cli -e .env.test`) before `npm test`.
`tests/testUtils/resetDb.js` truncates `Item` → `User` → `Category` (FK order)
before each integration test file. `.env.test` must point at a *separate* DB
from `.env` (default: `http_lab_test`) — it gets wiped on every run. If
`.env.test` is missing, `tests/jest.setup.js` throws an explicit setup error
instead of letting tests fail with cryptic `secretOrPrivateKey` errors.

Do **not** run `npx prisma migrate deploy` directly without `dotenv-cli` —
Prisma CLI defaults to reading `.env`, so an unscoped call applies migrations
to the dev DB instead of the test DB (this exact mistake happened once; see
`README.md` → "Bilinen Sorunlar").

## Architecture

**Request flow**: `server.js` (binds the port) → `app.js` (builds the Express
app, no side effects) → `requestLogger` → route → `authMiddleware` →
`itemsDb`/`prisma` → `errorHandler`. This app/server split exists specifically
so `app.js` can be `require`d by Supertest without opening a real port.

**Dependency direction (DIP)**: `src/db/prisma.js` exports a single lazily-
created `PrismaClient` singleton (via `@prisma/adapter-pg` + `pg.Pool`).
Every module that touches the DB (`routes/auth.js`, `store/itemsDb.js`) calls
`getPrismaClient()` — never construct a second `PrismaClient`/`Pool` anywhere;
a prior bug was two independent connection pools before this was centralized.

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

## Known rough edges (intentionally not auto-fixed)

`docker-compose.yml` currently hardcodes `DATABASE_URL` under the `app`
service's `environment:` block, which overrides whatever `.env` provides via
`env_file:` — and `db` publishes `5432:5432` to the host. Both are flagged as
Week 7 pre-work in `TODO.md`; don't silently "clean these up" as a drive-by —
they're an explicit lesson the user is meant to fix themselves unless asked.

ESLint is planned (Week 7) but not yet installed — don't assume lint tooling
exists.
