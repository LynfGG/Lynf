# Conventions

These conventions apply to the whole repository. They take precedence over personal preference and
over whatever a tool suggests by default.

## Principles

Two rules outrank everything else here:

- **Don't Repeat Yourself.**
- **Keep It Simple, Stupid.**

When a rule below conflicts with either of them on a concrete case, say so in review rather than
applying it mechanically.

## Where things live

| Topic                                    | Document                                       |
| ---------------------------------------- | ---------------------------------------------- |
| TypeScript, formatting, linting          | [typescript.md](./typescript.md)               |
| Back end (NestJS)                        | [nestjs.md](./nestjs.md)                       |
| Front end (React)                        | [react.md](./react.md)                         |
| Internationalisation                     | [i18n.md](./i18n.md)                           |
| Branches, commits, pull requests         | [../../CONTRIBUTING.md](../../CONTRIBUTING.md) |
| Structural decisions and their reasoning | [../architecture.md](../architecture.md)       |

## Enforcement

Wherever a convention can be checked by a machine, it is: ESLint, Prettier, commitlint and CI carry
most of what follows. Review is for what tooling cannot judge — naming that misleads, logic that
does not hold, a component that does too much.

A rule that a tool enforces is applied. A rule that only lives in a document is hoped for.
