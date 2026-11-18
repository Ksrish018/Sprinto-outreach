// Plain-language description of every pipeline step, shown on How it works and Pipeline.
// Client-safe: no secrets, no server imports. Numbers here must match the code they describe.

export type StepId = "find" | "research" | "qualify" | "person" | "draft" | "review" | "learn";

export type Step = {
  id: StepId;
  n: number;
  title: string;
  short: string;
  what: string[];
  rules: string[];
  check: { label: string; href: string };
  empty: string;
};

export const STEPS: Step[] = [
  {
    id: "find",
    n: 1,
    title: "Find companies",
    short: "Reads funding news every day, keeps B2B SaaS companies, and drops any already on a compliance tool.",
    what: [
      "Every day at 06:00 IST it reads 10 news feeds: TechCrunch, Crunchbase News, Inc42, YourStory, EU-Startups, Tech.eu, BetaKit and three Google News searches.",
      "Only funding headlines are kept. The AI names the company that raised (never the investor), its round, sector and website; consumer, hardware, biotech and late-stage companies are dropped.",
      "A quick check of up to 4 pages (homepage, trust and security pages) drops companies whose trust center runs on Vanta, Drata, Secureframe or similar. Certified without a tool is kept with a renewal angle.",
      "The rest wait in a ranked pool for 30 days. Each run researches the top 30. If the pool is empty, a web search and your own domain lists are the backup.",
    ],
    rules: ["Skips Sprinto customers and competitors", "Skips anything researched in the last 90 days", "Drops companies already on a compliance tool"],
    check: { label: "Company pool funnel, on Pipeline", href: "/pipeline" },
    empty: "An empty pool means few new funding rounds in the feeds since the last read, or most were already on a compliance tool. The pool funnel on Pipeline shows which.",
  },
  {
    id: "research",
    n: 2,
    title: "Research",
    short: "Answers 8 questions about each company, keeping the exact quote and link for every fact.",
    what: [
      "Climbs a source ladder: public job-board APIs first, then a Google search, then the company's own pages (home, pricing, security, trust).",
      "Every fact is saved with its exact quote and link. Quotes from the company's own pages are checked word for word; search facts are marked unverified.",
      "The trust-center vendor (Vanta, Drata and others) is detected by code from the page itself, never guessed by the model.",
    ],
    rules: ["At most 15 fetches and 3 minutes per company", "Stops early once the questions are answered", "Respects robots.txt, 1 request per second"],
    check: { label: "Evidence and research timeline, on each company page", href: "/pipeline" },
    empty: "Many failed means sites blocked reading or timed out. It is a technical issue, not a market signal.",
  },
  {
    id: "qualify",
    n: 3,
    title: "Qualify",
    short: "Three gates, then a score out of 100. Go at 50 or more.",
    what: [
      "Gates: B2B SaaS, the right size (20 to 500 people), and not already using a compliance tool. Failing any gate is a No-go.",
      "Score: audit preparation 30, enterprise pressure 25, Series A to C funding 15, large clients 10, regulated industry 10, public cloud 5, geography 5.",
      "Human review when one missing fact would decide it. No-go when even a perfect answer could not reach 50.",
    ],
    rules: ["Go: score 50 or more", "Human review: one unknown decides it", "Code decides, not the model"],
    check: { label: "Decision, gates and reasons, on each company page", href: "/pipeline" },
    empty: "Mostly No-go means the ICP rules are strict for this batch. Mostly Human review means targets likely exist but facts were missing: approve them yourself.",
  },
  {
    id: "person",
    n: 4,
    title: "Find the person",
    short: "Uses Hunter to find one verified email for the right role, only for Go companies.",
    what: [
      "Picks the role by size: under 50 people, the founder or CTO; 50 to 200, the engineering or security lead; 200 to 500, the security leader first.",
      "When enterprise customers are pushing the company, the sales leader is the second choice.",
      "Verifies at most 2 emails per company, and checks the free Hunter quota before every search.",
    ],
    rules: ["Only for Go companies", "Email must be verified", "Stops when the Hunter quota is low"],
    check: { label: "Why this person, on Drafts and Why", href: "/drafts" },
    empty: "No person means Hunter had no verified email for the right role. The company goes to Human review.",
  },
  {
    id: "draft",
    n: 5,
    title: "Write the email",
    short: "One sourced fact as the hook, two pains for that role, one clear ask.",
    what: [
      "The hook is a single verified fact about the company, quoted from its own site.",
      "Two pains come from a fixed library, matched to the person's role and the company's triggers.",
      "A checker links every sentence to a company fact or a public Sprinto fact. One rewrite is allowed; after that the draft is blocked.",
      "Past edits you made to similar drafts are retrieved and shown to the writer.",
    ],
    rules: ["No claim without a source", "Hook must be verified", "Blocked drafts never reach Gmail"],
    check: { label: "Every claim and its source, on Drafts and Why", href: "/drafts" },
    empty: "No hook means no fact was strong enough to open with. The company goes to Human review rather than getting a generic email.",
  },
  {
    id: "review",
    n: 6,
    title: "You review in Gmail",
    short: "The draft lands in your own Gmail. Nothing is ever sent automatically.",
    what: [
      "Pilot mode: every draft is addressed to you, with a line naming who it would go to.",
      "Edit anything, then send it, or delete it. The app only ever creates drafts.",
      "At most 20 drafts a day, so review stays manageable.",
    ],
    rules: ["Never sends on its own", "Addressed only to you", "20 drafts a day at most"],
    check: { label: "Status of every draft, on Drafts and Why", href: "/drafts" },
    empty: "Drafts waiting in Gmail are not counted as sent until you send them and sync.",
  },
  {
    id: "learn",
    n: 7,
    title: "Learn from your edits",
    short: "Compares what you sent with what it wrote, and remembers the difference.",
    what: [
      "Sync with Gmail reads each thread: sent as written, sent with edits, or discarded.",
      "Each edit is stored as a before and after pair. The 5 closest past edits are given to the writer for the next similar draft.",
      "The disagreement score tracks how much you change. Above 50% over 20 drafts, after 2 weeks, drafting stops until someone looks.",
    ],
    rules: ["Learns only from what you actually send", "Kill switch above 50% disagreement", "Runs nightly, or on demand"],
    check: { label: "Disagreement score and loop health, on Health", href: "/health" },
    empty: "No corrections yet means no draft has been sent with edits. Sent as written counts as agreement.",
  },
];

export type StepCounts = Partial<Record<StepId, { value: number; label: string; sub?: string }>>;
