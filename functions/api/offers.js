export async function onRequestGet(context) {
  const NOTION_TOKEN = context.env.NOTION_TOKEN;
  const DATABASE_ID = context.env.NOTION_DATABASE_ID;

  if (!NOTION_TOKEN || !DATABASE_ID) {
    return new Response(
      JSON.stringify({
        error: "Missing env vars",
        details: "Set NOTION_TOKEN and NOTION_DATABASE_ID in Cloudflare Pages environment variables."
      }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }

  const url = `https://api.notion.com/v1/databases/${DATABASE_ID}/query`;

  const notionRes = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${NOTION_TOKEN}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28"
    },
    body: JSON.stringify({
      page_size: 100,
      sorts: [
        { property: "Display Order", direction: "ascending" },
        { property: "Date Added", direction: "descending" }
      ]
    })
  });

  if (!notionRes.ok) {
    const text = await notionRes.text();
    return new Response(JSON.stringify({ error: "Notion query failed", details: text }), {
      status: 500,
      headers: { "content-type": "application/json" }
    });
  }

  const payload = await notionRes.json();

  const offers = (payload.results || []).map((page) => {
    const p = page.properties || {};

    const title = (prop) => prop?.title?.[0]?.plain_text ?? "";
    const rich = (prop) => prop?.rich_text?.[0]?.plain_text ?? "";
    const urlv = (prop) => prop?.url ?? "";
    const select = (prop) => prop?.select?.name ?? "";
    const num = (prop) => (typeof prop?.number === "number" ? prop.number : null);
    const date = (prop) => prop?.date?.start ?? "";
    const checkbox = (prop) => prop?.checkbox === true;

    return {
      name: title(p["Name"]),
      url: urlv(p["URL"]),
      notes: rich(p["Notes"]),
      partnershipGroup: select(p["Partnership Group"]),
      scamAlert: select(p["Scam Alert"]),
      status: select(p["Status"]),
      dateAdded: date(p["Date Added"]),
      displayOrder: num(p["Display Order"]),
      bonus30: checkbox(p["No Deposit Share Bonus +$30"])
    };
  });

  return new Response(JSON.stringify({ offers }), {
    headers: {
      "content-type": "application/json",
      "cache-control": "public, max-age=60"
    }
  });
}
