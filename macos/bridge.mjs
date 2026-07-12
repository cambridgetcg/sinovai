import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { mergeVary } from "@agenttool/xenia";
import {
  createSurfaceManifestResponse,
  createSurfaceNotAcceptableProblem,
  createSurfaceProblem,
  createSurfaceProblemResponse,
  createSurfaceResourceResponse,
  createSurfaceRouteNotFoundProblem,
  defineSurfaceManifest,
  negotiateSurfaceResource,
  SURFACE_MANIFEST_PATH,
} from "@agenttool/xenia/surface-0.1";

export const BRIDGE_ADDRESS = "127.0.0.1";
export const BRIDGE_PORT = 18791;
export const BRIDGE_HOST = `${BRIDGE_ADDRESS}:${BRIDGE_PORT}`;

export const ALLOWED_ORIGINS = Object.freeze([
  "https://sinovai.com",
  "http://127.0.0.1:8787",
  "http://localhost:8787",
]);

export const PROBE_LIMITS = Object.freeze({
  timeoutMs: 1_500,
  maxOutputBytes: 16 * 1024,
});

const SYSTEM_ENVIRONMENT = Object.freeze({
  PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
  LANG: "C",
  LC_ALL: "C",
});

function probe(id, file, args, optional = false) {
  return Object.freeze({
    id,
    file,
    args: Object.freeze([...args]),
    optional,
    ...PROBE_LIMITS,
  });
}

export const FIXED_PROBES = Object.freeze([
  probe("host_product", "/usr/bin/sw_vers", ["-productName"]),
  probe("host_version", "/usr/bin/sw_vers", ["-productVersion"]),
  probe("host_architecture", "/usr/bin/uname", ["-m"]),
  probe("appearance_mode", "/usr/bin/defaults", ["read", "-g", "AppleInterfaceStyle"]),
  probe("appearance_accent", "/usr/bin/defaults", ["read", "-g", "AppleAccentColor"]),
  probe("dock_autohide", "/usr/bin/defaults", ["read", "com.apple.dock", "autohide"]),
  probe("dock_size", "/usr/bin/defaults", ["read", "com.apple.dock", "tilesize"]),
  probe("finder_hidden_files", "/usr/bin/defaults", ["read", "com.apple.finder", "AppleShowAllFiles"]),
  probe("finder_extensions", "/usr/bin/defaults", ["read", "NSGlobalDomain", "AppleShowAllExtensions"]),
  probe("finder_path_bar", "/usr/bin/defaults", ["read", "com.apple.finder", "ShowPathbar"]),
  probe("writing_spelling", "/usr/bin/defaults", ["read", "NSGlobalDomain", "NSAutomaticSpellingCorrectionEnabled"]),
]);

const ORIGIN = `http://${BRIDGE_HOST}`;
const ALLOWED_ORIGIN_SET = new Set(ALLOWED_ORIGINS);
const KNOWN_PATHS = new Set(["/", SURFACE_MANIFEST_PATH]);
const MUTATING_WORDS = /^(?:apply|delete|defer|install|killall|launchctl|open|prevent|purge|remove|rm|setup|strip|sudo|write)$/i;

const ROOT_HTML = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light">
<title>Sinovai Mac orientation bridge</title>
<style>
body{max-width:42rem;margin:10vh auto;padding:0 1.25rem;font:16px/1.6 system-ui,sans-serif;color:#e8e4dc;background:#0b0d12}
a{color:#8ecdf0}code{color:#e8c67a}small{color:#9b9da6}
</style>
<h1>Mac orientation bridge</h1>
<p>This local door is read-only. It observes a bounded set of ordinary macOS preferences only when JSON orientation is explicitly requested.</p>
<p>Return to <a href="https://sinovai.com/mac">sinovai.com/mac</a> and choose <strong>Connect this Mac</strong>.</p>
<p><a href="/.well-known/agent.json">Surface manifest</a></p>
<small>No setting is changed here. Review plans are text, never execution.</small>
</html>`;

const WALLS = Object.freeze([
  Object.freeze({ id: "local", title: "Local", detail: "The service accepts only exact IPv4 loopback peers and authority." }),
  Object.freeze({ id: "read_only", title: "Read only", detail: "Only GET and constrained private-network preflight are implemented." }),
  Object.freeze({ id: "sanitized", title: "Sanitized", detail: "Raw command output and machine identity are never returned." }),
  Object.freeze({ id: "reviewable", title: "Reviewable", detail: "Suggested changes include an undo path but are never executed." }),
]);

const manifest = defineSurfaceManifest({
  service: {
    name: "Sinovai Mac orientation bridge",
    canonicalUrl: `${ORIGIN}/`,
    description: "A loopback-only, read-only XENIA Surface for bounded Mac orientation.",
  },
  resources: [{
    id: "mac_orientation",
    href: `${ORIGIN}/`,
    representations: ["application/json", "text/html"],
    defaultMediaType: "text/html",
    description: "Static human guidance or a sanitized, explicitly requested machine orientation.",
  }],
  notCovered: [
    "macOS setting mutation",
    "privileged operations",
    "remote access",
    "persistent device identity",
    "raw command output",
  ],
});

function runExecFile(probeDefinition) {
  return new Promise((finish) => {
    execFile(
      probeDefinition.file,
      [...probeDefinition.args],
      {
        cwd: "/",
        encoding: "utf8",
        env: SYSTEM_ENVIRONMENT,
        killSignal: "SIGKILL",
        maxBuffer: probeDefinition.maxOutputBytes,
        shell: false,
        timeout: probeDefinition.timeoutMs,
        windowsHide: true,
      },
      (error, stdout) => {
        if (error) {
          const missingPreference = probeDefinition.file === "/usr/bin/defaults" && error.code === 1;
          finish({ ok: false, state: missingPreference ? "not-set" : "unavailable", stdout: "" });
          return;
        }
        const bounded = typeof stdout === "string"
          ? stdout.slice(0, probeDefinition.maxOutputBytes)
          : "";
        finish({ ok: true, state: "observed", stdout: bounded });
      },
    );
  });
}

function normalizeProbeResult(value, probeDefinition) {
  if (value === null || typeof value !== "object") {
    return { ok: false, state: "unavailable", stdout: "" };
  }
  const stdout = typeof value.stdout === "string"
    ? value.stdout.slice(0, probeDefinition.maxOutputBytes)
    : "";
  return {
    ok: value.ok === true,
    state: value.state === "not-set" ? "not-set" : value.ok === true ? "observed" : "unavailable",
    stdout,
  };
}

async function collectFixedProbeResults(runner) {
  const entries = await Promise.all(FIXED_PROBES.map(async (definition) => {
    let result;
    try {
      result = await runner(definition);
    } catch {
      result = { ok: false, state: "unavailable", stdout: "" };
    }
    return [definition.id, normalizeProbeResult(result, definition)];
  }));
  return Object.fromEntries(entries);
}

function clean(result) {
  return result?.ok ? result.stdout.trim() : "";
}

function parseBoolean(result) {
  if (result?.state === "not-set") return { kind: "default", value: null };
  const value = clean(result).toLowerCase();
  if (["1", "true", "yes"].includes(value)) return { kind: "value", value: true };
  if (["0", "false", "no"].includes(value)) return { kind: "value", value: false };
  return { kind: "unknown", value: null };
}

function parseInteger(result, minimum, maximum) {
  const value = clean(result);
  if (!/^-?\d+$/.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= minimum && number <= maximum ? number : null;
}

function item(label, value, status) {
  return { label, value, status };
}

function statusOf(items) {
  if (items.some((entry) => entry.status === "attention")) return "attention";
  if (items.some((entry) => entry.status === "unknown")) return "unknown";
  return "ready";
}

function section(id, title, description, items) {
  return { id, title, description, status: statusOf(items), items };
}

function booleanItem(label, observation, yes, no) {
  if (observation.kind === "value") return item(label, observation.value ? yes : no, "ready");
  if (observation.kind === "default") return item(label, "System default", "ready");
  return item(label, "Unobserved", "unknown");
}

function fixedUndo(domain, key, observation, kind = "bool") {
  if (observation.kind !== "value") return [`defaults delete ${domain} ${key}`];
  const value = kind === "bool" ? (observation.value ? "true" : "false") : String(observation.value);
  return [`defaults write ${domain} ${key} -${kind} ${value}`];
}

function buildPlans(observations) {
  const plans = [];
  if (observations.dockAutohide.kind !== "unknown" && observations.dockAutohide.value !== true) {
    plans.push({
      id: "dock_autohide",
      title: "Let the Dock make room",
      category: "Dock",
      tier: "user",
      description: "Hide the Dock until the pointer reaches its edge, leaving more quiet space for work.",
      effect: "Changes one user preference and restarts the Dock.",
      commands: ["defaults write com.apple.dock autohide -bool true", "killall Dock"],
      undo: [...fixedUndo("com.apple.dock", "autohide", observations.dockAutohide), "killall Dock"],
    });
  }
  if (observations.finderExtensions.kind !== "unknown" && observations.finderExtensions.value !== true) {
    plans.push({
      id: "finder_extensions",
      title: "Make file types visible",
      category: "Finder",
      tier: "user",
      description: "Show filename extensions so files say what they are without relying on icons.",
      effect: "Changes one user preference and restarts Finder.",
      commands: ["defaults write NSGlobalDomain AppleShowAllExtensions -bool true", "killall Finder"],
      undo: [...fixedUndo("NSGlobalDomain", "AppleShowAllExtensions", observations.finderExtensions), "killall Finder"],
    });
  }
  if (observations.finderPathBar.kind !== "unknown" && observations.finderPathBar.value !== true) {
    plans.push({
      id: "finder_path_bar",
      title: "Keep the current path in view",
      category: "Finder",
      tier: "user",
      description: "Show Finder's path bar so location stays legible while moving through folders.",
      effect: "Changes one user preference and restarts Finder.",
      commands: ["defaults write com.apple.finder ShowPathbar -bool true", "killall Finder"],
      undo: [...fixedUndo("com.apple.finder", "ShowPathbar", observations.finderPathBar), "killall Finder"],
    });
  }
  return plans;
}

export async function buildOrientation({ runner = runExecFile, now = () => new Date() } = {}) {
  const results = await collectFixedProbeResults(runner);
  const product = clean(results.host_product) === "macOS" ? "macOS" : "Unobserved";
  const rawVersion = clean(results.host_version);
  const version = /^\d+(?:\.\d+){1,2}$/.test(rawVersion) ? rawVersion : "Unobserved";
  const rawArchitecture = clean(results.host_architecture);
  const architecture = ["arm64", "x86_64"].includes(rawArchitecture) ? rawArchitecture : "Unobserved";

  const interfaceMode = clean(results.appearance_mode) === "Dark"
    ? item("Interface", "Dark", "ready")
    : results.appearance_mode?.state === "not-set"
      ? item("Interface", "Light or automatic", "ready")
      : item("Interface", "Unobserved", "unknown");
  const accentNumber = parseInteger(results.appearance_accent, -2, 6);
  const accentNames = new Map([[-2, "Multicolor"], [-1, "Graphite"], [0, "Red"], [1, "Orange"], [2, "Yellow"], [3, "Green"], [4, "Blue"], [5, "Purple"], [6, "Pink"]]);
  const accent = accentNumber === null
    ? item("Accent", results.appearance_accent?.state === "not-set" ? "System default" : "Unobserved", results.appearance_accent?.state === "not-set" ? "ready" : "unknown")
    : item("Accent", accentNames.get(accentNumber) ?? "System default", "ready");

  const dockAutohide = parseBoolean(results.dock_autohide);
  const dockSizeNumber = parseInteger(results.dock_size, 16, 128);
  const dockSize = dockSizeNumber === null
    ? item("Dock scale", results.dock_size?.state === "not-set" ? "System default" : "Unobserved", results.dock_size?.state === "not-set" ? "ready" : "unknown")
    : item("Dock scale", dockSizeNumber < 44 ? "Compact" : dockSizeNumber <= 64 ? "Balanced" : "Spacious", "ready");
  const hiddenFiles = parseBoolean(results.finder_hidden_files);
  const finderExtensions = parseBoolean(results.finder_extensions);
  const finderPathBar = parseBoolean(results.finder_path_bar);
  const spelling = parseBoolean(results.writing_spelling);

  const sections = [
    section("appearance", "Appearance", "The visual register currently in use.", [interfaceMode, accent]),
    section("workspace", "Dock & Finder", "How the everyday workspace reveals and shelters information.", [
      booleanItem("Dock", dockAutohide, "Hides automatically", "Always visible"),
      dockSize,
      booleanItem("Hidden files", hiddenFiles, "Shown", "Sheltered"),
      booleanItem("File extensions", finderExtensions, "Shown", "Sheltered"),
      booleanItem("Finder path bar", finderPathBar, "Shown", "Sheltered"),
    ]),
    section("writing", "Writing", "A small bounded reading of text assistance.", [
      booleanItem("Automatic spelling correction", spelling, "Enabled", "Disabled"),
    ]),
  ];

  const observations = { dockAutohide, finderExtensions, finderPathBar };
  const summary = sections.reduce((counts, entry) => {
    counts[entry.status] += 1;
    return counts;
  }, { ready: 0, attention: 0, unknown: 0 });
  const findings = [];
  if (version === "Unobserved" || architecture === "Unobserved") {
    findings.push({
      severity: "unknown",
      title: "Part of the host description was unavailable",
      detail: "Unknown means unobserved. No raw error or machine identity was retained.",
    });
  }

  return {
    schema_version: "sinovai.mac-orientation/0.1",
    observed_at: now().toISOString(),
    summary,
    host: { product, version, architecture },
    sections,
    plans: buildPlans(observations),
    findings,
    walls: WALLS.map((wall) => ({ ...wall })),
  };
}

function rawHeaderValues(request, name) {
  const values = [];
  for (let index = 0; index < request.rawHeaders.length; index += 2) {
    if (String(request.rawHeaders[index]).toLowerCase() === name) {
      values.push(String(request.rawHeaders[index + 1] ?? ""));
    }
  }
  return values;
}

export function isExactLoopbackPeer(remoteAddress) {
  return remoteAddress === BRIDGE_ADDRESS;
}

export function hasExactBridgeHost(rawHeaders) {
  const hosts = [];
  for (let index = 0; index < rawHeaders.length; index += 2) {
    if (String(rawHeaders[index]).toLowerCase() === "host") {
      hosts.push(String(rawHeaders[index + 1] ?? ""));
    }
  }
  return hosts.length === 1 && hosts[0] === BRIDGE_HOST;
}

export function isAllowedOrigin(origin) {
  return origin === undefined || ALLOWED_ORIGIN_SET.has(origin);
}

function originOf(request) {
  const origins = rawHeaderValues(request, "origin");
  if (origins.length === 0) return { valid: true, value: undefined };
  if (origins.length !== 1 || !ALLOWED_ORIGIN_SET.has(origins[0])) return { valid: false, value: undefined };
  return { valid: true, value: origins[0] };
}

function withResponseBoundaries(response, origin) {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Vary", mergeVary(headers.get("Vary"), "Origin"));
  if (origin !== undefined) headers.set("Access-Control-Allow-Origin", origin);
  headers.delete("Access-Control-Allow-Credentials");
  headers.delete("Set-Cookie");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function fixedProblem(status, code, title, detail, origin) {
  return withResponseBoundaries(createSurfaceProblemResponse(createSurfaceProblem({
    type: `${ORIGIN}/problems/${code.replaceAll("_", "-")}`,
    title,
    status,
    code,
    detail,
    retryable: false,
    terminal: true,
  })), origin);
}

function methodProblem(origin) {
  const response = createSurfaceProblemResponse(createSurfaceProblem({
    type: `${ORIGIN}/problems/method-not-allowed`,
    title: "Method not allowed",
    status: 405,
    code: "method_not_allowed",
    detail: "This bridge observes through GET only and never accepts mutation requests.",
    retryable: false,
    terminal: false,
    nextActions: [{
      rel: "observe",
      href: `${ORIGIN}/`,
      accept: "application/json",
      description: "Request a fresh sanitized orientation.",
    }],
  }), { headers: { Allow: "GET, OPTIONS" } });
  return withResponseBoundaries(response, origin);
}

function preflightResponse(request, origin, pathname) {
  if (!KNOWN_PATHS.has(pathname)
    || request.headers["access-control-request-method"] !== "GET"
    || request.headers["access-control-request-private-network"] !== "true"
    || request.headers["access-control-request-headers"] !== undefined) {
    return fixedProblem(403, "preflight_refused", "Private-network preflight refused", "Only the bounded GET orientation preflight is accepted.", undefined);
  }
  const headers = new Headers({
    "Access-Control-Allow-Methods": "GET",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Private-Network": "true",
    "Cache-Control": "no-store",
    "Content-Length": "0",
    "X-Content-Type-Options": "nosniff",
  });
  headers.set("Vary", "Origin, Access-Control-Request-Method, Access-Control-Request-Private-Network");
  return new Response(null, { status: 204, headers });
}

async function routeGet(request, origin, pathname, runner, now) {
  if (request.url.includes("?") || request.url.includes("#")) {
    return withResponseBoundaries(createSurfaceProblemResponse(createSurfaceRouteNotFoundProblem({
      manifestUrl: `${ORIGIN}${SURFACE_MANIFEST_PATH}`,
    })), origin);
  }
  if (pathname === SURFACE_MANIFEST_PATH) {
    return withResponseBoundaries(createSurfaceManifestResponse(manifest), origin);
  }
  if (pathname !== "/") {
    return withResponseBoundaries(createSurfaceProblemResponse(createSurfaceRouteNotFoundProblem({
      manifestUrl: `${ORIGIN}${SURFACE_MANIFEST_PATH}`,
    })), origin);
  }

  const resource = manifest.resources[0];
  const representation = negotiateSurfaceResource(resource, request.headers.accept);
  if (representation === "not-acceptable") {
    return withResponseBoundaries(createSurfaceProblemResponse(createSurfaceNotAcceptableProblem({ resource })), origin);
  }
  if (representation === "text/html") {
    return withResponseBoundaries(createSurfaceResourceResponse("text/html", ROOT_HTML), origin);
  }
  const orientation = await buildOrientation({ runner, now });
  return withResponseBoundaries(createSurfaceResourceResponse("application/json", orientation), origin);
}

async function writeNodeResponse(response, nodeResponse) {
  const body = Buffer.from(await response.arrayBuffer());
  nodeResponse.writeHead(response.status, Object.fromEntries(response.headers.entries()));
  nodeResponse.end(body);
}

export function createMacBridgeServer({ runner = runExecFile, now = () => new Date() } = {}) {
  const server = createServer((request, response) => {
    void (async () => {
      if (!isExactLoopbackPeer(request.socket.remoteAddress) || !hasExactBridgeHost(request.rawHeaders)) {
        await writeNodeResponse(fixedProblem(403, "loopback_refused", "Loopback request refused", "The bridge accepts one exact local peer and authority.", undefined), response);
        return;
      }
      const origin = originOf(request);
      if (!origin.valid) {
        await writeNodeResponse(fixedProblem(403, "origin_refused", "Origin refused", "This origin is not invited to the local orientation surface.", undefined), response);
        return;
      }
      if (request.url === undefined || !request.url.startsWith("/") || request.url.startsWith("//")) {
        await writeNodeResponse(fixedProblem(400, "request_refused", "Request target refused", "Use an origin-form path on the local bridge.", origin.value), response);
        return;
      }
      let url;
      try {
        url = new URL(request.url, `${ORIGIN}/`);
      } catch {
        await writeNodeResponse(fixedProblem(400, "request_refused", "Request target refused", "Use a valid local path.", origin.value), response);
        return;
      }
      if (request.method === "OPTIONS") {
        if (origin.value === undefined) {
          await writeNodeResponse(fixedProblem(403, "preflight_refused", "Private-network preflight refused", "Private-network preflight requires an invited Origin.", undefined), response);
          return;
        }
        await writeNodeResponse(preflightResponse(request, origin.value, url.pathname), response);
        return;
      }
      if (request.method !== "GET") {
        await writeNodeResponse(methodProblem(origin.value), response);
        return;
      }
      if (request.headers["content-length"] !== undefined || request.headers["transfer-encoding"] !== undefined) {
        await writeNodeResponse(fixedProblem(400, "request_body_refused", "Request body refused", "The read-only orientation GET accepts no request body.", origin.value), response);
        return;
      }
      await writeNodeResponse(await routeGet(request, origin.value, url.pathname, runner, now), response);
    })().catch(async () => {
      if (!response.headersSent) {
        await writeNodeResponse(fixedProblem(500, "orientation_unavailable", "Orientation unavailable", "The bounded orientation could not be assembled without crossing a wall.", undefined), response);
      } else {
        response.destroy();
      }
    });
  });
  server.maxHeadersCount = 32;
  server.headersTimeout = 4_000;
  server.requestTimeout = 4_000;
  server.keepAliveTimeout = 1_000;
  return server;
}

export function startMacBridge() {
  const server = createMacBridgeServer();
  server.listen({ host: BRIDGE_ADDRESS, port: BRIDGE_PORT, exclusive: true }, () => {
    console.log("Sinovai Mac orientation bridge is ready on IPv4 loopback.");
  });
  return server;
}

const entry = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (entry === import.meta.url) {
  const server = startMacBridge();
  server.on("error", () => {
    console.error("Sinovai Mac orientation bridge could not start.");
    process.exitCode = 1;
  });
}

export function fixedProbeIsReadOnly(definition) {
  return !definition.args.some((argument) => MUTATING_WORDS.test(argument));
}
