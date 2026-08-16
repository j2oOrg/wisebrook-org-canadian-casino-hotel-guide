import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const requestedPort = process.argv[2] || process.env.PORT || "4175";
const port = Number(requestedPort);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(`Invalid port: ${requestedPort}`);
}

const contentTypes = {
  ".avif": "image/avif",
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8"
};

const publicRootFiles = new Set([
  "404.html",
  "favicon.svg",
  "index.html",
  "robots.txt",
  "site.js",
  "sitemap.xml",
  "styles.css"
]);

const publicRouteNames = new Set([
  "about",
  "contact",
  "how-we-read",
  "privacy",
  "properties",
  "responsible-gambling",
  "sources",
  "terms"
]);

const isPublicPath = (path) => {
  const normalized = path.replaceAll("\\", "/");
  if (normalized.startsWith("assets/")) return true;
  if (publicRootFiles.has(normalized)) return true;
  if (/^[^/]+\.html$/.test(normalized)) {
    return publicRouteNames.has(normalized.slice(0, -5));
  }

  const [routeName, fileName, extra] = normalized.split("/");
  return publicRouteNames.has(routeName) && fileName === "index.html" && !extra;
};

const insideRoot = (path) => {
  const pathFromRoot = relative(root, path);
  return pathFromRoot !== ".." && !pathFromRoot.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`);
};

const findPublicFile = async (pathname) => {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  const normalized = normalize(decoded).replace(/^[/\\]+/, "");
  if (!normalized || normalized === ".") {
    return join(root, "index.html");
  }

  const candidates = extname(normalized)
    ? [normalized]
    : [`${normalized}.html`, join(normalized, "index.html")];

  for (const candidate of candidates) {
    if (!isPublicPath(candidate)) continue;
    const file = resolve(root, candidate);
    if (!insideRoot(file)) continue;

    try {
      const information = await stat(file);
      if (information.isFile()) return file;
    } catch {
      // Try the next clean-URL form.
    }
  }

  return null;
};

const responseHeaders = {
  "Cache-Control": "no-store",
  "Content-Security-Policy": "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; frame-src 'none'; object-src 'none'; img-src 'self' data:; font-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; form-action 'self'",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY"
};

createServer(async (request, response) => {
  const url = new URL(request.url || "/", "http://127.0.0.1");
  let file = await findPublicFile(url.pathname);
  let statusCode = 200;

  if (!file) {
    file = join(root, "404.html");
    statusCode = 404;
  }

  try {
    const information = await stat(file);
    if (!information.isFile()) throw new Error("Not a file");
  } catch {
    response.writeHead(404, {
      ...responseHeaders,
      "Content-Type": "text/plain; charset=utf-8"
    });
    response.end("Not found");
    return;
  }

  response.writeHead(statusCode, {
    ...responseHeaders,
    "Content-Type": contentTypes[extname(file).toLowerCase()] || "application/octet-stream"
  });

  if (request.method === "HEAD") {
    response.end();
    return;
  }

  createReadStream(file).pipe(response);
}).listen(port, "127.0.0.1", () => {
  console.log(`Wisebrook local preview: http://127.0.0.1:${port}/`);
});
