import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    // 与 tsconfig.json 保持一致：@/ 始终指向 src/，用于跨包导入。
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    watch: {
      // 浏览器测试配置和参考工程会持续写入缓存文件，但它们并不是当前应用的源码。
      // 若让 Vite 监听这些目录，浏览器扩展的一次后台更新就可能触发多次整页重载。
      ignored: [
        '**/.tools/**',
        '**/.edge-profile*/**',
        '**/.npm-cache/**',
        '**/reference/**',
      ],
    },
  },
});
