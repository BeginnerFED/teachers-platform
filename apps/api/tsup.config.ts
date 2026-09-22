import { defineConfig } from 'tsup'

export default defineConfig({
  // Vercel runs the bundled Hono app from dist/index.js. Bundling keeps Node ESM
  // from trying to resolve the extensionless imports in our TypeScript sources.
  entry: ['src/index.ts', 'src/node.ts'],
  format: ['esm'],
  splitting: false,
  target: 'node22',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // @tp/shared ships raw TypeScript, so it has to be bundled rather than externalised.
  noExternal: ['@tp/shared'],
})
