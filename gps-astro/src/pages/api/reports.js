export const prerender = false;

if (!global._sharedReports) {
  global._sharedReports = [];
}

export async function GET() {
  return new Response(JSON.stringify(global._sharedReports), {
    headers: { "Content-Type": "application/json" }
  });
}

export async function POST({ request }) {
  try {
    const data = await request.json();
    global._sharedReports.push(data);
    return new Response(JSON.stringify({ success: true, report: data }), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
}
