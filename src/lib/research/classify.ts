// Silent-failure detection (FR-3.8). Six of eight failure types return 200 with useless content,
// so every page is checked, not only the ones that error.

export type FailureReason =
  | "robots" | "bot_check" | "rate_limit" | "login_wall" | "captcha"
  | "non_text" | "empty" | "off_domain" | "timeout" | "http_error";

export type PageSignal = {
  status: number;
  contentType: string;
  html: string;
  cleanedWords: number;
  requestedHost: string;
  finalUrl: string;
};

const BOT = /(just a moment\.\.\.|checking your browser|cf-browser-verification|cf-challenge|attention required! \| cloudflare|ddos protection by|please enable javascript and cookies|access denied.{0,40}(akamai|incapsula)|perimeterx|px-captcha)/i;
const CAPTCHA = /(g-recaptcha|h-captcha|hcaptcha\.com|recaptcha\/api|are you a robot|verify you are human)/i;
const LOGIN = /(<input[^>]+type=["']password["'])/i;

function sameSite(a: string, b: string): boolean {
  const root = (h: string) => h.replace(/^www\./, "").split(".").slice(-2).join(".");
  return root(a) === root(b);
}

export function classifyPage(p: PageSignal): FailureReason | null {
  if (p.status === 429) return "rate_limit";
  if (p.status === 401 || p.status === 403) return BOT.test(p.html) ? "bot_check" : "login_wall";
  if (p.status >= 400) return "http_error";
  let finalHost = p.requestedHost;
  try {
    finalHost = new URL(p.finalUrl).hostname;
  } catch {
    // keep requested host
  }
  if (!sameSite(finalHost, p.requestedHost)) return "off_domain";
  if (/application\/pdf|image\//i.test(p.contentType)) return "non_text";
  if (BOT.test(p.html)) return "bot_check";
  if (CAPTCHA.test(p.html) && p.cleanedWords < 200) return "captcha";
  if (LOGIN.test(p.html) && p.cleanedWords < 200) return "login_wall";
  if (p.cleanedWords === 0) return "empty";
  return null;
}

// Fewer than 200 words after cleaning = probably rendered by JavaScript: retry once via Jina (FR-3.2).
export const JS_RETRY_WORDS = 200;
