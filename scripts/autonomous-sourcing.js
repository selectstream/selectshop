import 'dotenv/config';
import { Client } from '@notionhq/client';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

const notion = new Client({ auth: process.env.NOTION_TOKEN });

/**
 * AUTONOMOUS SOURCING ENGINE
 * Replaces manual browser extensions with direct-to-Cloudinary logic.
 */
async function sourceProductImage(url, slug, pageId) {
  console.log(`🔍 Sourcing high-res assets from: ${url}`);
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const html = await response.text();
    
    // Improved regex to catch data-src, hi-res Amazon variants, and standard srcs
    const imgRegex = /(?:src|data-src|data-old-hires|data-a-dynamic-image)="([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/gi;
    let matches = [];
    let match;
    while ((match = imgRegex.exec(html)) !== null) {
      matches.push(match[1]);
    }
    
    // Cleanup Amazon's dynamic image JSON if found
    matches = matches.flatMap(m => {
      if (m.startsWith('{')) {
        try {
          return Object.keys(JSON.parse(m.replace(/&quot;/g, '"')));
        } catch (e) { return []; }
      }
      return m;
    });

    matches = Array.from(new Set(matches));
    
    console.log(`📦 Found ${matches.length} potential images. Evaluating candidates...`);
    
    const candidates = [];
    for (const imgUrl of matches) {
      try {
        // 1. Skip obvious non-product images
        if (imgUrl.includes('logo') || imgUrl.includes('icon') || imgUrl.includes('avatar') || imgUrl.includes('sprite')) continue;

        // 2. Fetch metadata (we need to download a small portion or the whole buffer)
        const res = await fetch(imgUrl);
        const buffer = Buffer.from(await res.arrayBuffer());
        const metadata = await sharp(buffer).metadata();

        // 3. Scoring Engine Logic
        let score = 0;
        
        // A. Resolution Score (Higher is better, but cap it to avoid overly heavy assets)
        const pixels = metadata.width * metadata.height;
        if (pixels > 1000000) score += 50; // > 1MP
        if (pixels > 2000000) score += 30; // > 2MP
        
        // B. Aspect Ratio Match
        const ratio = metadata.width / metadata.height;
        const isSquare = Math.abs(ratio - 1) < 0.1;
        const isPinterestVertical = Math.abs(ratio - 0.66) < 0.1;
        
        if (isSquare) score += 40; // Perfect for site cards
        if (isPinterestVertical) score += 40; // Perfect for pins
        if (ratio > 1.5 || ratio < 0.5) score -= 50; // Ignore extreme banners/strips

        // C. Relevance (Keyword matching in URL)
        const urlKeywords = slug.split('-');
        const matchesKeywords = urlKeywords.filter(k => imgUrl.toLowerCase().includes(k)).length;
        score += (matchesKeywords * 10);

        candidates.push({ url: imgUrl, score, metadata, buffer });
      } catch (e) {
        // Skip invalid images
      }
    }

    // Sort by highest score
    candidates.sort((a, b) => b.score - a.score);
    const bestCandidate = candidates[0];

    if (!bestCandidate || bestCandidate.score < 30) {
      console.error("❌ No suitable high-quality images met the relevance threshold.");
      return;
    }

    console.log(`🎯 Best Asset Identified: ${bestCandidate.url} (Score: ${bestCandidate.score})`);
    
    // Process & Upload
    const tempPath = path.join('public', 'assets', 'stream', 'temp', `${slug}-raw.jpg`);
    fs.writeFileSync(tempPath, bestCandidate.buffer);

    // Sync to Cloudinary via the Matte Black Engine standards
    const cloudinaryResult = await cloudinary.uploader.upload(tempPath, {
      public_id: `${slug}-raw`,
      folder: 'selectstream/stream/raw',
      overwrite: true
    });

    console.log(`✅ Cloudinary Raw Sync: ${cloudinaryResult.secure_url}`);

    // Update Notion if pageId is provided
    if (pageId) {
      await notion.pages.update({
        page_id: pageId,
        properties: {
          'Main Image': {
            files: [{
              name: `${slug}-image`,
              external: { url: cloudinaryResult.secure_url }
            }]
          }
        }
      });
      console.log(`✅ Notion "Main Image" Updated.`);
    }

  } catch (error) {
    console.error(`❌ Sourcing Failed: ${error.message}`);
  }
}

// CLI Entry
const [url, slug, pageId, manualImageUrl] = process.argv.slice(2);

if (manualImageUrl && slug) {
  console.log(`🎯 Manual Override Active: Syncing asset from direct URL.`);
  syncManualAsset(manualImageUrl, slug, pageId);
} else if (url && slug) {
  sourceProductImage(url, slug, pageId);
} else {
  console.log("Usage: node scripts/autonomous-sourcing.js <URL> <Slug> [NotionPageId] [ManualImageUrl]");
}

async function syncManualAsset(imgUrl, slug, pageId) {
  try {
    const res = await fetch(imgUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': new URL(imgUrl).origin
      }
    });
    const buffer = Buffer.from(await res.arrayBuffer());
    const tempPath = path.join('public', 'assets', 'stream', 'temp', `${slug}-raw.jpg`);
    fs.writeFileSync(tempPath, buffer);

    const cloudinaryResult = await cloudinary.uploader.upload(tempPath, {
      public_id: `${slug}-raw`,
      folder: 'selectstream/stream/raw',
      overwrite: true
    });

    console.log(`✅ Cloudinary Manual Sync: ${cloudinaryResult.secure_url}`);

    if (pageId) {
      await notion.pages.update({
        page_id: pageId,
        properties: {
          'Main Image': {
            files: [{
              name: `${slug}-image`,
              external: { url: cloudinaryResult.secure_url }
            }]
          }
        }
      });
      console.log(`✅ Notion "Main Image" Updated.`);
    }
  } catch (error) {
    console.error(`❌ Manual Sync Failed: ${error.message}`);
  }
}
