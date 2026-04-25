import { Client } from '@notionhq/client';
import 'dotenv/config';

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DATABASE_ID = process.env.DATABASE_ID;

const products = [
    {
        name: 'Keychron Q1 Pro',
        slug: 'keychron-q1-pro',
        link: 'https://www.amazon.com/dp/B0C1Z6G4G9',
        category: ['Workspace', 'Mechanical Keyboards'],
        score: 98,
        image: 'https://res.cloudinary.com/dw3c3uapo/image/upload/v1/stream/keychron-q1',
        notes: 'A monolithic slab of CNC-machined aluminum that defines the "Matte Black" workspace aesthetic. Gasket-mount precision and tactile response provide an uncompromising typing experience for high-output creators. The definitive precision-engineered foundation for any serious stream setup.'
    },
    {
        name: 'Logitech MX Master 3S',
        slug: 'mx-master-3s',
        link: 'https://www.amazon.com/dp/B09HM94VDS',
        category: ['Productivity', 'Peripherals'],
        score: 92,
        image: 'https://res.cloudinary.com/dw3c3uapo/image/upload/v1/stream/mx-master',
        notes: 'Ergonomic contour meets a refined, low-profile silhouette for the ultimate minimalist navigator. The 8K DPI sensor and MagSpeed scrolling offer high-signal accuracy across complex workflows. Tactile silence and ergonomic mastery in a singular, monolithic frame.'
    },
    {
        name: 'Shure SM7B',
        slug: 'shure-sm7b',
        link: 'https://www.amazon.com/dp/B0002E4Z8M',
        category: ['Audio', 'Streaming'],
        score: 95,
        image: 'https://res.cloudinary.com/dw3c3uapo/image/upload/v1/stream/shure-sm7b',
        notes: 'The legendary silhouette of professional audio, finished in a timeless, high-contrast matte. Studio-quality isolation and a flat-frequency response ensure your voice is delivered with absolute authority. The industry standard for those who demand high-signal vocal presence.'
    },
    {
        name: 'Sony WH-1000XM5',
        slug: 'sony-wh-1000xm5',
        link: 'https://www.amazon.com/dp/B09XS7JWHH',
        category: ['Audio', 'Travel'],
        score: 89,
        image: 'https://res.cloudinary.com/dw3c3uapo/image/upload/v1/stream/sony-xm5',
        notes: 'A seamless, integrated design that prioritizes a minimalist footprint and premium tactile finish. Industry-leading noise cancellation creates an acoustic vault, allowing for deep-work focus in any environment. The uncompromising choice for high-performance audio isolation.'
    },
    {
        name: 'Grovemade Matte Desk Mat',
        slug: 'grovemade-desk-mat',
        link: 'https://grovemade.com/product/matte-desk-mat/',
        category: ['Workspace', 'Aesthetics'],
        score: 85,
        image: 'https://res.cloudinary.com/dw3c3uapo/image/upload/v1/stream/grovemade-mat',
        notes: 'A foundational surface that grounds the entire workspace in a rich, non-reflective black texture. Provides the perfect tactile friction for high-precision mouse tracking while protecting the desk surface. The essential minimalist base layer for a cohesive monolithic setup.'
    }
];

async function seed() {
    console.log('🚀 Seeding SelectStream Essentials to Notion...');

    for (const p of products) {
        try {
            await notion.pages.create({
                parent: { database_id: DATABASE_ID },
                properties: {
                    'Product Name': { title: [{ text: { content: p.name } }] },
                    'Slug': { rich_text: [{ text: { content: p.slug } }] },
                    'Buy Link': { url: p.link },
                    'Stream Category': { multi_select: p.category.map(name => ({ name })) },
                    'Status': { status: { name: 'Live' } },
                    'Grok Trend Score': { number: p.score },
                    'Main Image': { 
                        files: [
                            {
                                name: 'Product Image',
                                type: 'external',
                                external: { url: p.image }
                            }
                        ]
                    },
                    'Notes': { rich_text: [{ text: { content: p.notes } }] }
                }
            });
            console.log(`✅ Seeded: ${p.name}`);
        } catch (error) {
            console.error(`❌ Failed to seed ${p.name}:`, error.message);
        }
    }
    console.log('💎 Seed complete. Refresh your shop to see the live stream.');
}

seed();
