/** Where the back end lives. Overridable at build time for other environments. */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
