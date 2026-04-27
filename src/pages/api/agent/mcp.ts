import { getCollection } from 'astro:content';

/**
 * MCP (Model Context Protocol) Endpoint
 * Enables M2M discovery for shopping agents.
 */
export async function GET() {
  try {
    const products = await getCollection('products');
    
    const highSignalNodes = products
      .filter(p => p.data.trendScore >= 7)
      .map(p => ({
        node_id: p.data.slug,
        gtin: p.data.gtin || p.id,
        signal_score: p.data.trendScore.toFixed(1),
        diagnosis: p.data.painPoint,
        interface: p.data.interfaceType,
        buy_action: p.data.buyLink
      }));

    return new Response(JSON.stringify({
      protocol: "MCP_v1.0",
      authority: "SelectStream_Focus_Infrastructure",
      status: "SECURE",
      node_count: highSignalNodes.length,
      nodes: highSignalNodes
    }), {
      status: 200,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*" 
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "ARCHIVE_SYNC_FAILURE" }), { status: 500 });
  }
}
