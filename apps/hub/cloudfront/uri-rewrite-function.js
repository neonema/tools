function handler(event) {
  var request = event.request;
  var uri = request.uri || "/";

  if (uri === "/") {
    return request;
  }

  if (uri.indexOf("/api/") === 0) {
    return request;
  }

  var hubToolMatch = uri.match(/^\/(json|revealip|utc)\/?$/);
  if (hubToolMatch) {
    var host = request.headers.host.value;
    return {
      statusCode: 301,
      statusDescription: "Moved Permanently",
      headers: {
        location: { value: "https://" + host + "/#/" + hubToolMatch[1] },
      },
    };
  }

  if (uri.lastIndexOf(".") > uri.lastIndexOf("/")) {
    return request;
  }

  if (uri.endsWith("/")) {
    request.uri = uri + "index.html";
    return request;
  }

  request.uri = uri + "/index.html";
  return request;
}
