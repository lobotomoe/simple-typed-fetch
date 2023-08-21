import { defineConfig } from 'tsup'

export default defineConfig([
    {
        entry: ['src/index.ts'],
        platform: 'neutral',
        format: ['esm', 'cjs'],
        sourcemap: true,
        minify: true,
        outDir: 'dist',
        dts: true,
        clean: true,
        shims: true,
    }, {
        entry: ['src/browser.ts'],
        platform: 'browser',
        globalName: 'stf',
        format: 'iife',
        sourcemap: true,
        minify: true,
        outDir: 'dist',
        dts: true,
        clean: true,
        shims: true,
    },
])