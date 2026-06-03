import { defineConfig } from 'vitest/config'

// Test runner config — separate from the extension build (vite.config.ts).
// Default environment is node (pure logic); DOM-dependent specs opt in with
// a `// @vitest-environment happy-dom` comment at the top of the file.
export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.ts'],
  },
})
