// eBay Marketplace Account Deletion notices for the eBay Sourcing App (Irox Technologies).
//
// eBay sends this address a notice whenever any eBay user asks for their account to be deleted
// (up to about 1,500 a day). The app keeps no personal data about other eBay users (see
// app/ebay/client.py Comparable.NOT_SAVED and app/db.py _scrub_other_sellers), so there is never
// anything to delete: each notice is read and confirmed, and nothing from it is stored or logged.
//
// GET  ?challenge_code=...  eBay checks that this address is ours. The reply is
//                           {"challengeResponse": sha256(challengeCode + verificationToken + endpoint)}.
// POST                      a deletion notice. Reply 200 so eBay counts it as received.
//
// Netlify environment variables (set on the site, never printed or written to the repository):
//   EBAY_VERIFICATION_TOKEN  the verification token entered on eBay's Alerts and Notifications page
//   EBAY_DELETION_ENDPOINT   exactly the endpoint URL entered there: https://iroxtechnologies.com/ebay-account-deletion
import { createHash } from "node:crypto";

const TOKEN_RULE = /^[A-Za-z0-9_-]{32,80}$/; // eBay: 32 to 80 letters, digits, _ and -

function env(name) {
  const fromNetlify = globalThis.Netlify?.env?.get?.(name);
  return String(fromNetlify ?? process.env[name] ?? "").trim(); // a stray space or newline would break the hash
}

export default async (req) => {
  if (req.method === "GET") {
    const code = new URL(req.url).searchParams.get("challenge_code");
    const token = env("EBAY_VERIFICATION_TOKEN");
    const endpoint = env("EBAY_DELETION_ENDPOINT");
    if (!code) {
      return new Response("Missing challenge_code", { status: 400 });
    }
    if (!TOKEN_RULE.test(token) || !endpoint.startsWith("https://")) {
      // Not set up correctly: fail loudly so eBay's check fails and the setup is fixed, not a wrong answer.
      return new Response("Endpoint not configured", { status: 500 });
    }
    const called = new URL(req.url);
    if (`${called.origin}${called.pathname}` !== endpoint) {
      // eBay hashes the address typed into its form; if that differs from this setting the check fails.
      console.warn(`eBay challenge came to ${called.origin}${called.pathname}, setting is ${endpoint}`);
    }
    const challengeResponse = createHash("sha256").update(code).update(token).update(endpoint).digest("hex");
    return new Response(JSON.stringify({ challengeResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (req.method === "POST") {
    try {
      await req.text(); // read and discard: nothing about eBay users is kept by the app or by this page
    } catch {
      // an unreadable body is still acknowledged; there is nothing to delete either way
    }
    return new Response(null, { status: 200 });
  }
  if (req.method === "HEAD") {
    return new Response(null, { status: 200 }); // for uptime checks
  }
  return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET, POST, HEAD" } });
};

export const config = { path: "/ebay-account-deletion" };
