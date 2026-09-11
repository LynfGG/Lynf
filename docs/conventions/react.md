# React

## Stack

Entries marked _(when needed)_ are not required — a screen may not need them at all. But when the
capability is needed, use what is listed here rather than introducing an alternative.

- **Router**: React Router
- **Server state**: TanStack Query
- **Styling**: Tailwind CSS
- **Headless components**: Headless UI, TanStack Table
- **Forms** _(when needed)_: Formik and Yup
- **Icons** _(when needed)_: Lucide
- **Dates** _(when needed)_: `date-fns`

## Folder layout

```
src/
├─ api/               raw HTTP calls
├─ assets/
│  ├─ fonts/
│  └─ images/
├─ components/
│  ├─ features/
│  └─ ui/
├─ constants/
├─ hooks/
├─ i18n/
├─ providers/
├─ routes/
├─ utils/
├─ app.tsx
└─ main.tsx
```

React JSX files use the `.tsx` extension. Group by feature or domain wherever possible.

### `api/` and `hooks/`

- **`api/`** holds functions that talk to the server and know nothing about React. They are
  testable on their own and usable outside a component.
- **`hooks/`** holds the TanStack Query hooks that wrap them. Every hook file is named `use-….ts`
  and lives here — never beside a component.

## Routing

Routes are declared **explicitly** in `app.tsx` with `createBrowserRouter`. The `routes/` tree
mirrors the URLs, but nothing derives routing from the file system: the complete list of routes
must be readable in one place.

Inside `routes/`:

- pages are named `page.tsx`, and the component carries the `Page` suffix — `LoginPage`,
  `AccountPage`;
- shared layouts are named `layout.tsx`, component suffixed `Layout`;
- loading states are named `loading.tsx`, component suffixed `Loading`;
- a sub-folder is named after the URL segment it represents;
- a folder representing one object of a domain is named `details`.

```
src/routes/
├─ matches/
│  ├─ details/
│  │  ├─ layout.tsx
│  │  ├─ loading.tsx
│  │  └─ page.tsx          /matches/:matchId
│  ├─ loading.tsx
│  └─ page.tsx             /matches
└─ layout.tsx
```

A component extracted from a page may sit next to it — **unless** it is used in more than one
place, in which case it moves to `components/features/`.

## Components

Function components, default export, `PascalCase`:

```tsx
export default function MyComponent() {
    // ...
}
```

### Order inside a component

1. Type definitions
2. Constants
3. State and hooks
4. Derived variables
5. Effects
6. Event handlers
7. Render

```tsx
type ExampleComponentProps = {
    title?: string;
};

const DEFAULT_TITLE = 'Hello';

export default function ExampleComponent({ title }: ExampleComponentProps) {
    const [count, setCount] = useState(0);

    const pageTitle = title || DEFAULT_TITLE;

    useEffect(() => {
        document.title = pageTitle;
    }, [pageTitle]);

    const handleClick = () => setCount((previous) => previous + 1);

    return <button onClick={handleClick}>{count}</button>;
}
```

### Reusable first

Before writing a new component, look for one that already covers the need — even partially — in
`components/ui` and `components/features`, and extend it rather than duplicating.

Where it goes:

- **`components/ui/`** — presentational, domain-agnostic, no business logic: `Button`, `Card`,
  `Modal`, `DataTable`. They receive data and callbacks; they never fetch, mutate, or know about
  domain models.
- **`components/features/`** — reusable across routes but tied to a domain: `SummonerCard`,
  `RankBadge`.
- **Local, beside the page** — only while used in a single place. As soon as a second use appears,
  promote it.

**When duplication appears a second time, refactor.** Waiting for the third occurrence only makes
the abstraction more expensive.

Design rules:

- Any label, colour, icon, callback or style variant that could differ between uses is a prop, with
  a sensible default.
- Prefer `children` and slots over a growing list of boolean flags.
- Interactive components support both controlled and uncontrolled use, via optional `value` /
  `onChange` with internal fallback state.
- Variants go through a `variant` / `size` prop, not a forked component.
- Accessibility — ARIA attributes, keyboard handling, focus management — is part of the component,
  not re-implemented at each call site.

```tsx
// Avoid — hardcoded label, colour and handler
export default function DeleteMatchButton() {
    return (
        <button className="bg-red-600 text-white" onClick={deleteMatch}>
            Delete match
        </button>
    );
}

// Prefer — a generic Button consumed by the feature
<Button variant="danger" onClick={deleteMatch}>
    Delete match
</Button>;
```

### Size

A component file over 300 lines is doing too much. Split it.

## Anti-patterns

### State is read-only

| Operation    | Avoid               | Prefer                                            |
| ------------ | ------------------- | ------------------------------------------------- |
| Add          | `arr.push(item)`    | `[...arr, item]`                                  |
| Add at start | `arr.unshift(item)` | `[item, ...arr]`                                  |
| Remove       | `arr.splice(i, 1)`  | `arr.filter((_, index) => index !== i)`           |
| Update       | `arr[i] = next`     | `arr.map((x, index) => (index === i ? next : x))` |
| Sort         | `arr.sort()`        | `[...arr].sort()`                                 |
| Reverse      | `arr.reverse()`     | `[...arr].reverse()`                              |

### Do not derive state in an effect

Compute during render instead — an effect costs an extra render pass for nothing.

```tsx
// Avoid
const [fullName, setFullName] = useState('');
useEffect(() => {
    setFullName(`${firstName} ${lastName}`);
}, [firstName, lastName]);

// Prefer
const fullName = `${firstName} ${lastName}`;
```

### Do not put visible reactions in an effect

Toasts, alerts and modals belong in the event handler that caused them, not in an effect watching
state.

```tsx
// Avoid
useEffect(() => {
    if (match.isSaved) showNotification('Saved');
}, [match]);

// Prefer
function handleSaveClick() {
    saveMatch(match);
    showNotification('Saved');
}
```

### Never copy server state into local state

TanStack Query is the single source of truth. Copying its data into `useState` reintroduces every
synchronisation bug the library exists to remove.

```tsx
// Avoid
const { data } = useQuery({ queryKey: ['matches'], queryFn: fetchMatches });
const [matches, setMatches] = useState([]);
useEffect(() => {
    setMatches(data);
}, [data]);

// Prefer
const { data: matches } = useQuery({ queryKey: ['matches'], queryFn: fetchMatches });
```

### Promises passed to `use()` are never created during render

Creating one inline builds a new promise on every render, which loops forever. Pass it from props,
context or state.

### `useFormStatus` belongs in a child of `<form>`

Called in the same component that renders the `<form>`, it always reports `false`.

```tsx
function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <button type="submit" disabled={pending}>
            Submit
        </button>
    );
}
```

## Third-party imports

Prefix imports from headless libraries with the library name, for clarity and to avoid collisions:

```ts
import {
    Checkbox as HeadlessUICheckbox,
    CheckboxProps as HeadlessUICheckboxProps,
} from '@headlessui/react';
```

Lucide icons are imported with the `Icon` suffix.

## Test identifiers

End-to-end tests are not in place yet, so **no test identifiers are added for now**. When Cypress
arrives, they follow this pattern, in `kebab-case`:

```
<feature>-<section>-<element>
```
