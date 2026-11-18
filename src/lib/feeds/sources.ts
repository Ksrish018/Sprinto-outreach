// News feeds read every day into the company pool. Client-safe: shown on the ICP page.
// Each was checked to answer with funding headlines (Nov 2026). Entrackr (404) and FinSMEs (403) did not.

export type Feed = { id: string; name: string; url: string; region: string };

const gnews = (q: string) => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;

export const FEEDS: Feed[] = [
  { id: "techcrunch", name: "TechCrunch Fundraising", url: "https://techcrunch.com/category/fundraising/feed/", region: "Global" },
  { id: "crunchbase", name: "Crunchbase News", url: "https://news.crunchbase.com/feed/", region: "Global" },
  { id: "inc42", name: "Inc42 Buzz", url: "https://inc42.com/buzz/feed/", region: "India" },
  { id: "yourstory", name: "YourStory", url: "https://yourstory.com/feed", region: "India" },
  { id: "eustartups", name: "EU-Startups", url: "https://www.eu-startups.com/feed/", region: "Europe" },
  { id: "techeu", name: "Tech.eu", url: "https://tech.eu/feed/", region: "Europe" },
  { id: "betakit", name: "BetaKit", url: "https://betakit.com/feed/", region: "Canada" },
  { id: "gnews_saas_a", name: "Google News: SaaS Series A", url: gnews('"raises" "Series A" SaaS when:7d'), region: "Global" },
  { id: "gnews_b2b_b", name: "Google News: B2B Series B", url: gnews('"Series B" raises B2B software when:7d'), region: "Global" },
  { id: "gnews_compliance", name: "Google News: SaaS funding + enterprise", url: gnews('startup raises funding "enterprise customers" SaaS when:7d'), region: "Global" },
];

// Headlines that look like a funding round. Everything else in a feed is ignored before any AI call.
export const FUNDING_RE = /\b(raises?|raised|secures?|secured|bags?|lands?|closes?|nabs?|funding|investment|series [a-d]\b|seed round|pre-seed)\b/i;
