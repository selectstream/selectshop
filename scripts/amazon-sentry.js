import 'dotenv/config';

const AMAZON_TAG = process.env.AMAZON_ASSOCIATE_TAG || 'selectstream-20';

/**
 * AMAZON LINK SENTRY
 * The dedicated pipeline for ensuring 100% revenue integrity.
 */
async function runLinkSentry() {
  console.log(`📡 INITIATING AMAZON-TO-SITE SENTRY (Tag: ${AMAZON_TAG})`);

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
    id: p.id,
    title: p.properties['Product Name']?.title[0]?.plain_text,
    url: p.properties['Buy Link']?.url,
    status: p.properties['Status']?.status?.name
  })).filter(p => p.url?.includes('amazon.com'));

  console.log(`📊 Monitoring ${products.length} Amazon assets...\n`);

  for (const product of products) {
    console.log(`🔍 Auditing: ${product.title}`);
    
    try {
      const health = await checkLinkIntegrity(product.url);

      if (health.isBroken) {
        console.error(`   ❌ BROKEN LINK: ${product.title} (404/Dogs of Amazon)`);
        await flagLink(product.id, 'Broken Link (404)');
        continue;
      }

      if (!health.isAvailable) {
        console.warn(`   🚩 OUT OF STOCK: ${product.title} (Marking for Review)`);
        await flagLink(product.id, 'Out of Stock');
        continue;
      }

      if (!product.url.includes(`tag=${AMAZON_TAG}`)) {
        console.log(`   🛠️  REVENUE LEAK DETECTED: Injecting tag...`);
        const cleanUrl = sanitizeAmazonUrl(product.url);
        await updateLink(product.id, cleanUrl);
      }

      console.log(`   ✅ Link Verified & Secure.`);
    } catch (e) {
      console.error(`   ⚠️  Sentry Error for ${product.title}:`, e.message);
    }
  }

  console.log("\n🛰️  Amazon-to-Site Integrity Sync Complete.");
}

async function checkLinkIntegrity(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  const html = await res.text();
  
  return {
    isBroken: res.status === 404 || html.includes('Page Not Found'),
    isAvailable: !html.includes('Currently unavailable') && !html.includes('out of stock')
  };
}

function sanitizeAmazonUrl(url) {
  const asinMatch = url.match(/(?:\/dp\/|gp\/product\/|exec\/obidos\/ASIN\/|o\/ASIN\/)([A-Z0-9]{10})/i);
  const asin = asinMatch ? asinMatch[1] : null;
  return asin ? `https://www.amazon.com/dp/${asin}?tag=${AMAZON_TAG}` : url;
}

async function flagLink(pageId, reason) {
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
        'Notes': { rich_text: [{ text: { content: `⚠️ LINK SENTRY ALERT: ${reason}` } }] }
      }
    })
  });
}

async function updateLink(pageId, url) {
  await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28'
    },
    body: JSON.stringify({
      properties: { 'Buy Link': { url: url } }
    })
  });
}

runLinkSentry();
