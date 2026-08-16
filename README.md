# Wisebrook

Wisebrook is an independent, adults-only editorial guide to Canadian casino hotels. The site presents factual property context, travel considerations, responsible-gambling information, contact details, and legal pages in a restrained photographic design.

## Local development

```sh
npm run dev
```

The preview server listens at <http://127.0.0.1:4175> by default. Pass another port as the first argument when needed, for example `npm run dev -- 4180`.

## Production build

```sh
npm run build
```

The deployable static site is written to `dist/client`. The build also checks the complete public route set, brand and contact details, canonical URLs, adult-audience statement, stylesheet wrapping rules, crawler parity, and the absence of embedded third-party experiences.

## Cloudflare Pages

- Pages project: `wisebrook`
- GitHub repository: `j2oOrg/wisebrook-org-canadian-casino-hotel-guide`
- Production branch: `main`
- Build command: `npm run build`
- Build output directory: `dist/client`
- Node.js: `22.17.0`
- Pages URL: <https://wisebrook.pages.dev>
- Custom domains: <https://wisebrook.org> and <https://www.wisebrook.org>

Cloudflare Pages is connected to the GitHub repository, so every push to `main` starts a production build and deployment. Both custom domains are active on the Pages project. Their proxied DNS records target `wisebrook.pages.dev`; the pre-existing wildcard record is unchanged.

The zone uses Full (strict) origin encryption, redirects HTTP to HTTPS, requires TLS 1.2 or newer, and leaves Cloudflare email-address obfuscation off so published contact text is not rewritten.

The production site does not use analytics, tracking cookies, user-agent-specific behavior, or third-party runtime embeds.
