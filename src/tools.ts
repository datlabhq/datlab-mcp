import { z } from "zod";

import { asUrlObjects, compact, runActor } from "./apify.js";

export const ACTORS = {
  atsJobListings: "datlab~ats-job-listings",
  samGov: "datlab~sam-gov-contract-opportunities",
  sitemap: "datlab~sitemap-change-monitor",
  webPageToMarkdown: "datlab~web-page-to-markdown",
  siteToMarkdown: "datlab~site-to-markdown-crawler",
  screenshot: "datlab~bulk-website-screenshot",
} as const;

const urlList = z
  .array(z.string().min(1))
  .describe("HTTP or HTTPS URLs. Public pages only. No login-gated URLs.");

export const atsInput = z.object({
  careersUrls: z
    .array(z.string().min(1))
    .optional()
    .describe("Careers page URLs. The actor detects Personio, Teamtailor, Workable or Recruitee from the host."),
  personioCompanies: z.array(z.string().min(1)).optional().describe("Personio company slugs, for example checkmk-gmbh."),
  teamtailorCompanies: z.array(z.string().min(1)).optional().describe("Teamtailor company slugs, for example agilelab."),
  workableCompanies: z.array(z.string().min(1)).optional().describe("Workable company slugs, for example ottimate."),
  recruiteeCompanies: z.array(z.string().min(1)).optional().describe("Recruitee company slugs, for example trackman."),
  keywords: z.array(z.string().min(1)).optional(),
  locations: z.array(z.string().min(1)).optional(),
  departments: z.array(z.string().min(1)).optional(),
  remoteOnly: z.boolean().optional(),
  postedWithinDays: z.number().int().nonnegative().optional(),
  maxItems: z
    .number()
    .int()
    .positive()
    .max(1000)
    .optional()
    .describe("Cap on jobs returned. Default on the actor is 1000. Set this to control spend."),
  includeDescription: z.boolean().optional(),
});

export const samInput = z.object({
  keywords: z.array(z.string().min(1)).optional(),
  naicsCodes: z.array(z.string().min(1)).optional().describe("NAICS codes, for example 5415."),
  pscCodes: z.array(z.string().min(1)).optional(),
  noticeTypes: z
    .array(
      z.enum([
        "solicitation",
        "combined",
        "presolicitation",
        "sources_sought",
        "special_notice",
        "award",
        "justification",
        "modification",
        "surplus_sale",
        "bundle",
      ]),
    )
    .optional(),
  setAsideTypes: z.array(z.string().min(1)).optional(),
  agencies: z.array(z.string().min(1)).optional(),
  placeOfPerformanceStates: z.array(z.string().min(1)).optional().describe("US state names or abbreviations."),
  postedWithinDays: z.number().int().nonnegative().optional().describe("Only notices posted in the last N days. Default 7."),
  postedFrom: z.string().optional().describe("Posted-from date, YYYY-MM-DD."),
  postedTo: z.string().optional().describe("Posted-to date, YYYY-MM-DD."),
  activeOnly: z.boolean().optional(),
  openForResponseOnly: z.boolean().optional(),
  includeDescription: z.boolean().optional(),
  maxItems: z
    .number()
    .int()
    .positive()
    .max(1000)
    .optional()
    .describe("Cap on notices returned. Set this to control spend."),
});

export const sitemapInput = z.object({
  startUrls: z
    .array(z.string().min(1))
    .optional()
    .describe("Site origins or home pages. The actor finds sitemaps from robots.txt and common paths."),
  sitemapUrls: z.array(z.string().min(1)).optional().describe("Direct sitemap or RSS/Atom URLs, if you already have them."),
  maxUrls: z.number().int().positive().optional().describe("Cap on URLs returned per site. Set this to control spend."),
  trackChanges: z.boolean().optional().describe("Compare against the last run and mark added, removed, or lastmodChanged URLs."),
  onlyChanges: z.boolean().optional().describe("When tracking changes, return only the diffs."),
  stateKey: z.string().optional().describe("Name for the change-monitor state. Use one key per site you watch."),
});

export const webPageInput = z.object({
  urls: urlList.describe("Exact page URLs to fetch. This tool does not crawl or search."),
  scrapingTool: z
    .enum(["auto", "raw-http", "browser-playwright"])
    .optional()
    .describe("auto (default) uses HTTP and only opens a browser if the page looks client-rendered."),
  includeLinks: z.boolean().optional(),
});

export const crawlerInput = z.object({
  startUrls: urlList.describe("Start pages. The crawler follows in-scope links under these URLs."),
  maxCrawlPages: z
    .number()
    .int()
    .positive()
    .max(5000)
    .optional()
    .describe("Hard cap on pages visited. Set this. The actor default is 1000."),
  maxCrawlDepth: z.number().int().nonnegative().optional(),
  crawlerType: z
    .enum(["auto", "cheerio", "playwright:chromium"])
    .optional()
    .describe("auto (default) uses HTTP and only renders with Chromium when a page needs JavaScript."),
  includeUrlGlobs: z.array(z.string().min(1)).optional(),
  excludeUrlGlobs: z.array(z.string().min(1)).optional(),
  useSitemaps: z.boolean().optional(),
});

export const screenshotInput = z.object({
  urls: urlList.describe("Pages to capture in one run, with a shared browser."),
  format: z.enum(["png", "jpeg", "pdf"]).optional(),
  fullPage: z.boolean().optional().describe("true (actor default) captures the whole page. false captures the viewport only."),
  device: z
    .enum(["desktop", "iPhone 15", "Pixel 7", "iPad Pro 11"])
    .optional()
    .describe("desktop (default) uses viewportWidth and viewportHeight, default 1280x800."),
  viewportWidth: z.number().int().positive().optional(),
  viewportHeight: z.number().int().positive().optional(),
});

export type ToolSpec = {
  name: string;
  title: string;
  description: string;
  schema: z.ZodType<any, any, any>;
  run: (args: Record<string, unknown>) => Promise<unknown[]>;
};

function run(actorId: string, input: unknown, timeoutSecs?: number) {
  return runActor(actorId, input, { timeoutSecs });
}

export const tools: ToolSpec[] = [
  {
    name: "ats_job_listings",
    title: "ATS job listings",
    description:
      "Fetch open jobs from companies whose careers pages run on Personio, Teamtailor, Workable or Recruitee, in one schema. Use it when you have those careers URLs or company slugs. Do not use it for LinkedIn, Indeed, Greenhouse, Lever or SmartRecruiters, or for recruiter contact details (those are stripped). Output fields: title, company, platform, location, country, remote, workplaceType, department, employmentType, postedAt, url, optional description. Cost: first 100 jobs each UTC month are free, then $0.0015 per job plus $0.00005 per run start. Set maxItems to cap spend.",
    schema: atsInput,
    run: (args) => run(ACTORS.atsJobListings, compact(atsInput.parse(args))),
  },
  {
    name: "sam_gov_contract_opportunities",
    title: "SAM.gov contract opportunities",
    description:
      "Fetch US federal contract opportunities from SAM.gov public data. No SAM.gov API key is needed. Use it for notices filtered by keyword, NAICS, PSC, set-aside, agency, state or posting date. Do not use it for contact names, emails or phones (excluded on purpose) or for non-US tenders. Output fields: noticeId, solicitationNumber, title, noticeType, department, subTier, naicsCode, pscCode, setAside, postedDate, responseDeadline, popState, awardAmount, awardee, url, optional description. Cost: first 100 notices each UTC month are free, then $0.0015 per notice plus $0.00005 per run start. Set maxItems to cap spend.",
    schema: samInput,
    run: (args) => run(ACTORS.samGov, compact(samInput.parse(args)), 240),
  },
  {
    name: "sitemap_change_monitor",
    title: "Sitemap extractor and change monitor",
    description:
      "List every URL in a site's sitemaps, or see which URLs were added, removed or had their lastmod changed since the last run. Use it when the site has a sitemap or RSS feed. Do not use it when you need page text (use web_page_to_markdown). Output fields: url, lastmod, changeType, previousLastmod, site, sitemapUrl, recordType. Cost: first 500 URL results and 10 page checks each UTC month are free, then $0.0003 per URL result and $0.002 per page check, plus $0.00005 per run start. Set maxUrls to cap spend.",
    schema: sitemapInput,
    run: (args) => run(ACTORS.sitemap, compact(sitemapInput.parse(args))),
  },
  {
    name: "web_page_to_markdown",
    title: "Web page to Markdown",
    description:
      "Fetch known URLs and return each page as clean Markdown (main content) plus metadata, one result per URL. Use it when you already have the URLs. Do not use it to crawl a site (use site_to_markdown_crawler) or to web-search. Output fields: url, markdown, metadata.title, metadata.description, metadata.canonicalUrl, links, wordCount, tokenEstimate, crawl.renderedWith, error (set when the page failed, and failed pages are not billed). Cost: first 100 pages each UTC month are free, then $0.0005 per HTTP page or $0.001 per browser page, plus $0.00005 per run start.",
    schema: webPageInput,
    run: (args) => {
      const input = webPageInput.parse(args);
      return run(
        ACTORS.webPageToMarkdown,
        compact({
          startUrls: asUrlObjects(input.urls),
          scrapingTool: input.scrapingTool,
          includeLinks: input.includeLinks,
        }),
      );
    },
  },
  {
    name: "site_to_markdown_crawler",
    title: "Website to Markdown crawler",
    description:
      "Crawl a docs site or a section of one and return each page as Markdown for RAG or a knowledge base. It follows links under the start URL. Use it when you need a whole site or section. Do not use it when you already know the exact URLs (use web_page_to_markdown) or when the site needs a login. Output fields: url, markdown, text, metadata, crawl.depth, crawl.renderedWith, wordCount, tokenEstimate. Cost: first 300 pages each UTC month are free, then $0.0001 per HTTP page, $0.00035 per browser page, $0.0005 per saved file, plus $0.00005 per run start. Always set maxCrawlPages.",
    schema: crawlerInput,
    run: (args) => {
      const input = crawlerInput.parse(args);
      const { startUrls, ...rest } = input;
      return run(
        ACTORS.siteToMarkdown,
        compact({ startUrls: asUrlObjects(startUrls), ...rest }),
        300,
      );
    },
  },
  {
    name: "bulk_website_screenshot",
    title: "Bulk website screenshot",
    description:
      "Take PNG, JPEG or PDF screenshots of a list of public URLs and return a public image URL for each. Use it when you need images, not page text. Do not use it for pages behind a login, or when you want Markdown (use web_page_to_markdown). Output fields: url, screenshotUrl, width, height, sizeBytes, title, httpStatusCode, error. Cost: first 25 screenshots each UTC month are free (the start fee is still charged), then $0.0006 per screenshot plus $0.003 per run start. Batch many URLs in one call.",
    schema: screenshotInput,
    run: (args) => {
      const input = screenshotInput.parse(args);
      const { urls, ...rest } = input;
      return run(ACTORS.screenshot, compact({ urls: asUrlObjects(urls), ...rest }), 240);
    },
  },
];
