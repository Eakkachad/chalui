// Server-side proxy for the ThaiLLM (typhoon) chat completion API.
// Runs on the Node SSR server, so it avoids browser CORS/redirect limits and
// keeps the API key OFF the client. The frontend calls this same-origin route.
export const prerender = false;

const THAILLM_ENDPOINT = "https://thaillm.or.th/api/v1/chat/completions";
const THAILLM_MODEL = "typhoon-s-thaillm-8b-instruct";

function getApiKey() {
  // Prefer an env var; fall back to the POC key so the demo works out of the box.
  return (
    (import.meta.env && import.meta.env.THAILLM_API_KEY) ||
    (typeof process !== "undefined" && process.env && process.env.THAILLM_API_KEY) ||
    "YOo9UCZRrU8BhdndNlN1aNkQ1aq3li0j"
  );
}

export async function POST({ request }) {
  try {
    const body = await request.json();
    const { systemPrompt, userInput } = body;

    const messages = body.messages || [
      { role: "system", content: systemPrompt || "คุณคือผู้ช่วยเดินทางภาษาไทยชื่อ ย่านาง ตอบสั้น กระชับ เป็นมิตร ลงท้ายด้วยครับ" },
      { role: "user", content: userInput || "" }
    ];

    const upstream = await fetch(THAILLM_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getApiKey()}`
      },
      body: JSON.stringify({
        model: THAILLM_MODEL,
        messages,
        max_tokens: 1024,
        temperature: 0.4
      })
    });

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => "");
      // 200 so the client can gracefully fall back to its local grounded answer.
      return json({ error: `upstream_${upstream.status}`, detail: detail.slice(0, 300) });
    }

    const data = await upstream.json();
    const reply = data && data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : "";

    return json({ reply });
  } catch (err) {
    return json({ error: err.message });
  }
}

function json(obj) {
  return new Response(JSON.stringify(obj), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}
