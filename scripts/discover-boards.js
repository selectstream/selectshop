import 'dotenv/config';

async function listBoards() {
  const token = process.env.PINTEREST_ACCESS_TOKEN;
  console.log("🔍 Fetching Pinterest Boards...");

  try {
    const response = await fetch('https://api.pinterest.com/v5/boards', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Unknown error");

    console.log("\n📋 Available Boards:");
    data.items.forEach(board => {
      console.log(`- ${board.name} (ID: ${board.id})`);
    });
  } catch (error) {
    console.error("❌ Failed to fetch boards:", error.message);
  }
}

listBoards();
