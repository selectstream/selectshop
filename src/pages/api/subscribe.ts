import type { APIRoute } from 'astro';
import { Client } from '@notionhq/client';
import { promises as dns } from 'dns';

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const SUBSCRIBERS_DATABASE_ID = process.env.SUBSCRIBERS_DATABASE_ID;

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    const email = data.email?.trim().toLowerCase();

    if (!email || !email.includes('@')) {
      return new Response(JSON.stringify({ message: 'INVALID EMAIL FORMAT' }), { status: 400 });
    }

    // 1. DNS/MX Verification (Filter out fake domains)
    const domain = email.split('@')[1];
    try {
      const mxRecords = await dns.resolveMx(domain);
      if (!mxRecords || mxRecords.length === 0) {
        throw new Error('NO MX RECORDS');
      }
    } catch (dnsErr) {
      console.error(`DNS Verification Failed for ${domain}:`, dnsErr);
      return new Response(JSON.stringify({ message: 'UNVERIFIED EMAIL PROVIDER' }), { status: 400 });
    }

    if (!SUBSCRIBERS_DATABASE_ID) {
      console.error('CRITICAL: SUBSCRIBERS_DATABASE_ID is not defined.');
      return new Response(JSON.stringify({ message: 'CONFIGURATION ERROR' }), { status: 500 });
    }

    console.log('📡 Anchoring verified email:', email);
    
    // 2. Add to Notion
    await notion.pages.create({
      parent: { database_id: SUBSCRIBERS_DATABASE_ID },
      properties: {
        'Email': { title: [{ text: { content: email } }] },
        'Status': { select: { name: 'Alpha' } },
        'Signup Date': { date: { start: new Date().toISOString().split('T')[0] } }
      }
    });

    // 3. Set Persistence Cookie (v1.5 Strategy)
    const headers = new Headers({ 'Content-Type': 'application/json' });
    headers.append('Set-Cookie', `ss_alpha_passport=unlocked_2026; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Strict`);

    return new Response(JSON.stringify({ message: 'SUCCESS' }), { 
      status: 200,
      headers: headers
    });
  } catch (error: any) {
    console.error('Subscription Error:', error.message);
    return new Response(JSON.stringify({ 
      message: `DATABASE ERROR: ${error.message}` 
    }), { status: 500 });
  }
};
