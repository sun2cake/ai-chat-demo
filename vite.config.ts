import vue from '@vitejs/plugin-vue'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiKey = env.DIFY_API_KEY

  return {
    plugins: [vue()],
    server: {
      proxy: {
        '/dify-api': {
          target: 'https://api.dify.ai',
          changeOrigin: true,
          headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
          rewrite: (path) => path.replace(/^\/dify-api/, '')
        }
      }
    }
  }
})
