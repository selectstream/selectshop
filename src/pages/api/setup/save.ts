import type { APIRoute } from 'astro';
import { Client } from '@notionhq/client';

const notion = new Client({ auth: import.meta.env.NOTION_TOKEN });
const SETUPS_DATABASE_ID = import.meta.env.SETUPS_DATABASE_ID;

export const POST: APIRoute = async ({ request }) => {
  try {
    const { email, items, setupName = 'My Curation' } = await request.json();

    if (!email || !items) {
      return new Response(JSON.stringify({ message: 'Missing required data.' }), { status: 400 });
    }

    if (!SETUPS_DATABASE_ID) {
      console.error('MISSING SETUPS_DATABASE_ID');
      return new Response(JSON.stringify({ message: 'Server configuration error.' }), { status: 500 });
    }

    // 1. Check for existing setup for this email
    const existing = await notion.databases.query({
      database_id: SETUPS_DATABASE_ID,
      filter: {
        property: 'User Email',
        email: { equals: email }
      }
    });

    const pageId = existing.results[0]?.id;
    const properties = {
      'Setup Name': { title: [{ text: { content: setupName } }] },
      'User Email': { email: email },
      'Items (JSON)': { rich_text: [{ text: { content: JSON.stringify(items) } }] },
      'Last Updated': { date: { start: new Date().toISOString() } }
    };

    if (pageId) {
      // 2. Update existing
      await notion.pages.update({ page_id: pageId, properties });
      return new Response(JSON.stringify({ message: 'UPDATED' }), { status: 200 });
    } else {
      // 3. Create new
      await notion.pages.create({
        parent: { database_id: SETUPS_DATABASE_ID },
        properties
      });
      return new Response(JSON.stringify({ message: 'CREATED' }), { status: 201 });
    }

  } catch (error: any) {
    console.error('Notion Sync Error:', error.message);
    return new Response(JSON.stringify({ message: 'Sync failed.' }), { status: 500 });
  }
};
