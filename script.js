// =========================================================
// JD Evaluation (PwC 12 factors) - Gemini client-side
// - Reads JD .docx/.txt
// - Keeps PwC prompt (fetch ./pwc_prompt.txt)
// - Uses Mammoth convertToHtml to preserve structure
// - Optional model fallback (2.0-flash -> 1.5-flash)
// - Compact error messages
//
// ⚠️ NOTE: This is client-side. If your site is public, API key can be extracted.
// =========================================================

import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

/* ====== CHỈNH API KEY Ở ĐÂY (1 dòng duy nhất) ====== */
const GOOGLE_API_KEY = "AIzaSy_ĐIỀN_API_KEY_MỚI_VÀO_ĐÂY";
/* ==================================================== */

const $ = (sel) => document.querySelector(sel);

function showError(msg) {
  const card = $("#errorCard");
  const txt = $("#errorText");
  if (txt) txt.textContent = msg || "";
  if (card) card.hidden = !msg;
}

function showResult(text) {
  const card = $("#resultCard");
  const box = $("#resultBox");
  if (box) box.textContent = text || "";
  if (card) card.hidden = !text;
}

async function loadPwCPrompt() {
  const res = await fetch("./pwc_prompt.txt", { cache: "no-store" });
  if (!res.ok) {
    throw new Error("Không tải được pwc_prompt.txt (hãy để file cùng thư mục index.html).");
  }
  return await res.text();
}

async function readJDFile(file) {
  const name = (file?.name || "").toLowerCase();

  if (name.endsWith(".txt")) {
    return (await file.text()) || "";
  }

  if (name.endsWith(".docx")) {
    if (!window.mammoth?.convertToHtml) {
      throw new Error("Thiếu mammoth (convertToHtml). Hãy kiểm tra index.html đã include mammoth.browser.min.js.");
    }
    const ab = await file.arrayBuffer();
    // Preserve structure: headings, bullets, tables (as HTML)
    const out = await window.mammoth.convertToHtml({ arrayBuffer: ab }, { includeDefaultStyleMap: true });
    // out.value is HTML string
    return out.value || "";
  }

  throw new Error("Chỉ hỗ trợ file .docx hoặc .txt");
}

function compactGeminiError(err) {
  const raw = String(err?.message || err || "");
  const lower = raw.toLowerCase();

  // Leaked key
  if (lower.includes("reported as leaked") || lower.includes("leaked")) {
    return "API key đã bị Google đánh dấu bị lộ (leaked) → hãy tạo key mới (khuyến nghị project mới).";
  }

  // API disabled / service disabled
  if (raw.includes("SERVICE_DISABLED") || lower.includes("has not been used in project") || lower.includes("is disabled")) {
    return "Generative Language API (Gemini) đang tắt/chưa bật trong project → vào Google Cloud Console và Enable API.";
  }

  // Quota / rate limit
  if (lower.includes("quota") || lower.includes("429") || lower.includes("resourceexhausted")) {
    // If limit:0 appears, it's basically no free-tier quota.
    if (lower.includes("limit: 0") || lower.includes("limit:0")) {
      return "Quota = 0 (free-tier bị khóa/không được cấp) → dùng project/key khác hoặc bật Billing.";
    }
    return "Bạn đã vượt quota/rate limit → thử lại sau hoặc dùng key/project khác.";
  }

  // Permission / invalid key
  if (lower.includes("api key not valid") || lower.includes("invalid api key") || lower.includes("permissiondenied") || lower.includes("403")) {
    return "Không có quyền/Key không hợp lệ → kiểm tra key, restriction, API đã bật.";
  }

  return raw;
}

async function generateWithModel(modelName, prompt) {
  const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
  const model = genAI.getGenerativeModel({
    model: modelName,
    // giữ nội dung prompt; chỉ chỉnh cấu hình để ổn định output
    generationConfig: { temperature: 0.2 }
  });

  const resp = await model.generateContent(prompt);
  return resp?.response?.text?.() || "";
}

async function evaluateWithGemini({ jobTitle, jdHtmlOrText }) {
  if (!GOOGLE_API_KEY || GOOGLE_API_KEY.includes("ĐIỀN_API_KEY")) {
    throw new Error('Chưa cấu hình GOOGLE_API_KEY trong script.js (sửa dòng const GOOGLE_API_KEY = "...").');
  }

  const pwcPrompt = await loadPwCPrompt();

  // Keep prompt as-is, only append context + JD (HTML preserved)
  const fullPrompt = `
${pwcPrompt}

---
Tên vị trí: ${jobTitle}

JD mới (giữ cấu trúc HTML nếu có):
${jdHtmlOrText}

Yêu cầu bắt buộc:
- Đánh giá theo đúng 12 yếu tố PwC.
- Mỗi yếu tố có: Mức (A–J), Lý do, Dẫn chứng từ JD.
- Trả kết quả ở dạng bảng (12 dòng tương ứng 12 yếu tố).
- Nếu JD thiếu thông tin ở yếu tố nào, ghi "Thiếu dữ liệu" và nêu giả định tối thiểu.
`.trim();

  // Optional fallback: try 2.0-flash first, then 1.5-flash
  let text = "";
  try {
    text = await generateWithModel("gemini-2.0-flash", fullPrompt);
  } catch (e1) {
    // fallback for quota/model availability
    text = await generateWithModel("gemini-1.5-flash", fullPrompt);
  }
  return text || "";
}

$("#btnEvaluate")?.addEventListener("click", async () => {
  const btn = $("#btnEvaluate");
  try {
    showError("");
    showResult("");

    const jobTitle = $("#jobTitle")?.value?.trim();
    const file = $("#fileInput")?.files?.[0];

    if (!jobTitle) throw new Error("Vui lòng nhập tên vị trí công việc.");
    if (!file) throw new Error("Vui lòng tải lên file JD (.docx hoặc .txt).");

    if (btn) { btn.disabled = true; btn.textContent = "Đang đánh giá..."; }

    const jd = (await readJDFile(file)).trim();
    if (!jd) throw new Error("JD rỗng hoặc không đọc được nội dung từ file.");

    const result = await evaluateWithGemini({ jobTitle, jdHtmlOrText: jd });
    if (!result) throw new Error("Không nhận được kết quả từ Gemini.");

    showResult(result);
  } catch (err) {
    console.error(err);
    showError(compactGeminiError(err));
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Đánh giá JD"; }
  }
});
