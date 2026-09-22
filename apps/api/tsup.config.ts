import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/node.ts'],
  format: ['esm'],
  target: 'node22',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // @tp/shared ships raw TypeScript, so it has to be bundled rather than externalised.
  noExternal: ['@tp/shared'],
})
