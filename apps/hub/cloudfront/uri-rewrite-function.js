function handler(event) {
  var request = event.request;
  var uri = request.uri || "/";

  if (uri === "/") {
    return request;
  }

  if (uri.indexOf("/api/") === 0) {
    return request;
  }

  // S3 REST origins only apply a default root object at "/".
  // Rewrite directory URLs (including tool roots like /json/) to index.html.
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
