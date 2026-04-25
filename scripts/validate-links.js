import 'dotenv/config';

const AMAZON_TAG = process.env.AMAZON_ASSOCIATE_TAG || 'selectstream-20';

async function validateAffiliateLinks() {
  console.log(`🛡️  STARTING REVENUE-OPTIMIZED AUDIT (Tag: ${AMAZON_TAG})...`);
  
  const response = await fetch(`https://api.notion.com/v1/databases/${process.env.DATABASE_ID}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28'
    }
  });
  
  const data = await response.json();
  
  for (const page of data.results) {
    const p = page.properties;
    const url = p['Buy Link']?.url || '';
    const title = p['Product Name']?.title[0]?.plain_text;
    const currentPrice = p['Price']?.number;

    if (url.includes('amazon.com')) {
      const asinMatch = url.match(/(?:\/dp\/|gp\/product\/|exec\/obidos\/ASIN\/|o\/ASIN\/)([A-Z0-9]{10})/i);
      const asin = asinMatch ? asinMatch[1] : null;

      if (!asin) {
        await updateStatus(page.id, 'Review', '⚠️ MISSING ASIN: Revenue Leak Blocked.');
        continue;
      }

      // 1. Throughput Tweak: Real-time Availability & Price Check (Lightweight Scrape)
      const health = await checkProductHealth(url);
      
      if (!health.isAvailable) {
        console.warn(`🚩 [OUT OF STOCK] ${title}: Moving to Review.`);
        await updateStatus(page.id, 'Review', '🚩 OUT OF STOCK: Traffic diverted to prevent bounce.');
        continue;
      }

      // 2. Throughput Tweak: Price Tiering Logic
      if (health.price && health.price !== currentPrice) {
        console.log(`💰 [PRICE UPDATE] ${title}: $${currentPrice} -> $${health.price}`);
        await updatePriceInNotion(page.id, health.price);
      }

      const affiliateUrl = `https://www.amazon.com/dp/${asin}?tag=${AMAZON_TAG}`;
      
      if (!url.includes(`tag=${AMAZON_TAG}`)) {
        console.log(`✅ [FIXING TAG] ${title}: Injecting ${AMAZON_TAG}`);
        await updateNotionLink(page.id, affiliateUrl);
      } else {
        console.log(`💎 [VERIFIED] ${title}: Revenue-ready.`);
      }
    }
  }
}

async function checkProductHealth(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
    });
    const html = await res.text();
    
    // Basic stock check
    const isAvailable = !html.includes('Currently unavailable') && !html.includes('out of stock');
    
    // Basic price extraction
    const priceMatch = html.match(/\$(\d+\.\d{2})/);
    const price = priceMatch ? parseFloat(priceMatch[1]) : null;

    return { isAvailable, price };
  } catch (e) {
    return { isAvailable: true, price: null }; // Default to true on fetch error to avoid false positives
  }
}

async function updatePriceInNotion(pageId, price) {
  await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28'
    },
    body: JSON.stringify({ properties: { 'Price': { number: price } } })
  });
}

async function updateNotionLink(pageId, newUrl) {
  await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28'
    },
    body: JSON.stringify({ properties: { 'Buy Link': { url: newUrl } } })
  });
}

async function updateStatus(pageId, status, note) {
  await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28'
    },
    body: JSON.stringify({
      properties: {
        'Status': { status: { name: status } },
        'Notes': { rich_text: [{ text: { content: note } }] }
      }
    })
  });
}

validateAffiliateLinks();
