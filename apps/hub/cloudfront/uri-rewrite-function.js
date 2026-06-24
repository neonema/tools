function handler(event) {
  var request = event.request;
  var uri = request.uri || "/";

  if (uri === "/") {
    return request;
  }

  if (uri.indexOf("/api/") === 0) {
    return request;
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
