import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Change 'prompt-battle' to match your GitHub repo name
const BASE = process.env.GITHUB_ACTIONS ? '/prompt-battle/' : '/';

export default defineConfig({
  plugins: [react()],
  base: BASE,
});
