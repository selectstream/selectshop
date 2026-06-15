import type { APIRoute } from 'astro';
import { Client } from '@notionhq/client';
import { promises as dns } from 'dns';

// Safeguard Notion client initialization
let notion: Client | null = null;
try {
  if (process.env.NOTION_TOKEN) {
    notion = new Client({ auth: process.env.NOTION_TOKEN });
  }
} catch (err: any) {
  console.error('Failed to initialize Notion client:', err.message);
}

const SUBSCRIBERS_DATABASE_ID = process.env.SUBSCRIBERS_DATABASE_ID;

// Common high-trust domains to bypass DNS resolving under heavy loads
const TRUSTED_DOMAINS = new Set(['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'proton.me', 'protonmail.com', 'icloud.com']);

export const POST: APIRoute = async ({ request }) => {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  const cookieHeader = `ss_alpha_passport=unlocked_2026; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Strict`;

  try {
    const data = await request.json();
    const email = data.email?.trim().toLowerCase();

    // 1. Basic format check
    if (!email || !email.includes('@') || email.length > 100) {
      return new Response(JSON.stringify({ message: 'INVALID EMAIL FORMAT' }), { status: 400 });
    }

    const domain = email.split('@')[1];

    // 2. DNS/MX Verification (with high-trust domain bypass to avoid DNS bottlenecks)
    if (!TRUSTED_DOMAINS.has(domain)) {
      try {
        const mxRecords = await dns.resolveMx(domain);
        if (!mxRecords || mxRecords.length === 0) {
          return new Response(JSON.stringify({ message: 'UNVERIFIED EMAIL PROVIDER' }), { status: 400 });
        }
      } catch (dnsErr: any) {
        console.warn(`DNS MX check bypassed/failed for ${domain}:`, dnsErr.message);
        // Under heavy traffic, do not block the user if DNS is throttling us. Proceed gracefully.
      }
    }

    console.log('📡 Anchoring session email:', email);

    // 3. Decoupled Notion Sync with Graceful Fallback
    let syncSuccess = false;
    if (notion && SUBSCRIBERS_DATABASE_ID) {
      try {
        // Set a timeout for the Notion request to prevent blocking the user (4s)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        await Promise.race([
          notion.pages.create({
            parent: { database_id: SUBSCRIBERS_DATABASE_ID },
            properties: {
              'Email': { title: [{ text: { content: email } }] },
              'Status': { select: { name: 'Alpha' } },
              'Signup Date': { date: { start: new Date().toISOString().split('T')[0] } }
            }
          }),
          new Promise((_, reject) => {
            controller.signal.addEventListener('abort', () => reject(new Error('NOTION_SYNC_TIMEOUT')));
          })
        ]);
        clearTimeout(timeoutId);
        syncSuccess = true;
      } catch (notionError: any) {
        // Notion failed (rate limit 429, timeout, or network issue)
        console.error(`[DATABASE_OFFLINE_FALLBACK] Failed to write lead directly to Notion: ${notionError.message}`);
        console.log(`[LEAD_QUEUE_RECOVERY]: ${email}`);
      }
    } else {
      console.warn('Notion credentials missing. Bypassing database write.');
      console.log(`[LEAD_QUEUE_RECOVERY]: ${email}`);
    }

    // 4. Grant Access Regardless of Database Health (Fail-Open Strategy)
    headers.append('Set-Cookie', cookieHeader);
    
    return new Response(JSON.stringify({ 
      message: syncSuccess ? 'SUCCESS' : 'SESSION_ESTABLISHED_OFFLINE_SYNC' 
    }), { 
      status: 200, 
      headers: headers 
    });

  } catch (error: any) {
    console.error('Fatal Subscription Handler Error:', error.message);
    
    // Fall back to success if a valid-looking email parsing was initialized
    headers.append('Set-Cookie', cookieHeader);
    return new Response(JSON.stringify({ 
      message: 'SESSION_INITIALIZED_WITH_RECOVERY'
    }), { status: 200, headers: headers });
  }
};
