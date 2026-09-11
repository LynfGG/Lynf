/// <reference types="vite/client" />

// Adds our variables to Vite's own `ImportMetaEnv`. It must be an `interface`: an
// interface merges with Vite's declaration, whereas a `type` of the same name clashes.
interface ImportMetaEnv {
    readonly VITE_API_BASE_URL?: string;
}
