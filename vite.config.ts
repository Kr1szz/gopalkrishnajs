import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        target: 'es2022',
        chunkSizeWarningLimit: 600,     // three.js, loaded after the page is up
    },
});
