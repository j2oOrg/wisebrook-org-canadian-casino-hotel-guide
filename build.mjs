import { access, copyFile, cp, mkdir, readFile, readdir, rm, stat } from "node:fs/promises";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const dist = join(root, "dist");
const client = join(dist, "client");

const routeSpecifications = [
  { route: "/", candidates: ["index.html"] },
  { route: "/properties", candidates: ["properties.html", "properties/index.html"] },
  { route: "/how-we-read", candidates: ["how-we-read.html", "how-we-read/index.html"] },
  { route: "/about", candidates: ["about.html", "about/index.html"] },
  {
    route: "/responsible-gambling",
    candidates: ["responsible-gambling.html", "responsible-gambling/index.html"]
  },
  { route: "/contact", candidates: ["contact.html", "contact/index.html"] },
  { route: "/terms", candidates: ["terms.html", "terms/index.html"] },
  { route: "/privacy", candidates: ["privacy.html", "privacy/index.html"] },
  { route: "/sources", candidates: ["sources.html", "sources/index.html"] },
  { route: "/404.html", candidates: ["404.html"] }
];

const requiredRootFiles = [
  "styles.css",
  "site.js",
  "robots.txt",
  "sitemap.xml",
  "favicon.svg",
  "_headers"
];

const ignoredDirectories = new Set([".git", ".wrangler", "assets", "dist", "node_modules"]);
const forbiddenCarryover = [
  "Betafield",
  "Sunjade",
  "Centrallion",
  "Cinnabon",
  "Cinnamon Bun",
  "Winter Land"
];
const allowedEmails = new Set(["contact@wisebrook.org", "support@wisebrook.org"]);

const toPosix = (path) => path.replaceAll("\\", "/");

const exists = async (path) => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

const collectHtml = async (directory, collected = []) => {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      await collectHtml(fullPath, collected);
    } else if (entry.isFile() && extname(entry.name).toLowerCase() === ".html") {
      collected.push(fullPath);
    }
  }
  return collected;
};

const canonicalRouteForFile = (file) => {
  const sourcePath = toPosix(relative(root, file));
  if (sourcePath === "index.html") return "/";
  if (sourcePath === "404.html") return "/404.html";
  if (sourcePath.endsWith("/index.html")) return `/${sourcePath.slice(0, -11)}`;
  return `/${sourcePath.slice(0, -5)}`;
};

const getAttribute = (tag, name) => {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  return match ? match[2] : null;
};

const normalizeWebPath = (path) => {
  if (path === "/") return path;
  return path.endsWith("/") ? path.slice(0, -1) : path;
};

const validatePage = async (file) => {
  const sourcePath = toPosix(relative(root, file));
  const expectedRoute = canonicalRouteForFile(file);
  const html = await readFile(file, "utf8");

  for (const term of forbiddenCarryover) {
    if (html.toLocaleLowerCase("en").includes(term.toLocaleLowerCase("en"))) {
      throw new Error(`${sourcePath} contains unrelated-site carryover: ${term}`);
    }
  }

  if (/\biframe\b/i.test(html) || /<(?:embed|object)\b/i.test(html)) {
    throw new Error(`${sourcePath} contains an embedded third-party experience.`);
  }

  if (!html.includes("Wisebrook")) {
    throw new Error(`${sourcePath} is missing the Wisebrook brand name.`);
  }

  for (const email of allowedEmails) {
    if (!html.includes(email)) {
      throw new Error(`${sourcePath} is missing the required address: ${email}`);
    }
  }

  const pageEmails = html.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  for (const email of pageEmails) {
    if (!allowedEmails.has(email.toLocaleLowerCase("en"))) {
      throw new Error(`${sourcePath} contains an unexpected email address: ${email}`);
    }
  }

  if (!/(?:18\+|18 years of age or older|18 or older|adults? aged? 18)/i.test(html)) {
    throw new Error(`${sourcePath} is missing a clear 18-or-older audience statement.`);
  }

  const linkTags = [...html.matchAll(/<link\b[^>]*>/gi)].map((match) => match[0]);
  const canonicalTag = linkTags.find((tag) =>
    (getAttribute(tag, "rel") || "").split(/\s+/).includes("canonical")
  );
  const canonicalHref = canonicalTag && getAttribute(canonicalTag, "href");

  if (!canonicalHref) {
    throw new Error(`${sourcePath} is missing a canonical link.`);
  }

  let canonical;
  try {
    canonical = new URL(canonicalHref);
  } catch {
    throw new Error(`${sourcePath} has an invalid canonical URL: ${canonicalHref}`);
  }

  if (
    canonical.protocol !== "https:" ||
    canonical.hostname !== "wisebrook.org" ||
    normalizeWebPath(canonical.pathname) !== normalizeWebPath(expectedRoute) ||
    canonical.search ||
    canonical.hash
  ) {
    throw new Error(
      `${sourcePath} canonical must be https://wisebrook.org${expectedRoute === "/" ? "/" : expectedRoute}`
    );
  }

  if (!/<html\b[^>]*\blang\s*=\s*["']en(?:-[A-Z]{2})?["']/i.test(html)) {
    throw new Error(`${sourcePath} must declare an English document language.`);
  }

  if ((html.match(/<h1\b/gi) || []).length !== 1) {
    throw new Error(`${sourcePath} must contain exactly one h1.`);
  }

  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    const tag = match[0].slice(0, match[0].indexOf(">") + 1);
    const source = getAttribute(tag, "src");
    const type = (getAttribute(tag, "type") || "").toLocaleLowerCase("en");
    if (type === "application/ld+json") continue;
    if (!source || !/^\/?site\.js(?:[?#].*)?$/.test(source)) {
      throw new Error(`${sourcePath} may only execute the local site.js file.`);
    }
  }

  for (const match of html.matchAll(/\b(?:src|href)\s*=\s*(["'])(\/assets\/[^"']+)\1/gi)) {
    const assetUrl = match[2].split(/[?#]/, 1)[0];
    const assetPath = join(root, ...decodeURIComponent(assetUrl).split("/").filter(Boolean));
    if (!(await exists(assetPath))) {
      throw new Error(`${sourcePath} references a missing asset: ${assetUrl}`);
    }
  }
};

for (const file of requiredRootFiles) {
  if (!(await exists(join(root, file)))) {
    throw new Error(`Missing required public file: ${file}`);
  }
}

if (!(await exists(join(root, "assets")))) {
  throw new Error("Missing required assets directory.");
}

const sourceAssetEntries = await readdir(join(root, "assets"), { recursive: true });
for (const assetEntry of sourceAssetEntries) {
  const normalizedAssetName = assetEntry.toLocaleLowerCase("en").replace(/[^a-z0-9]+/g, " ");
  for (const term of forbiddenCarryover) {
    const normalizedTerm = term.toLocaleLowerCase("en").replace(/[^a-z0-9]+/g, " ");
    if (normalizedAssetName.includes(normalizedTerm)) {
      throw new Error(`assets contains an unrelated-site carryover filename: ${assetEntry}`);
    }
  }
}

for (const specification of routeSpecifications) {
  const matches = [];
  for (const candidate of specification.candidates) {
    if (await exists(join(root, candidate))) matches.push(candidate);
  }
  if (!matches.length) {
    throw new Error(
      `Missing page for ${specification.route}. Expected ${specification.candidates.join(" or ")}.`
    );
  }
  if (matches.length > 1) {
    throw new Error(`Multiple source pages resolve to ${specification.route}: ${matches.join(", ")}`);
  }
}

const htmlFiles = await collectHtml(root);
for (const file of htmlFiles) {
  await validatePage(file);
}

const siteScript = await readFile(join(root, "site.js"), "utf8");
if (
  /navigator\s*\.\s*userAgent|userAgentData|Googlebot|AdsBot|\bdocument\s*\.\s*cookie\b|\blocalStorage\b|\bsessionStorage\b|\bsendBeacon\b|\bdataLayer\b|\banalytics\b/i.test(
    siteScript
  )
) {
  throw new Error("site.js contains crawler branching, tracking, or browser storage behavior.");
}

const stylesheet = await readFile(join(root, "styles.css"), "utf8");
for (const occurrence of stylesheet.matchAll(/overflow-wrap\s*:\s*anywhere/gi)) {
  const openingBrace = stylesheet.lastIndexOf("{", occurrence.index);
  const previousClosingBrace = stylesheet.lastIndexOf("}", openingBrace);
  const selector = stylesheet.slice(previousClosingBrace + 1, openingBrace);
  if (!selector.includes(".contact-email")) {
    throw new Error("Only .contact-email may use overflow-wrap: anywhere.");
  }
}

const allPublicText = [
  ...htmlFiles.map((file) => readFile(file, "utf8")),
  readFile(join(root, "styles.css"), "utf8"),
  readFile(join(root, "site.js"), "utf8")
];
const combinedPublicText = (await Promise.all(allPublicText)).join("\n");
for (const term of forbiddenCarryover) {
  if (combinedPublicText.toLocaleLowerCase("en").includes(term.toLocaleLowerCase("en"))) {
    throw new Error(`Published files contain unrelated-site carryover: ${term}`);
  }
}

const sitemap = await readFile(join(root, "sitemap.xml"), "utf8");
if (!sitemap.includes("<lastmod>2026-08-16</lastmod>")) {
  throw new Error("sitemap.xml must use the release date 2026-08-16.");
}
for (const specification of routeSpecifications.filter(({ route }) => route !== "/404.html")) {
  const url = `https://wisebrook.org${specification.route === "/" ? "/" : specification.route}`;
  if (!sitemap.includes(`<loc>${url}</loc>`)) {
    throw new Error(`sitemap.xml is missing ${url}.`);
  }
}

await rm(dist, { recursive: true, force: true });
await mkdir(client, { recursive: true });

for (const file of htmlFiles) {
  const destination = join(client, relative(root, file));
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(file, destination);
}

for (const file of requiredRootFiles) {
  await copyFile(join(root, file), join(client, file));
}

await cp(join(root, "assets"), join(client, "assets"), { recursive: true });

const assetEntries = await readdir(join(client, "assets"), {
  recursive: true,
  withFileTypes: true
});
const assetCount = assetEntries.filter((entry) => entry.isFile()).length;

console.log(
  `Built ${htmlFiles.length} HTML pages and ${assetCount} asset entries for Cloudflare Pages at ${client}`
);
