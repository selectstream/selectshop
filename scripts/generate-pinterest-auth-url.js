import 'dotenv/config';

/**
 * PINTEREST OAUTH URL GENERATOR
 * Run this script to get the URL needed to authorize your app.
 */
function generateAuthUrl() {
  const appId = process.env.PINTEREST_APP_ID;
  const redirectUri = "https://selectstreamshop.com/api/auth/pinterest/callback";
  const scopes = "boards:read,pins:read,pins:write,user_accounts:read";

  const url = `https://www.pinterest.com/oauth/?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}`;

  console.log("\n🔗 STEP 1: Configure your Redirect URIs in the Pinterest Dashboard.");
  console.log("🔗 STEP 2: Open this URL in your browser to authorize SelectStream:");
  console.log(`\n${url}\n`);
  console.log("🔗 STEP 3: After clicking 'Give Access', you will be redirected to your site.");
  console.log("The URL will contain a '?code=...' parameter. Copy that code and paste it here to finalize your production token.");
}

generateAuthUrl();
