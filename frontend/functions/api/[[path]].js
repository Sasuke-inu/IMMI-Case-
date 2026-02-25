const HOP_BY_HOP_HEADERS = [
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
];

function buildUpstreamUrl(requestUrl, apiOrigin) {
  const incoming = new URL(requestUrl);
  const base = new URL(apiOrigin.endsWith("/") ? apiOrigin : `${apiOrigin}/`);
  return new URL(`${incoming.pathname.replace(/^\/+/, "")}${incoming.search}`, base);
}

function jsonError(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function onRequest(context) {
  const apiOrigin = context.env.API_ORIGIN;
  if (!apiOrigin) {
    return jsonError(
      500,
      "API_ORIGIN is not configured. Set it in Cloudflare Pages environment variables.",
    );
  }

  let upstreamUrl;
  try {
    upstreamUrl = buildUpstreamUrl(context.request.url, apiOrigin);
  } catch {
    return jsonError(500, "API_ORIGIN is not a valid URL.");
  }

  const incomingUrl = new URL(context.request.url);
  const requestHeaders = new Headers(context.request.headers);
  for (const header of HOP_BY_HOP_HEADERS) {
    requestHeaders.delete(header);
  }
  requestHeaders.set("x-forwarded-host", incomingUrl.host);
  requestHeaders.set("x-forwarded-proto", incomingUrl.protocol.replace(":", ""));

  const method = context.request.method.toUpperCase();
  const upstreamInit = {
    method,
    headers: requestHeaders,
    redirect: "manual",
  };

  if (method !== "GET" && method !== "HEAD") {
    upstreamInit.body = context.request.body;
  }

  let upstreamResponse;
  try {
    upstreamResponse = await fetch(upstreamUrl.toString(), upstreamInit);
  } catch {
    return jsonError(502, "Unable to reach API upstream.");
  }

  const responseHeaders = new Headers(upstreamResponse.headers);
  for (const header of HOP_BY_HOP_HEADERS) {
    responseHeaders.delete(header);
  }

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  });
}
