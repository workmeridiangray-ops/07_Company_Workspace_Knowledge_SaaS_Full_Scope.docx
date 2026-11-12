import { defineConfig } from 'vitest/config';
import path from 'node:path';
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname), 'server-only': path.resolve(__dirname, 'tests/empty.ts') } },
  test: { environment: 'node', setupFiles: ['tests/setup.ts'], include: ['tests/**/*.test.ts'], pool: 'forks', env: { DATABASE_FILE: ':memory:', NODE_ENV: 'test' } },
});
