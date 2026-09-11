# Contributing

Code standards live in [`docs/conventions/`](./docs/conventions/). Structural decisions and their
reasoning live in [`docs/architecture.md`](./docs/architecture.md). This document covers how work
moves through the repository.

## Branches

Three permanent branches:

| Branch    | Role                             | Receives                                                  |
| --------- | -------------------------------- | --------------------------------------------------------- |
| `develop` | Integration — **default branch** | Work branches, **by pull request**                        |
| `release` | Pre-production                   | `develop`, by direct merge, at every intermediate version |
| `main`    | Production                       | `release`, by direct merge, at every major version        |

Work branches are prefixed by intent, and carry a short description:

- `feat/…` — a new feature
- `fix/…` — a bug fix
- `chore/…` — configuration, tooling, anything not product code
- `refactor/…` — reshaping existing code without changing behaviour

They start from `develop` and return to it through a pull request. Nothing is written directly on
`develop`.

`release` and `main` are updated by the maintainer only. Merges into them are direct, not pull
requests, because they promote an already-reviewed state rather than introducing new work.

> **This differs from the reference conventions**, which describe two long-lived branches. The
> third, `release`, is deliberate: it exercises a three-stage promotion model — integration,
> pre-production, production — the way most companies run it. Every rule below assumes it.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/):

```
<type>[optional scope]: <description>

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `chore`, `refactor`, `test`, `style`, `wip`.

The scope names the area touched — a file (`fix(global.utils): …`), a section
(`fix(src/summoner/*): …`), or the whole project (`fix(*): …`).

The header stays within 100 characters, and the description neither starts with a capital letter
nor ends with a full stop: `fix(backend): handle the rate limit`.

The format is checked automatically: a malformed message is rejected before the commit exists, and
CI checks every commit of a pull request again.

## Pull requests

Open against `develop`. It is the default branch, so this happens on its own.

Before asking for review:

- the branch builds and the tests pass;
- there is no leftover debug output;
- you have read your own diff, start to finish.

Then:

- **one approval is required**, and nobody can approve their own pull request, so every change is
  read by someone else;
- **a new push dismisses existing approvals** — what was approved is what gets merged;
- **the `Verify` CI check must pass, on a branch up to date with `develop`**. When `develop` has
  moved on, use **Update branch** and let CI run again: two pull requests that pass on their own
  can still break once merged one after the other;
- **all conversations must be resolved** before merging — an unanswered remark is not a merged
  remark;
- the pull request description follows the template, and links the issue it closes.

Merges keep every commit: **no squashing**. The development steps are part of what the history is
for.

Once merged, the branch is deleted automatically. Its commits live on in `develop`.

## Releases

Promoting `develop` into `release` is an intermediate version. Promoting `release` into `main` is a
major version. Versions follow [Semantic Versioning](https://semver.org/) and **every version that
reaches `release` is tagged**.

The version lives in the root `package.json`, and it is raised **before** promoting:

- for an intermediate version, raise the MINOR number, through a pull request on `develop`;
- for a version meant for `main`, raise the MAJOR number the same way;
- for an urgent fix applied on `release` (see below), raise the PATCH number in a commit of its
  own, which is not carried back to `develop`. At the next promotion, git reports a conflict on
  that line: keep the version from `develop`.

On every push to `release`, CI verifies the commit, then creates the tag `v<version>`. It refuses
to reuse an existing tag: a promotion that forgot to raise the version fails, and is fixed by
raising it.

Tags are protected: they cannot be deleted or moved. A version tag that changes is a lie about what
was shipped.

## Urgent fixes

A fix that cannot wait is applied on `release`, then **cherry-picked back into `develop`** through
a pull request like any other change.

**Nothing enforces that back-port.** No branch rule can check it. If it is skipped, the fix
disappears the next time `develop` is promoted, and the bug returns — which is exactly how bugs
come back from the dead. If you fix something on `release`, carry it back the same day.

Where a fix must also reach production before the next major version, `release` is promoted to
`main` out of cycle.

## Secrets

**The Riot API key never enters a commit.** It lives in the environment file, which is ignored by
git.

GitHub's secret scanning does not recognise Riot key patterns, so it will not catch the mistake —
a pre-commit guard does instead, and CI runs it again over every commit of a pull request. Do not
bypass it.

A key that reaches a commit is compromised, even if the commit is removed afterwards: it remains in
the history, in forks and in clones. The only correct response is to **revoke it and generate a new
one**.

## Working together

- One person per issue. Pair when it helps, but the work stays assigned to one of you.
- Take an issue by assigning it to yourself, so nobody starts the same thing twice.
- Asking a question in review is a contribution. "I don't understand this function" is a legitimate
  remark, and usually means the code should be clearer.
- Do not approve what you have not understood.
