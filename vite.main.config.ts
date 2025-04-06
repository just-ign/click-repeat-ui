import { defineConfig } from 'vite';
import { builtinModules } from 'module';
import { resolve } from 'path';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      external: [
        ...builtinModules,
        // External native modules that shouldn't be bundled
        '@nut-tree-fork/nut-js',
      ],
      output: {
        format: 'commonjs',
      },
    },
    commonjsOptions: {
      ignoreDynamicRequires: true,
    },
    outDir: '.vite/build',
  },
  resolve: {
    // Make sure native modules are properly resolved
    alias: {
      '@nut-tree-fork/nut-js': resolve(__dirname, 'node_modules/@nut-tree-fork/nut-js'),
    },
  },
});
