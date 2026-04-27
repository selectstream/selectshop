import { defineCollection, z } from 'astro:content';
import 'dotenv/config';
import { calculateSignal } from './utils/signal-engine';

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.DATABASE_ID;

/**
 * Utility to extract ASIN from Amazon URLs
 */
function extractASIN(url: string): string {
	const match = url.match(/(?:\/dp\/|gp\/product\/|exec\/obidos\/ASIN\/|o\/ASIN\/)([A-Z0-9]{10})/i);
	return match ? match[1] : '';
}

/**
 * Standardizes the product data from the Notion API.
 */
const products = defineCollection({
	loader: async () => {
		if (!NOTION_TOKEN || !DATABASE_ID) {
			console.error('CRITICAL: Missing Notion credentials.');
			return [];
		}

		try {
			const response = await fetch(`https://api.notion.com/v1/databases/${DATABASE_ID}/query`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${NOTION_TOKEN}`,
					'Content-Type': 'application/json',
					'Notion-Version': '2022-06-28',
				},
				body: JSON.stringify({
					filter: {
						property: 'Status',
						status: { equals: 'Live' },
					},
				}),
			});

			const data = await response.json();

			if (!response.ok) {
				console.error(`ERROR [Notion API]: ${data.message || 'Unknown API failure'}`);
				return [];
			}

			return data.results.map((page: any) => {
				const props = page.properties;
				
				const amazonUrl = props['Buy Link']?.url || '';
				const directUrl = props['Direct Link']?.url || ''; // New Mesh Node
				
				// Mesh Routing Logic: Prioritize Direct (High Margin) over Amazon (Low Margin)
				let activeLink = directUrl || amazonUrl;
				let source = directUrl ? 'direct' : 'amazon';

				// Inject Associate Tag for Amazon Links
				if (activeLink.includes('amazon.com')) {
					const url = new URL(activeLink);
					url.searchParams.set('tag', 'selectstream-20');
					activeLink = url.toString();
				}

				// 1. Extract Pillar Scores
				const materials = props['Material Integrity']?.number || 5;
				const cognitive = props['Cognitive Efficiency']?.number || 5;
				const momentum = props['Community Momentum']?.number || 5;
				const longevity = props['Longevity Score']?.number || 5;

				const finalSignal = calculateSignal(materials, cognitive, momentum, longevity);

				return {
					id: page.id,
					title: props['Product Name']?.title?.[0]?.plain_text || 'Untitled Product',
					slug: props['Slug']?.rich_text?.[0]?.plain_text || page.id,
					buyLink: activeLink,
					mesh: {
						amazon: amazonUrl,
						direct: directUrl,
						activeSource: source
						},
						productType: (props['Product Type']?.select?.name?.toLowerCase() === 'digital') ? 'digital' : 'physical',
						asin: extractASIN(amazonUrl),
						gtin: props['GTIN/UPC']?.rich_text?.[0]?.plain_text || '',
						painPoint: props['Pain Point']?.select?.name || '',
						digitalStack: props['Digital Stack']?.rich_text?.[0]?.plain_text || '',
						stackId: props['Stack ID']?.rich_text?.[0]?.plain_text || '',
						stackName: props['Stack Name']?.rich_text?.[0]?.plain_text || '',
						category: props['Stream Category']?.multi_select?.map((s: any) => s.name) || [],					status: props['Status']?.status?.name || 'Draft',
					trendScore: finalSignal,
					priceEstimate: props['Price (Numeric)']?.number ?? 0,
					image: props['Main Image']?.files?.[0]?.file?.url || props['Main Image']?.files?.[0]?.external?.url || '',
					notes: props['Notes']?.rich_text?.[0]?.plain_text || '',
				};
			});
		} catch (error) {
			console.error('CRITICAL: Unexpected error in Notion Content Loader:', error);
			return [];
		}
	},
	schema: z.object({
		id: z.string(),
		title: z.string().default('Untitled'),
		slug: z.string(),
		buyLink: z.string().url().or(z.literal('')).default(''),
		mesh: z.object({
			amazon: z.string().url().or(z.literal('')).default(''),
			direct: z.string().url().or(z.literal('')).default(''),
			activeSource: z.enum(['amazon', 'direct']).default('amazon')
		}),
		productType: z.enum(['physical', 'digital']).default('physical'),
		asin: z.string().default(''),
		category: z.array(z.string()).default([]),
		status: z.enum(['Draft', 'Review', 'Live']).default('Draft'),
		trendScore: z.number().default(0),
		priceEstimate: z.number().default(0),
		image: z.string().optional(),
		notes: z.string().optional(),
	}),
});

export const collections = { products };
