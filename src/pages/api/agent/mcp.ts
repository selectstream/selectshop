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
        sovereignty_rating: (p.data.interfaceType === 'XLR' || p.data.interfaceType === 'USB-C') ? 10 : 7,
        empirical_specs: {
          weight_g: p.data.weight,
          weight_limit_g: p.data.weightLimit,
          interface: p.data.interfaceType
        },
        diagnosis: p.data.painPoint,
        buy_action: p.data.buyLink
      }));

    return new Response(JSON.stringify({
      protocol: "MCP_v1.2_INSTITUTIONAL",
      authority: "SelectStream_Archive_Sovereignty_Lab",
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
