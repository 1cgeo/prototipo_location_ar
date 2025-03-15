// vite.config.ts
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import viteCompression from 'vite-plugin-compression'
import { fileURLToPath } from 'url'
import path from 'path'
import { readFileSync } from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  
  // Configuração para GitHub Pages - obtém o nome do repositório do package.json
  // Usando readFileSync em vez de require para compatibilidade ESM
  const packageJson = JSON.parse(
    readFileSync('./package.json', 'utf-8')
  )
  const repoName = packageJson.name
  
  return {
    // Define a base path de acordo com o nome do repositório no GitHub
    base: mode === 'production' ? `/${repoName}/` : '/',
    
    plugins: [
      react({
        jsxImportSource: '@emotion/react',
        babel: {
          plugins: ['@emotion/babel-plugin']
        }
      }),
      viteCompression()
    ],
    server: {
      port: 3000,
      // Alteração: usando objeto https em vez de boolean simples
      https: {
        // Usando opções vazias permite o uso de certificados auto-assinados
        // que o Vite gerará automaticamente
      },
      host: true,  // Permite acesso de outros dispositivos na rede local
    },
    build: {
      outDir: 'dist', // GitHub Pages recomenda usar dist
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-core': ['react', 'react-dom', 'react-router-dom'],
            'vendor-mui': [
              '@mui/material',
              '@mui/icons-material',
              '@emotion/react',
              '@emotion/styled'
            ],
            'vendor-ar': ['zustand', 'zod']
          }
        }
      },
      sourcemap: mode === 'development',
      chunkSizeWarningLimit: 1000,
      target: 'esnext',
      minify: 'esbuild'
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@components': path.resolve(__dirname, './src/components'),
        '@features': path.resolve(__dirname, './src/features'),
        '@hooks': path.resolve(__dirname, './src/hooks'),
        '@lib': path.resolve(__dirname, './src/lib'),
        '@services': path.resolve(__dirname, './src/services'),
        '@stores': path.resolve(__dirname, './src/stores'),
        '@types': path.resolve(__dirname, './src/types'),
        '@utils': path.resolve(__dirname, './src/utils'),
        '@routes': path.resolve(__dirname, './src/routes'),
        '@assets': path.resolve(__dirname, './src/assets')
      }
    }
  }
})