import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': root,
    },
  },
  test: {
    environment: 'node',
    fileParallelism: false,
    restoreMocks: true,
    testTimeout: 10000,
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'lib/**/*.{ts,tsx}'],
      exclude: [
        '**/*.test.{ts,tsx}',
        'app/layout.tsx',
        'app/(app)/layout.tsx',
        'app/(auth)/layout.tsx',
      ],
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: './coverage',
    },
  },
});
