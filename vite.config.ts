import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// Определяем тип сборки из переменной окружения
const target = process.env.TARGET || 'popup';

// Базовая конфигурация
const baseConfig = {
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
};

// Конфигурации для разных целей
const configs = {
  popup: defineConfig({
    ...baseConfig,
    root: '.',
    plugins: [
      react({
        jsxRuntime: 'automatic',
      }),
    ],
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
        },
      },
    },
  }),

  background: defineConfig({
    ...baseConfig,
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
    },
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      sourcemap: true,
      lib: {
        entry: resolve(__dirname, 'src/app/scripts/background/background.ts'),
        name: 'MocklyBackground',
        formats: ['iife'],
        fileName: () => 'background.js',
      },
      rollupOptions: {
        output: {
          dir: 'dist/assets',
        },
      },
    },
  }),

  content: defineConfig({
    ...baseConfig,
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
    },
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      sourcemap: true,
      lib: {
        entry: resolve(__dirname, 'src/app/scripts/content/content.ts'),
        name: 'MocklyContent',
        formats: ['iife'],
        fileName: () => 'content.js',
      },
      rollupOptions: {
        output: {
          dir: 'dist/assets',
        },
      },
    },
  }),

  interceptor: defineConfig({
    ...baseConfig,
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
    },
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      sourcemap: true,
      lib: {
        entry: resolve(__dirname, 'src/app/scripts/interceptor/interceptor.ts'),
        name: 'MocklyInterceptor',
        formats: ['iife'],
        fileName: () => 'interceptor.js',
      },
      rollupOptions: {
        output: {
          dir: 'dist/assets',
        },
      },
    },
  }),
};

export default configs[target as keyof typeof configs] || configs.popup;