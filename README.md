# DatLab MCP server

An MCP server that wraps the six public DatLab actors on [Apify Store](https://apify.com/datlab). It runs as a local stdio process. You pass your own Apify API token. The server never ships with one.

Use this when an agent should call a hosted DatLab actor instead of writing a one-off scraper. The actors cover jobs, US federal contract notices, sitemaps, page-to-Markdown, site crawls, and screenshots. They stay cheap because the work is batched and billed per result, with a free monthly allowance on each actor.

Do not use this when you only need a single HTTP fetch you could do yourself, or when the page sits behind a login, a captcha, or a paywall. The actors only touch public data, they honour robots.txt and rate limits, and they strip personal contact details.

Source: https://github.com/datlabhq/datlab-mcp

## Tools

Each tool maps to one actor. Set a max (`maxItems`, `maxUrls`, or `maxCrawlPages`) so the run cannot surprise you on price. Failed and robots-blocked pages are not billed on the Markdown tools.

| Tool | Actor | Use it when | Cost, after the monthly free allowance |
| --- | --- | --- | --- |
| `ats_job_listings` | [datlab/ats-job-listings](https://apify.com/datlab/ats-job-listings) | Open jobs from Personio, Teamtailor, Workable or Recruitee careers pages | First 100 jobs free / UTC month, then $0.0015 per job + $0.00005 start |
| `sam_gov_contract_opportunities` | [datlab/sam-gov-contract-opportunities](https://apify.com/datlab/sam-gov-contract-opportunities) | US federal SAM.gov notices, no SAM.gov API key | First 100 notices free / UTC month, then $0.0015 per notice + $0.00005 start |
| `sitemap_change_monitor` | [datlab/sitemap-change-monitor](https://apify.com/datlab/sitemap-change-monitor) | Every URL in a sitemap, or the added / removed / lastmod diffs since last run | First 500 URLs and 10 page checks free / UTC month, then $0.0003 per URL, $0.002 per page check + $0.00005 start |
| `web_page_to_markdown` | [datlab/web-page-to-markdown](https://apify.com/datlab/web-page-to-markdown) | You already have exact URLs and want clean Markdown | First 100 pages free / UTC month, then $0.0005 HTTP or $0.001 browser page + $0.00005 start |
| `site_to_markdown_crawler` | [datlab/site-to-markdown-crawler](https://apify.com/datlab/site-to-markdown-crawler) | You want a whole docs site or section as Markdown | First 300 pages free / UTC month, then $0.0001 HTTP or $0.00035 browser page + $0.00005 start |
| `bulk_website_screenshot` | [datlab/bulk-website-screenshot](https://apify.com/datlab/bulk-website-screenshot) | PNG, JPEG or PDF screenshots, with a public image URL back | First 25 screenshots free / UTC month (start fee still applies), then $0.0006 per shot + $0.003 start |

Tool input schemas are the useful actor fields, not every option. `urls` and `startUrls` on the Markdown and screenshot tools are plain string lists. The server turns them into the `{ "url": "..." }` objects Apify expects.

You can also pin the same actors on Apify's own hosted MCP server with no local process: `https://mcp.apify.com/?tools=datlab/ats-job-listings,datlab/sam-gov-contract-opportunities,datlab/sitemap-change-monitor,datlab/web-page-to-markdown,datlab/site-to-markdown-crawler,datlab/bulk-website-screenshot`. This repo is the open-source, self-hosted option, and the one you can list in MCP directories.

## Setup

1. Create an Apify account if you do not have one, and mint a personal API token in the console. Do not commit the token.
2. Run the server with that token in the environment.

Cursor, Claude Desktop, or any MCP client that speaks stdio:

```json
{
  "mcpServers": {
    "datlab": {
      "command": "npx",
      "args": ["-y", "github:datlabhq/datlab-mcp"],
      "env": {
        "APIFY_TOKEN": "your-apify-token"
      }
    }
  }
}
```

From a clone:

```bash
git clone https://github.com/datlabhq/datlab-mcp.git
cd datlab-mcp
npm install
npm run build
```

Then point the client at `node /path/to/datlab-mcp/dist/index.js`, with `APIFY_TOKEN` in `env`.

The process talks MCP on stdin/stdout. Keep logs off stdout. The server starts and can list tools even if `APIFY_TOKEN` is missing. The token is read only when a tool is called.

## Example

Call `web_page_to_markdown` with `{ "urls": ["https://example.com"], "scrapingTool": "raw-http" }`. You get one dataset item back, including `markdown`, `wordCount`, and `metadata.title`.

Call `sam_gov_contract_opportunities` with `{ "keywords": ["software"], "postedWithinDays": 7, "maxItems": 20 }`. You get up to 20 recent notices, with `noticeId`, `title`, `noticeType`, `postedDate`, and `url`.

## Development

```bash
npm install
npm test
npm run build
```

CI runs typecheck, tests, and the build on every push to `main`.

## License

MIT. Brand is DatLab.
