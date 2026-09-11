# TypeScript

## Naming

- **Files and directories**: `kebab-case`.
- **Types and interfaces**: `PascalCase`.
- **Variables**: descriptive, no abbreviations. `emailMatchingUser`, not `emu`.
- **Booleans**: prefixed with `is`, `has`, `can` or `should` — `isActive`, `hasPermission`,
  `canEdit`, `shouldDisplay`. The prefix says both what it means and what type it is.

## Type inference

Prefer inference to explicit annotations. An explicit return type that merely repeats what the
compiler already knows is noise that can drift out of sync with the body.

```ts
// Good
function getUsername(firstName: string, lastName: string) {
    return `${firstName}.${lastName}`;
}

// Avoid — the return type adds nothing
function getUsername(firstName: string, lastName: string): string {
    return `${firstName}.${lastName}`;
}
```

Annotate where inference is genuinely absent or wrong: public API boundaries whose shape must not
change silently, and anything the compiler widens further than intended.

## No `enum`

TypeScript's `enum` emits runtime code and behaves unlike the rest of the language. Use a `const`
object instead, prefixed with `E`:

```ts
const EUserRole = {
    ADMIN: 'admin',
    USER: 'user',
    PROJECT_MANAGER: 'project_manager',
} as const;

type EUserRole = (typeof EUserRole)[keyof typeof EUserRole];
```

## No `any`

`any` disables the compiler exactly where a type is hardest to work out — which is where the help
was needed. When a type is genuinely unknown, use `unknown` and narrow it.

If `any` looks like the only way out, that is a question for review, not a silent decision.

## Compiler configuration

`strict` and `noImplicitAny` are on. Nothing beyond `strict` for now: stricter flags produce
errors on code that reads as correct, and the value is not worth the confusion at this stage.

## Formatting

Prettier owns formatting. Never argue about it in review.

```json
{
    "semi": true,
    "singleQuote": true,
    "trailingComma": "all",
    "printWidth": 100,
    "tabWidth": 4,
    "bracketSpacing": true,
    "endOfLine": "lf"
}
```

## Linting

ESLint enforces the rules above that a machine can check, so they never have to be raised by a
human reviewer:

| Rule                                 | Enforces                               |
| ------------------------------------ | -------------------------------------- |
| No `TSEnumDeclaration`               | The `enum` ban above                   |
| `@typescript-eslint/no-explicit-any` | The `any` ban above                    |
| `no-console`                         | No debug output left in committed code |
| Filename casing                      | `kebab-case` file names                |

Lint and formatting run on staged files at commit time, and again in CI on every pull request.
