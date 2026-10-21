import {defineConfig} from 'vite';
import {crx} from '@crxjs/vite-plugin';
import manifest from './src/manifest';
export default defineConfig({plugins:[crx({manifest})],build:{target:'es2022',rollupOptions:{input:{dashboard:'src/dashboard/index.html',report:'src/report/index.html'}}}});
