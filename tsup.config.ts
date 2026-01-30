import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/cli/index.ts',
    'server/index': 'src/server/index.ts',
    'server/schema-watcher': 'src/server/schema-watcher.ts',
    'server/convex-client': 'src/server/convex-client.ts',
  },
  format: ['esm'],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  outDir: 'dist/cli',
  banner: ({ entryPoint }) => {
    if (entryPoint === 'src/cli/index.ts') {
      return { js: '#!/usr/bin/env node' };
    }
    return {};
  },
});
