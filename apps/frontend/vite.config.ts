import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [react(), tailwindcss()],
    // One .env for the whole repository, at its root. Vite only exposes variables
    // prefixed with VITE_ to the browser, so the Riot API key stays server-side.
    envDir: '../../',
    server: {
        port: 5173,
    },
});
