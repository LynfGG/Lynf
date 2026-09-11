# Lynf

League of Legends statistics, backed by the Riot API: look a player up by their Riot ID and read
their profile.

> **Work in progress.** The skeleton and one reference feature are in place. Everything else is
> ahead.

## Stack

TypeScript throughout — **NestJS** on the back end, **React** with Vite on the front end,
**PostgreSQL** with Drizzle for storage, **pnpm** workspaces to hold it together.

## Requirements

| Tool   | Version                                                 |
| ------ | ------------------------------------------------------- |
| Node   | 22, as in `.nvmrc` — 22.13 at least                     |
| pnpm   | 12.3.4, as pinned by `packageManager` in `package.json` |
| Docker | any recent version, for PostgreSQL only                 |

You also need a **Riot API key**, from [developer.riotgames.com](https://developer.riotgames.com).
A development key **expires every 24 hours**, so expect to regenerate it daily.

## Editor

The repository is set up for **VS Code**:

- install the extensions it recommends when prompted;
- when it offers to use the workspace's TypeScript version, accept — the editor then checks the
  code with the same compiler as the command line and CI;
- files are formatted, and ESLint fixes applied, every time you save.

## Running it

```bash
# 1. Install
pnpm install

# 2. Configure — then open .env and paste your Riot API key
cp .env.example .env

# 3. Start PostgreSQL
docker compose up -d

# 4. Create the tables
pnpm --filter @lynf/backend db:migrate

# 5. Run both applications
pnpm dev
```

- Front end: <http://localhost:5173>
- API documentation: <http://localhost:3000/docs>

## Checks

```bash
pnpm lint          # ESLint
pnpm format:check  # Prettier
pnpm typecheck     # TypeScript, every workspace
pnpm test          # Back-end tests
pnpm i18n:check    # English and French hold the same keys
pnpm build         # Build everything
```

CI runs all of these on every pull request and on every push to a permanent branch. It runs the
tests as `pnpm test:cov`, which also fails below 85% coverage on services and repositories. Nothing
merges red.

### The repository tests

They run against a real database, and are **skipped** unless `DATABASE_TEST_URL` is set. To run
them locally, create and migrate a separate test database once:

```bash
docker compose exec postgres createdb -U lynf lynf_test
DATABASE_URL=postgres://lynf:lynf@localhost:5432/lynf_test pnpm --filter @lynf/backend db:migrate
```

Then:

```bash
DATABASE_TEST_URL=postgres://lynf:lynf@localhost:5432/lynf_test pnpm test
```

**Never point it at your development database**: the suite empties its tables. It refuses any
database whose name does not end in `_test`.

## Documentation

|                                          |                                                  |
| ---------------------------------------- | ------------------------------------------------ |
| Structural decisions and their reasoning | [`docs/architecture.md`](./docs/architecture.md) |
| Branches, commits, pull requests         | [`CONTRIBUTING.md`](./CONTRIBUTING.md)           |
| Code standards                           | [`docs/conventions/`](./docs/conventions/)       |

## Licence

[MIT](./LICENSE).

---

Lynf isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone
officially involved in producing or managing Riot Games properties. Riot Games, and all associated
properties are trademarks or registered trademarks of Riot Games, Inc.
