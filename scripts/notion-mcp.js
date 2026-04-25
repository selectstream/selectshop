import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Client } from "@notionhq/client";
import "dotenv/config";

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.DATABASE_ID;

if (!NOTION_TOKEN || !DATABASE_ID) {
  console.error("❌ Missing NOTION_TOKEN or DATABASE_ID in .env");
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });

const server = new Server(
  {
    name: "selectstream-notion-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * List available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_live_products",
        description: "Fetch all products from Notion with Status: Live",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "update_editorial",
        description: "Update the 'Notes' field for a specific product page in Notion",
        inputSchema: {
          type: "object",
          properties: {
            page_id: { type: "string", description: "The Notion Page ID" },
            blurb: { type: "string", description: "The 3-sentence Triple-Threat copy" },
          },
          required: ["page_id", "blurb"],
        },
      },
      {
        name: "add_product",
        description: "Add a new product to the SelectStream Notion database",
        inputSchema: {
          type: "object",
          properties: {
            title: { type: "string" },
            slug: { type: "string" },
            buy_link: { type: "string" },
            category: { type: "string", description: "Minimalist Tech, Biohacking, etc." },
            trend_score: { type: "number" },
          },
          required: ["title", "slug", "buy_link", "category"],
        },
      },
    ],
  };
});

/**
 * Handle tool execution
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // Debug: log properties of 'notion' to ensure it's a valid client
    if (!notion || typeof notion.request !== 'function') {
      const methods = notion ? Object.keys(notion) : "null";
      throw new Error(`Invalid Notion client state. Available properties: ${methods}`);
    }

    if (name === "list_live_products") {
      const response = await notion.request({
        path: `databases/${DATABASE_ID}/query`,
        method: "post",
        body: {
          filter: {
            property: "Status",
            status: { equals: "Live" },
          },
        },
      });

      const products = response.results.map((page) => {
        const p = page.properties;
        return {
          id: page.id,
          title: p["Product Name"]?.title[0]?.plain_text || "Untitled",
          slug: p["Slug"]?.rich_text[0]?.plain_text || "no-slug",
          trend: p["Grok Trend Score"]?.number || 0,
        };
      });

      return {
        content: [{ type: "text", text: JSON.stringify(products, null, 2) }],
      };
    }

    if (name === "update_editorial") {
      await notion.pages.update({
        page_id: args.page_id,
        properties: {
          Notes: {
            rich_text: [{ text: { content: args.blurb } }],
          },
        },
      });

      return {
        content: [{ type: "text", text: `✅ Successfully updated editorial for ${args.page_id}` }],
      };
    }

    if (name === "add_product") {
      const response = await notion.pages.create({
        parent: { database_id: DATABASE_ID },
        properties: {
          "Product Name": { title: [{ text: { content: args.title } }] },
          Slug: { rich_text: [{ text: { content: args.slug } }] },
          "Buy Link": { url: args.buy_link },
          "Stream Category": { multi_select: [{ name: args.category }] },
          "Grok Trend Score": { number: args.trend_score || 50 },
          Status: { status: { name: "Live" } },
        },
      });

      return {
        content: [{ type: "text", text: `✅ Created product: ${args.title} (ID: ${response.id})` }],
      };
    }

    throw new Error(`Tool not found: ${name}`);
  } catch (error) {
    return {
      isError: true,
      content: [{ type: "text", text: `❌ Error: ${error.message}` }],
    };
  }
});

/**
 * Start the server
 */
async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("🚀 SelectStream Notion MCP Server running on stdio");
}

runServer().catch(console.error);
