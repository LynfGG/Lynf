# Architecture

Lynf is a League of Legends statistics site backed by the Riot API: look a player up by their Riot
ID and read their profile.

This document records the structural decisions and, more importantly, the reasoning behind them.
Workflow rules — branches, commits, pull requests — live in [`CONTRIBUTING.md`](../CONTRIBUTING.md).
Code standards live in [`docs/conventions/`](./conventions/).

## Stack

TypeScript everywhere. **NestJS** on the back end, **React** with Vite on the front end,
**PostgreSQL** for storage, **pnpm** workspaces to tie them together.

## Repository layout

```
lynf/
├─ apps/
│  ├─ frontend/            React + Vite
│  └─ backend/             NestJS
├─ packages/
│  └─ shared/              types and constants shared by both
├─ docs/
├─ pnpm-workspace.yaml
├─ package.json
└─ docker-compose.yml
```

`packages/shared` declares the API contract once and both sides consume it, so a broken contract
surfaces **at compile time** instead of on screen. It holds **types and plain constants only** — no
classes, no decorators: the back end's DTOs are decorated classes and cannot cross the boundary, so
they implement the shared types rather than being exported. Because it exports constants, it is
compiled to `dist/`; `pnpm dev` builds it before starting the applications.

## Back end

```
apps/backend/src/
├─ config/            environment variable validation (Zod)
├─ database/          DatabaseModule and schema/ (Drizzle)
├─ riot/              the Riot external, its routing and its response types
├─ summoner/          player profile lookup
├─ app.module.ts
└─ main.ts
```

Every domain module follows the same folder layout — `controllers`, `services`, `repositories`,
`externals`, `decorators`, `dtos`, `enums`, `types`, `utils`, each created when first needed — and
the layers are not short-circuited: a controller never injects a repository.

### Externals

Lynf reads from two sources: our own database and the Riot API. The conventional three-layer chain
only accounts for the first, so external HTTP providers get their own component type.

An **external** depends on no service and no repository. It knows its HTTP client and its
configuration, nothing else, and it translates provider failures into NestJS exceptions — a Riot
404 becomes a `NotFoundException`, a rejected key a 502, a 429 is never swallowed. Every call has a
deadline. Business logic stays in the service, which decides _when_ to call and what to do with the
answer.

The Riot external lives in its own module rather than inside a domain module, because profiles,
match history and live games will all reach for it.

### Database access

**Drizzle** over an ORM with a heavier runtime: the SQL that runs is visible in the source, typing
holds up on non-trivial queries, and migrations are generated as plain SQL files that are committed
and reviewable.

Schemas are **centralised** in `src/database/schema/`. This is a deliberate exception to the
"everything a module needs lives in its folder" rule: the migration tooling requires a single
schema entry point, and fighting it to preserve the rule would cost more than the exception.

Writes go through transactions.

### Validation

Two validators coexist, with a clear boundary:

- **`class-validator`** for DTOs — HTTP input, validated on every request through a global
  `ValidationPipe`.
- **Zod** for configuration — environment variables, validated once at startup. Environment
  variables are always strings, so coercion matters; Zod handles it in one call and derives the
  config type from the schema.

The application **refuses to start** when a variable is missing, rather than failing on the first
request that needs it.

All routes are documented with Swagger decorators, error responses included.

## Front end

```
apps/frontend/src/
├─ api/               raw HTTP calls
├─ components/{features,ui}/
├─ constants/
├─ hooks/             TanStack Query hooks, use-….ts
├─ i18n/
├─ providers/
├─ routes/            page.tsx / layout.tsx
├─ app.tsx            createBrowserRouter and providers
└─ main.tsx
```

The other folders of the [React conventions](./conventions/react.md) — `assets/`, `utils/`,
`loading.tsx` — are created when first needed.

`api/` holds functions that talk to the server and know nothing about React, so they are testable
on their own and usable outside a component. The TanStack Query hooks that wrap them live in
`hooks/`.

Routes are declared **explicitly** in `app.tsx` with `createBrowserRouter`. The `routes/` tree
mirrors the URLs, but nothing derives routing from the file system: the full list of routes is
readable in one place.

The symmetry with the back end is intentional — `main` boots, `app` assembles, on both sides.

## Running locally

**PostgreSQL runs in Docker; both applications run on the host.** Hot reload stays immediate and
errors surface in the terminal, which containerising the whole stack would cost for no benefit at
this size.

Prerequisites and their exact versions are in the [README](../README.md).

## Internationalisation

**English and French, from the start.** No user-facing string is hardcoded: everything goes through
a key. There is one file per domain and language, and each file is an i18next namespace; keys inside
it are named `<screen or component>.<element>`. The language detector falls back to English, and the
interface carries a language switcher.

The obvious risk is the two files drifting apart. That is handled by the machine, not by
discipline: **CI compares the key sets of both languages and fails when one holds a key the other
does not.**

Right-to-left support is deliberately out of scope.

## Tooling and quality

pnpm workspaces, Prettier and ESLint configured at the root, husky and lint-staged for git hooks,
commitlint for commit message format.

Several conventions are **enforced by the linter rather than by review**: no TypeScript `enum`, no
`any`, no `console`, kebab-case filenames. A convention a machine checks is applied; a convention
that is only written down is merely hoped for.

The **pre-commit hook** runs lint, formatting, and a guard that rejects anything resembling a Riot
API key. It deliberately does **not** run the test suite: making every commit pay for the full
suite is the surest way to teach people to bypass the hook. Tests run in CI — and because a hook
can be bypassed, CI runs the key guard and commitlint again over every commit of a pull request.

## Testing

| Layer        | How                                                 | Why                                                                  |
| ------------ | --------------------------------------------------- | -------------------------------------------------------------------- |
| Services     | Unit, with repositories and externals stubbed       | This is where the logic lives                                        |
| Repositories | Against a real test database                        | Stubbing a database only proves the stub                             |
| Externals    | Stubbed HTTP responses, asserting error translation | A 404 must become a `NotFoundException`; a 429 must not be swallowed |
| Controllers  | No unit tests                                       | They delegate; route-level tests are planned                         |

Minimum coverage is **85% on back-end services and repositories** — not on the codebase as a whole,
since covering trivial code to reach a number proves nothing.

The front end has no tests yet. End-to-end coverage with Cypress is planned as its own piece of
work; the test-id naming convention is already documented so that adding it later is mechanical.

## Continuous integration

On every pull request, and on every push to `develop`, `release` and `main`: cached install,
formatting, lint, type check, translation key parity, back-end tests with coverage against a
Postgres service, and a build of both applications. On a pull request, every commit it brings is
also checked for Riot keys and for the commit message format.

On a push to `release`, once all of that passes, a second job creates the version tag. It is the
only job granted write access to the repository — the default workflow token is read-only — and a
release that fails verification is never tagged.

## Riot API constraints

These shape the architecture more than any preference:

- A development key **expires every 24 hours** and must be regenerated by hand.
- It **may not power a public product**, not even an open beta. A production key requires
  registering the project, showing a working prototype, and manual approval by Riot.
- Published rate limits differ between sources, so they are re-checked against the documentation
  before any rate limiter is written.

Two consequences:

**Persistence is mandatory.** Nothing displayed may depend on a Riot call succeeding right now.
Fetched data is stored, and the service decides whether what it has is fresh enough before reaching
out again. When Riot cannot refresh a profile — rejected key, rate limit, outage — the stored one is
served, whatever its age.

A stored profile is found again under the Riot ID **as it was searched**, not only as Riot writes it:
Riot's lookup is forgiving — searching `Caps#EUW` returns the account it writes `Cäps#EUW` — so
both forms are recorded. Matching the search against Riot's spelling alone would miss that profile
every time, fallback included.

**The key never enters a commit.** It lives only in the environment file. GitHub's secret scanning
does not recognise Riot key patterns, which is why the key guard exists.

## Legal notice

Riot requires the following text, verbatim, in a location readily visible to players. The interface
carries it in the footer, and it is **never translated**:

> Lynf isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or
> anyone officially involved in producing or managing Riot Games properties. Riot Games, and all
> associated properties are trademarks or registered trademarks of Riot Games, Inc.
