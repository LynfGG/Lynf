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

### Data model

Seven tables, each earning its place for a specific reason rather than mirroring Riot's response
shapes one-to-one:

- **`summoners`** — one row per account and platform: profile icon, level, and `updatedAt`, the
  cache's own age. A puuid identifies an account on every platform, but the icon and level belong
  to one, hence the platform in the key.
- **`summoner_riot_ids`** — every Riot ID a profile has ever been found under, on one platform.
  Riot's lookup is forgiving — searching `Caps#EUW` returns the account Riot spells `Cäps#EUW` —
  so both the searched spelling and Riot's own are recorded; matching against Riot's spelling
  alone would miss the stored profile every time a player is searched as they typed it, fallback
  included.
- **`summoner_ranks`** — one row per queue a player is ranked in. A player ranked nowhere has no
  rows at all, which is why freshness cannot live in this table (see `summoner_resource_reads`
  below).
- **`summoner_masteries`** — one row per champion a player has mastery on, same reasoning as ranks:
  a player who never played has no rows, and that absence still has to be datable.
- **`summoner_resource_reads`** — when one Riot-backed resource of one account was last read, keyed
  by an opaque `resource` name (`'ranks'`, `'masteries'`, `'matches'`). Ranks and masteries can
  legitimately have zero rows, and that absence must still be datable or Riot would be asked again
  on every view — so the read date cannot live next to the resource's own rows, and must not become
  one column per resource on `summoners` either, which would grow a new column for every resource
  and couple repositories that have no business knowing about each other. One table, keyed by
  resource, holds every one of them instead.
- **`matches`** — one row per finished match, exactly as Riot reported it, written once and never
  updated. A match result never changes once the game is over, so there is no `updatedAt` here and
  no freshness check ever runs against this table.
- **`match_participants`** — ten rows per match on Summoner's Rift, more on a roster of a different
  size (Arena's eight teams of two). Deliberately **not** foreign-keyed to `summoners`, unlike
  every other puuid-bearing table here: the other nine players in a match are not accounts Lynf
  tracks, and requiring their presence in `summoners` would force creating a never-refreshed,
  never-looked-up profile for every opponent ever seen in a match. Its `runes` column is a
  nullable `jsonb`: a nested structure never queried by its insides in SQL, and nullable because
  the matches ingested before this column existed will never gain one — a match is immutable, so
  it is never re-read from Riot just to backfill a field it predates.
- **`match_timelines`** — one row per match, holding the four families extracted from `match-v5`'s
  timeline (per-minute frames, skill level ups, item events, kills), each its own `jsonb` column.
  Keyed and foreign-keyed on `matchId`, cascading with its match. No `updatedAt`, no TTL and no
  freshness check at all — not merely "not yet expired" like `matches`, but inapplicable: a
  timeline is immutable the instant it is extracted, so its mere presence is the only fact that
  matters. `ITEM_UNDO` is resolved away before a row is ever written, so an undone purchase or sale
  never reaches storage.

### Database access

**Drizzle** over an ORM with a heavier runtime: the SQL that runs is visible in the source, typing
holds up on non-trivial queries, and migrations are generated as plain SQL files that are committed
and reviewable.

Schemas are **centralised** in `src/database/schema/`. This is a deliberate exception to the
"everything a module needs lives in its folder" rule: the migration tooling requires a single
schema entry point, and fighting it to preserve the rule would cost more than the exception.

Writes go through transactions.

**A second, deliberate exception:** `SummonerRankRepository`, `SummonerMasteryRepository` and
`MatchRepository` each inject `SummonerResourceReadRepository`, which
[`docs/conventions/nestjs.md`](./conventions/nestjs.md) otherwise forbids outright — "a repository
depends on the database client only, never on another repository."

The rule exists to keep repositories independently testable and free of hidden coupling. It is
overridden here for two reasons, one shared by all three and one specific to ranks and masteries.

Shared: "when was this resource last read from Riot" is the same bookkeeping — one table,
`summoner_resource_reads` — for ranks, masteries and the match id list, keyed by an opaque
`resource` name. Reimplementing that table's read/write three times, once per repository, would
cost more than the exception.

Specific to ranks and masteries: `replaceAll` must date the read in the **same transaction** as the
rows it replaces. If those two writes ever landed in separate transactions, a failure between them
would leave rows stored but undated — and an undated resource is asked of Riot again on every
request, indefinitely, against a rate-limited key. `SummonerResourceReadRepository.write` accepts
the caller's own transaction for exactly this, so `replaceAll` can date the read as part of the one
transaction that writes the rows. The match id list has no single row of its own to co-write with —
matches are inserted one at a time, deliberately, so a later one failing never undoes an earlier one
— so `MatchRepository.markListRead` writes the date directly, and only once ingestion has run to
completion; see `summoner-match.service.ts`.

The alternative — moving the read/write of the date into the service layer, with the service
opening the transaction and passing it down to two repositories — was considered and rejected: it
would leak Drizzle's transaction type into every service that reads or writes a Riot-backed
resource, for three repositories, to preserve a rule whose purpose (independent testability) this
exception does not actually threaten — `SummonerResourceReadRepository` is still tested against a
real database like every other repository, and still depends on nothing but the database client
itself.

### Freshness and fallback

Profiles, ranks, masteries and the match id list each follow the exact same shape, factored once
into `withFreshnessFallback` (`summoner/utils/riot-freshness.utils.ts`) rather than reimplemented
by four services: serve what is stored if it is fresh enough; otherwise ask Riot, persist the
answer, and serve that; if Riot cannot answer, serve what is stored anyway, whatever its age.

Freshness is a duration per resource, configured, never hard-coded —
`SUMMONER_PROFILE_TTL_SECONDS`, `SUMMONER_RANKS_TTL_SECONDS`, `SUMMONER_MASTERIES_TTL_SECONDS`,
`SUMMONER_MATCHES_TTL_SECONDS` — each declared in the Zod schema of `config/environment.ts`,
mirrored in `.env.example`, and required at startup like every other environment variable.

Falling back on a stale answer is not unconditional. It only happens when all three hold: something
was actually stored before (there is no honest answer to fall back on otherwise — inventing "unranked"
for a Master player, or a profile that was never fetched, would be a lie, not a stale answer);
the failure came from Riot, not from something else (a database error must never be hidden behind a
stale answer); and it was not a 404 (a 404 means the account is gone, not that the data is merely
old — serving a stale answer would show a player who no longer exists).

### Deduplicated player resolution

`SummonerService` is the one place in the whole application that resolves a Riot ID into a puuid;
`resolvePlayer` is what ranks, masteries and matches each call for it, rather than every route
carrying its own byte-identical copy of the lookup.

A profile page fires its four routes at once, and for a player never looked up before, all four
would otherwise resolve the same Riot ID independently — four account-v1 calls and four
summoner-v4 calls against a key limited to a hundred calls per two minutes, for one page view. A
map of resolutions currently in flight, keyed by Riot ID, collapses that into one of each: a second
caller for the same key is handed the promise already running instead of starting another round
trip. The key is serialised with `JSON.stringify` rather than joined with a plain separator,
because `gameName` and `tagLine` arrive straight from a URL segment where `:` is legal — joining
with `:` let a `gameName` of `abc:d` with a `tagLine` of `efg` collide with a `gameName` of `abc`
and a `tagLine` of `d:efg`, two distinct, valid Riot IDs.

An entry is removed the moment its promise settles, on success or failure alike. It must not
outlive a failure: a mistyped Riot ID that stayed memoised would turn one 404 into a poisoned
entry answering every later attempt with the same 404 until the process restarts. It does not need
to outlive a success either — the resolution has already written the profile to storage, so the
very next lookup is answered by storage, not by this map. The map therefore never holds more than
the resolutions genuinely in flight right now, which is also what makes it safe to key on raw user
input: nothing in it outlives the request that put it there.

### A finished match is immutable; the list of them is not

`matches` and `match_participants` have no `updatedAt` and no TTL: once a match is stored it is
never asked of Riot again, because a finished match cannot change. That is what makes match history
tenable at all against a rate-limited key — the alternative is repaying the full cost of every
match on every visit.

What _does_ go stale is a different question: "has this player played since I last checked?" — the
_list_ of a player's recent match ids, not any match already stored. That list is governed by
`SUMMONER_MATCHES_TTL_SECONDS` through the same `withFreshnessFallback` shape ranks and masteries
use, dated in `summoner_resource_reads` under the resource `'matches'`. A stale list still costs
almost nothing to re-check: every id it returns is filtered against storage before Riot is asked
for a single match body, so re-reading a list where nothing changed costs one call and zero match
fetches.

This refines the original intention, recorded when match history was designed, that matches simply
"have no TTL" and therefore need no freshness handling at all. That was true of the match rows
themselves, but left an open question the code had to answer once it was built: how does the
application ever learn that a player has queued up again? `SUMMONER_MATCHES_TTL_SECONDS` is that
answer — it governs when the _list_ is re-read, never whether an already-stored match is re-read.

### The timeline: never at ingestion, once per match forever

`match-v5`'s timeline is the heaviest single call this application makes — 755 KB for a 28-minute
game — so it is never fetched while a profile or its match list loads, only when a caller
explicitly asks for one match's timeline. `MatchTimelineService` is storage-first the same way
`SummonerRankService` was made to be in the ranks fix: `match_timelines` is checked before Riot is
asked anything, and because a timeline cannot go stale once it exists, `withFreshnessFallback` does
not apply here at all — there is no TTL to fall back from, only "already extracted" or not yet.

Of the 755 KB, what is kept and stored is roughly a sixth of that as JSON text (measured on a real
match), and smaller still once Postgres's own `jsonb` compression is applied on disk. Positions,
live champion stats and per-event damage breakdowns are discarded at extraction; there is no
per-minute damage series, because Riot's timeline does not report one.

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

A stored profile is found again under the Riot ID **as it was searched**, not only as Riot writes it
— see `summoner_riot_ids` under [Data model](#data-model) — because matching the search against
Riot's spelling alone would miss that profile every time, fallback included.

**The key never enters a commit.** It lives only in the environment file. GitHub's secret scanning
does not recognise Riot key patterns, which is why the key guard exists.

## Legal notice

Riot requires the following text, verbatim, in a location readily visible to players. The interface
carries it in the footer, and it is **never translated**:

> Lynf isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or
> anyone officially involved in producing or managing Riot Games properties. Riot Games, and all
> associated properties are trademarks or registered trademarks of Riot Games, Inc.
