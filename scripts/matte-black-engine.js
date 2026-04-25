import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.DATABASE_ID;

/**
 * THE MATTE BLACK IMAGE ENGINE
 * The core production pipeline for SelectStream assets.
 */
class ImageEngine {
  constructor() {
    this.outputDir = path.join('public', 'assets', 'stream');
    this.tempDir = path.join('public', 'assets', 'stream', 'temp');
    if (!fs.existsSync(this.tempDir)) fs.mkdirSync(this.tempDir, { recursive: true });
  }

  async run() {
    console.log("🚀 Starting Matte Black Image Engine (Cloud Sync Active)...");
    const products = await this.getProducts();
    
    for (const p of products) {
      if (!p.imageUrl) continue;
      console.log(`\n📦 Processing: ${p.title}`);
      
      const rawPath = await this.downloadImage(p.imageUrl, p.slug);
      if (rawPath) {
        // 1. Generate Site Asset (1:1 High-Performance WebP)
        const sitePath = await this.processSiteAsset(rawPath, p.slug);
        
        // 2. Generate Pinterest Asset (2:3 High-Contrast JPEG)
        const pinPath = await this.processPinterestAsset(rawPath, p.slug, p.title);

        // 3. Sync to Cloudinary
        await this.syncToCloud(sitePath, `${p.slug}-card`);
        await this.syncToCloud(pinPath, `${p.slug}-pin`);
      }
    }
    console.log("\n💎 Visual Infrastructure Synchronized with Cloudinary.");
  }

  async syncToCloud(filePath, publicId) {
    if (!process.env.CLOUDINARY_API_KEY) return;
    try {
      console.log(`   ☁️  Syncing: ${publicId}...`);
      await cloudinary.uploader.upload(filePath, {
        public_id: publicId,
        folder: 'selectstream/stream',
        overwrite: true,
        resource_type: 'image'
      });
      console.log(`   ✅ Cloud Ready: ${publicId}`);
    } catch (e) {
      console.error(`   ❌ Cloud Sync Failed: ${e.message}`);
    }
  }

  async getProducts() {
    const response = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({ 
        filter: { 
          or: [
            { property: 'Status', status: { equals: 'Live' } },
            { property: 'Status', status: { equals: 'Review' } }
          ]
        } 
      })
    });
    const data = await response.json();
    return data.results.map(page => {
      const p = page.properties;
      
      // 1. Primary: Main Image
      let imageUrl = p['Main Image']?.files[0]?.file?.url || p['Main Image']?.files[0]?.external?.url;
      
      // 2. Fallback: First image in Gallery Images
      if (!imageUrl && p['Gallery Images']?.files?.length > 0) {
        imageUrl = p['Gallery Images'].files[0]?.file?.url || p['Gallery Images'].files[0]?.external?.url;
        console.log(`   💡 Fallback: Using Gallery Image for ${p['Product Name']?.title[0]?.plain_text}`);
      }

      return {
        title: p['Product Name']?.title[0]?.plain_text,
        slug: p['Slug']?.rich_text[0]?.plain_text,
        imageUrl: imageUrl
      };
    });
  }

  async downloadImage(url, slug) {
    const dest = path.join(this.tempDir, `${slug}-raw.jpg`);
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(dest, buffer);
      return dest;
    } catch (e) {
      console.error(`   ❌ Download failed: ${e.message}`);
      return null;
    }
  }

  async processSiteAsset(inputPath, slug) {
    const outPath = path.join(this.outputDir, `${slug}-card.webp`);
    const mask = Buffer.from(`<svg><rect x="0" y="0" width="800" height="800" rx="8" ry="8"/></svg>`);

    await sharp(inputPath)
      .resize(800, 800, { fit: 'contain', background: '#0a0a0a' })
      .composite([{ input: mask, blend: 'dest-in' }])
      .webp({ quality: 85 })
      .toFile(outPath);
    console.log(`   ✅ Site Asset: ${outPath}`);
    return outPath;
  }

  async processPinterestAsset(inputPath, slug, title) {
    const outPath = path.join(this.outputDir, `${slug}-pin.jpg`);
    const width = 1000;
    const height = 1500;

    const overlay = Buffer.from(`
      <svg width="${width}" height="${height}">
        <rect x="0" y="${height - 300}" width="${width}" height="300" fill="#080808"/>
        <text x="50" y="${height - 150}" font-family="Helvetica" font-size="60" font-weight="900" fill="white">${title.toUpperCase()}</text>
        <text x="50" y="${height - 80}" font-family="Helvetica" font-size="20" fill="#444" letter-spacing="5">SELECTSTREAM SHOP</text>
      </svg>
    `);

    await sharp({
      create: { width, height, channels: 4, background: '#0a0a0a' }
    })
    .composite([
      { input: await sharp(inputPath).resize(900, 900, { fit: 'contain', background: '#0a0a0a' }).toBuffer(), top: 150, left: 50 },
      { input: overlay, top: 0, left: 0 }
    ])
    .jpeg({ quality: 90 })
    .toFile(outPath);
    console.log(`   ✅ Pinterest Asset: ${outPath}`);
    return outPath;
  }
}

new ImageEngine().run();
