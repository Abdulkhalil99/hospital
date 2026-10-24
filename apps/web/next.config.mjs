import createNextIntlPlugin from 'next-intl/plugin';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');
const isDev = process.env.NODE_ENV === 'development';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Keep dev output separate from production builds. A failed `next build`
  // can leave partial artifacts in `.next`, and reusing that directory in
  // `next dev` causes missing server chunk errors like `Cannot find module
  // './9295.js'`.
  distDir: isDev ? '.next-dev' : '.next',
  experimental: {
    outputFileTracingRoot: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'),
    serverActions: { allowedOrigins: ['localhost:3001'] },
  },
};

export default withNextIntl(nextConfig);
