/* eslint-disable no-undef */
/**
 * @type {import('vite').UserConfig}
 */
import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: __dirname,
  build: {
    outDir: 'dist',
    lib: {
      name: 'lib',
      entry: resolve(__dirname, 'src/index.js'),
      fileName: (format) => `lib.${format}.js`
    }
  }
});
