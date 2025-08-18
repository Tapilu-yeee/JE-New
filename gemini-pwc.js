// public/js/gemini-pwc.js
const GEMINI_API_KEY = window.__GEMINI_API_KEY__;
const GENERATE_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/generateContent?key=" + GEMINI_API_KEY;
const CACHED_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/cachedContents?key=" + GEMINI_API_KEY;
const PWC_VERSION = "pwc.v1";
const PWC_PROMPT_URL = "/prompts/pwc_prompt.txt";
const LS_HASH = `PWC_HASH_${PWC_VERSION}`;
const LS_CACHE_NAME = `PWC_CACHE_${PWC_VERSION}`;

async function sha256(text) {
  const buf = new TextEncoder().encode(text);
  const hashBuf = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(hashBuf)]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}
async function loadText(url) {
  const res = await fetch(url, { cache: "force-cache" });
  if (!res.ok) throw new Error(`Không đọc được ${url}`);
  return res.text();
}

export async function ensurePwCCache() {
  const pwcText = await loadText(PWC_PROMPT_URL);
  const hash = await sha256(pwcText);
  const savedHash = localStorage.getItem(LS_HASH);
  const savedCache = localStorage.getItem(LS_CACHE_NAME);
  if (savedHash === hash && savedCache) {
    return { cacheName: savedCache, pwcText, hash };
  }
  const body = {
    model: "models/gemini-1.5-flash-001",
    ttl: "604800s",
    systemInstruction: { parts: [{ text: pwcText }] },
    displayName: `PwC_Method_${PWC_VERSION}`
  };
  const resp = await fetch(CACHED_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!resp.ok) throw new Error("Tạo cache PwC thất bại: " + await resp.text());
  const data = await resp.json();
  const cacheName = data.name;
  localStorage.setItem(LS_HASH, hash);
  localStorage.setItem(LS_CACHE_NAME, cacheName);
  return { cacheName, pwcText, hash };
}

function buildSchema() {
  return {
    type: "object",
    properties: {
      summary: { type: "string" },
      overallRank: { type: "string" },
      factors: {
        type: "array",
        items: {
          type: "object",
          properties: {
            factor: { type: "string" },
            score: { type: "string" },
            rationale: { type: "string" },
            evidence: { type: "string" }
          },
          required: ["factor", "score", "rationale", "evidence"],
          additionalProperties: false
        }
      }
    },
    required: ["summary", "overallRank", "factors"],
    additionalProperties: false
  };
}

export async function evaluateJDWithPwC(jdText, extraContext = "") {
  const { cacheName } = await ensurePwCCache();
  const schema = buildSchema();
  const req = {
    model: "models/gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          { text: "Bạn là hệ thống đánh giá JD theo phương pháp PwC (12 yếu tố). Hãy trả về JSON theo schema đã cho." },
          { text: "Dưới đây là JD cần chấm:" },
          { text: jdText },
          ...(extraContext ? [{ text: `Ngữ cảnh bổ sung: ${extraContext}` }] : [])
        ]
      }
    ],
    config: {
      cachedContent: cacheName,
      response_mime_type: "application/json",
      response_schema: schema,
      temperature: 0.2
    }
  };
  const resp = await fetch(GENERATE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req)
  });
  if (!resp.ok) throw new Error("Gemini generateContent lỗi: " + await resp.text());
  const data = await resp.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const jsonStr = parts.map(p => p.text || "").join("\n").trim();
  return JSON.parse(jsonStr);
}

window.__PWC_EVAL__ = { evaluateJDWithPwC, ensurePwCCache };