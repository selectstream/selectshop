import 'dotenv/config';
import { spawn } from 'child_process';

async function stressTest() {
  console.log("🚀 INITIATING RECURSIVE SOURCING STRESS TEST...");
  
  const response = await fetch(`https://api.notion.com/v1/databases/${process.env.DATABASE_ID}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28'
    }
  });
  
  const data = await response.json();
  const products = data.results.map(p => ({
    title: p.properties['Product Name']?.title[0]?.plain_text,
    url: p.properties['Buy Link']?.url,
    slug: p.properties['Slug']?.rich_text[0]?.plain_text,
    id: p.id
  }));

  console.log(`📊 Found ${products.length} products to audit.\n`);

  const results = {
    success: 0,
    failed: 0,
    brokenLinks: []
  };

  for (const product of products) {
    // 1. Jitter Logic: Random delay (2-5 seconds) to mimic human behavior
    const delay = Math.floor(Math.random() * 3000) + 2000;
    
    if (product.url === 'https://amazon.com/' || !product.url) {
      console.warn(`⚠️  [FLAGGING] ${product.title}: Generic/Missing URL.`);
      await flagInNotion(product.id, 'Generic/Missing Link');
      results.failed++;
      results.brokenLinks.push(product.title);
      continue;
    }

    console.log(`\n⏳ Waiting ${delay}ms before auditing: ${product.title}...`);
    await new Promise(resolve => setTimeout(resolve, delay));

    console.log(`🔍 AUDITING: ${product.title}`);
    
    const success = await runSourcing(product.url, product.slug, product.id);
    if (success) {
      results.success++;
    } else {
      await flagInNotion(product.id, 'Sourcing Failed');
      results.failed++;
    }
  }

  console.log("\n--- 🏁 STRESS TEST COMPLETE ---");
  console.log(`✅ Success: ${results.success}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`🚩 Broken/Generic Links: ${results.brokenLinks.length}`);
  console.log("-------------------------------\n");
}

async function flagInNotion(pageId, reason) {
  try {
    await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        properties: {
          'Status': { status: { name: 'Review' } },
          'Notes': {
            rich_text: [{ text: { content: `⚠️ SYSTEM ALERT: ${reason}. Curation requires update.` } }]
          }
        }
      })
    });
    console.log(`   🚩 Flagged in Notion: ${reason}`);
  } catch (e) {
    console.error(`   ❌ Failed to flag in Notion: ${e.message}`);
  }
}

function runSourcing(url, slug, id) {
  return new Promise((resolve) => {
    const child = spawn('node', ['scripts/autonomous-sourcing.js', url, slug, id]);
    
    child.stdout.on('data', (data) => {
      process.stdout.write(`   ${data}`);
    });

    child.stderr.on('data', (data) => {
      process.stderr.write(`   ${data}`);
    });

    child.on('close', (code) => {
      resolve(code === 0);
    });
  });
}

stressTest();
