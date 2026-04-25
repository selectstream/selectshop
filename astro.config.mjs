import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';

// Primary: Vercel | Fallback: Netlify
const platform = process.env.DEPLOY_PLATFORM || (process.env.VERCEL ? 'vercel' : 'vercel'); // Defaulting to Vercel
const adapter = platform === 'netlify' ? netlify() : vercel();

console.log(`🚀 Deployment Mode: ${platform.toUpperCase()}`);

export default defineConfig({
  site: 'https://selectstreamshop.com',
  output: 'server',
  adapter: adapter,
  integrations: [sitemap()],
  // Ensure Cloudinary is whitelisted for Astro's optimized Image component
  image: {
    domains: ['res.cloudinary.com'],
  }
});
