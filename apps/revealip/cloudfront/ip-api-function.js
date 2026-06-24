function classifyIp(ip) {
  if (!ip) return { ipv4: null, ipv6: null, preferred: null };
  if (ip.indexOf(":") !== -1) {
    return { ipv4: null, ipv6: ip, preferred: ip };
  }
  return { ipv4: ip, ipv6: null, preferred: ip };
}

function firstHeaderValue(headers, headerName) {
  if (!headers || !headers[headerName] || !headers[headerName].value) return null;
  var value = headers[headerName].value.trim();
  if (!value) return null;
  return value;
}

function firstIpFromHeaderValue(value) {
  if (!value) return null;
  var first = value.split(",")[0].trim();
  return first || null;
}

function detectClientIp(event) {
  var request = event.request || {};
  var headers = request.headers || {};

  // When Cloudflare proxies traffic, this header carries the real visitor IP.
  var cfConnectingIp = firstHeaderValue(headers, "cf-connecting-ip");
  if (cfConnectingIp) return cfConnectingIp;

  // Some upstream proxies use True-Client-IP.
  var trueClientIp = firstHeaderValue(headers, "true-client-ip");
  if (trueClientIp) return trueClientIp;

  // Fallback to the first entry in X-Forwarded-For chain.
  var xForwardedFor = firstHeaderValue(headers, "x-forwarded-for");
  var forwardedIp = firstIpFromHeaderValue(xForwardedFor);
  if (forwardedIp) return forwardedIp;

  return event.viewer && event.viewer.ip ? event.viewer.ip : null;
}

function handler(event) {
  var request = event.request;
  var uri = request.uri || "";

  if (uri !== "/api/ip") {
    return request;
  }

  var clientIp = detectClientIp(event);
  var result = classifyIp(clientIp);

  var body = JSON.stringify({
    ipv4: result.ipv4,
    ipv6: result.ipv6,
    preferred: result.preferred,
    status: result.preferred ? "ok" : "not_found",
    message: result.preferred ? null : "We could not detect your IP address."
  });

  return {
    statusCode: 200,
    statusDescription: "OK",
    headers: {
      "content-type": { value: "application/json; charset=utf-8" },
      "cache-control": { value: "no-store, no-cache, must-revalidate, max-age=0" },
      pragma: { value: "no-cache" },
      expires: { value: "0" },
      "access-control-allow-origin": { value: "*" }
    },
    body: body
  };
}
