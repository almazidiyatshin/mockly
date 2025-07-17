import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
	root: '.',
	plugins: [
		react({
			jsxRuntime: 'automatic',
		}),
	],
	resolve: {
		alias: {
			'@': resolve(__dirname, 'src'),
		},
	},
	server: {
		port: 3005,
		strictPort: true,
		open: false,
	},
	build: {
		outDir: 'dist',
		emptyOutDir: true,
		sourcemap: true,
		rollupOptions: {
			input: {
				popup: resolve(__dirname, 'index.html'),
				background: resolve(__dirname, 'src/app/scripts/background.ts'),
				content: resolve(__dirname, 'src/app/scripts/content.ts'),
				injected: resolve(__dirname, 'src/app/scripts/injected.ts'),
			},
			output: {
				entryFileNames: 'assets/[name].js',
				chunkFileNames: 'assets/[name]-[hash].js',
				assetFileNames: 'assets/[name]-[hash][extname]',
			},
		},
	},
});
