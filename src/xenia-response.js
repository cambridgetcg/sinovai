// SPDX-License-Identifier: MPL-2.0
import { negotiateSurfaceResource } from "@agenttool/xenia/surface-0.1";
import { createXeniaGuide, getXeniaDocument } from "./xenia-guide.js";
import { XENIA_HTML } from "./pages/xenia.js";

const ALLOW = "GET, HEAD, OPTIONS";
const HEADERS = Object.freeze({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": ALLOW,
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-cache",
  "Vary": "Accept",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY"
});

export function createXeniaResponse(request) {
  const url = new URL(request.url);
  if (url.pathname !== "/xenia" && !url.pathname.startsWith("/xenia/docs/")) return null;
  const head = request.method === "HEAD";
  const response = (body, status, type, extra = {}) => new Response(head ? null : body, {
    status, headers: { ...HEADERS, "Content-Type": `${type}; charset=utf-8`, ...extra }
  });
  const problem = (status, code, title, extra = {}) => response(JSON.stringify({
    schema_version: "sinovai.xenia-problem/0.1", type: "about:blank", title, status, code,
    retryable: false, covered_by_surface: false,
    next_actions: [{ rel: "read_guide", method: "GET", href: "/xenia?format=json", accept: "application/json", optional: true }]
  }), status, "application/problem+json", extra);

  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...HEADERS, Allow: ALLOW } });
  if (request.method !== "GET" && !head) return problem(405, "method_not_allowed", "This documentation path is read-only", { Allow: ALLOW });
  if (url.pathname.startsWith("/xenia/docs/")) {
    const document = getXeniaDocument(url.pathname.slice("/xenia/docs/".length));
    if (!document) return problem(404, "document_not_found", "No document exists in this fixed reading list");
    return response(document.text, 200, document.media_type, {
      "Content-Security-Policy": "default-src 'none'; sandbox; frame-ancestors 'none'",
      "X-Xenia-Source-SHA256": document.sha256
    });
  }
  const resource = {
    id: "xenia", href: `${url.origin}/xenia`, representations: ["application/json", "text/html"],
    default_media_type: "text/html", auth: "none"
  };
  const representation = url.searchParams.get("format") === "json"
    ? "application/json"
    : negotiateSurfaceResource(resource, request.headers.get("accept"));
  if (representation !== "application/json" && representation !== "text/html") return problem(406, "not_acceptable", "No requested framework representation is available");
  return representation === "application/json"
    ? response(JSON.stringify(createXeniaGuide()), 200, "application/json")
    : response(XENIA_HTML, 200, "text/html");
}
