// ====== Danh sách yếu tố ======
const FACTORS = [
  "Trình độ học vấn","Kinh nghiệm","Mức độ phức tạp của công việc","Phạm vi công việc",
  "Mức độ giải quyết vấn đề","Mức độ cần được chỉ dẫn/giám sát",
  "Mức độ liên lạc khi thực hiện công việc","Trách nhiệm giám sát & quản lý",
  "Ảnh hưởng của các quyết định","Quyền hạn","Môi trường làm việc","Yêu cầu thể chất"
];

// ====== Schema & Allowed codes ======
const PWC_JSON_SCHEMA = {
  type: "object",
  properties: {
    jobTitle: { type: "string" },
    factors: {
      type: "array",
      minItems: 12,
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          grade: { type: "string" },
          reason: { type: "string" },
          evidence: { type: "string" }
        },
        required: ["name","grade","reason"]
      }
    },
    overallSummary: { type: "string" }
  },
  required: ["factors"]
};

// Danh mục mã hợp lệ theo từng yếu tố (có thể chỉnh theo handbook nội bộ)
const ALLOWED_BY_FACTOR = {
  "Trình độ học vấn": [
    "A","B","C","D","E","F1","F2","G1","G2","H1","H2","I1","I2","I3","J"
  ],
  "Kinh nghiệm": [
    "A","B","C","D","E","F","G1","G2","G3","H1","H2","H3","I1","I2","I3","J","K","L"
  ],
  "Mức độ phức tạp của công việc": [
    "A1","A2","A3","B1","B2","B3","C1","C2","C3","D1","D2","D3","E1","E2","E3","F1","F2","F3"
  ],
  "Phạm vi công việc": ["A","B","C","D","E","F","G","H"],
  "Mức độ giải quyết vấn đề": [
    "A1","A2","A3","B1","B2","B3","C1","C2","C3","D1","D2","D3","E1","E2","E3","F1","F2","F3","G1","G2","G3","H1","H2","H3"
  ],
  "Mức độ cần được chỉ dẫn/giám sát": [
    "A1","A2","A3","B1","B2","B3","C1","C2","C3","D1","D2","D3","E1","E2","E3","F1","F2","F3","G1","G2","G3","H1","H2","H3"
  ],
  "Mức độ liên lạc khi thực hiện công việc": [
    "A1","A2","A3","A4","A5",
    "B1","B2","B3","B4","B5",
    "C1","C2","C3","C4","C5",
    "D11","D12","D13","D14","D15",
    "D21","D22","D23","D24","D25",
    "D31","D32","D33","D34","D35",
    "E1","E2","E3","E4","E5",
    "F1","F2","F3","F4","F5"
  ],
  "Trách nhiệm giám sát & quản lý": [
    "A",
    "B1","B2","B3",
    "C11","C12","C13","C21","C22","C23","C31","C32","C33",
    "D11","D12","D13","D21","D22","D23","D31","D32","D33",
    "E11","E12","E13","E21","E22","E23","E31","E32","E33",
    "F11","F12","F13","F21","F22","F23","F31","F32","F33",
    "G11","G12","G13","G21","G22","G23","G31","G32","G33",
    "H11","H12","H13","H21","H22","H23","H31","H32","H33"
  ],
  "Ảnh hưởng của các quyết định": [
    "A1","B1","B2","B3","C1","C2","C3","D1","D2","D3","E1","E2","E3","F1","F2","F3","NA"
  ],
  "Quyền hạn": [
    "A0","A1","A2","A3","B0","B1","B2","B3","C0","C1","C2","C3","D0","D1","D2","D3","E0","E1","E2","E3","NA"
  ],
  "Môi trường làm việc": ["A1","A2","A3","B1","B2","B3","C1","C2","C3","D1","D2","D3","E1","E2","E3","NA"],
  "Yêu cầu thể chất": ["A1","A2","A3","B1","B2","B3","C1","C2","C3","D1","D2","D3","E1","E2","E3"]
};

// Những yếu tố yêu cầu mã chi tiết (chữ + số), không chấp nhận chỉ mỗi chữ cái
const FINE_GRAINED_FACTORS = new Set([
  "Mức độ phức tạp của công việc",
  "Mức độ giải quyết vấn đề",
  "Mức độ cần được chỉ dẫn/giám sát",
  "Mức độ liên lạc khi thực hiện công việc",
  "Trách nhiệm giám sát & quản lý",
  "Ảnh hưởng của các quyết định",
  "Quyền hạn",
  "Môi trường làm việc",
  "Yêu cầu thể chất"
]);

// ====== Tiện ích ======
const $ = sel => document.querySelector(sel);
const escapeHTML = s => String(s||"").replace(/[&<>"]+/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[m]));
function normalizeGrade(s){ return String(s||"").trim().toUpperCase().replace(/\s+/g,"").replace(/-/g,""); }

function coerceGrade(factorName, raw){
  const allowed = ALLOWED_BY_FACTOR[factorName] || [];
  let g = normalizeGrade(raw);

  // Nếu là yếu tố fine-grained và model trả 'B' -> chuyển về median 'B2' (nếu có)
  if (FINE_GRAINED_FACTORS.has(factorName) && /^[A-Z]$/.test(g)){
    const fam = allowed.filter(x => x.startsWith(g));
    if (fam.length) g = fam[Math.floor(fam.length/2)];
  }

  if (allowed.includes(g)) return g;

  // 'C' chung -> median
  if (/^[A-Z]$/.test(g)){
    const fam = allowed.filter(x => x.startsWith(g));
    if (fam.length) return fam[Math.floor(fam.length/2)];
  }

  // 'C2' không có -> thử C1/C3...
  if (/^[A-Z]\d+$/.test(g)){
    const head = g[0];
    const fam = allowed.filter(x => x.startsWith(head));
    for (const p of ["2","1","3","0"]) {
      const cand = head + p;
      if (fam.includes(cand)) return cand;
    }
  }

  // 'D11' dạng 2 số -> nếu không khớp, thử họ hàng gần nhất theo thứ tự tăng
  if (/^[A-Z]\d{2}$/.test(g)){
    const head = g[0];
    const fam = allowed.filter(x => x.startsWith(head));
    if (fam.length) return fam[0];
  }

  // fallback
  return allowed[0] || g;
}

async function loadPwCPrompt(){
  try { const res = await fetch("./pwc_prompt.txt", { cache: "no-store" }); return res.ok ? await res.text() : ""; }
  catch { return ""; }
}

async function getSystemInstruction(){
  const pwc = await loadPwCPrompt();
  return `Bạn là chuyên gia đánh giá công việc theo phương pháp PwC.
BẮT BUỘC:
- Đánh giá ĐỦ 12 yếu tố: ${FACTORS.join(", ")}.
- Mỗi yếu tố chỉ chọn MỘT mã trong danh mục hợp lệ. Riêng các yếu tố sau BẮT BUỘC dùng mã chi tiết (chữ+số): ${Array.from(FINE_GRAINED_FACTORS).join(", ")}.
- Trả JSON đúng schema, không có text ngoài JSON.
- Với mỗi yếu tố: reason (≤60 từ), evidence (trích JD; nếu không có thì trống, KHÔNG BỊA).

— Phương pháp PwC:
${pwc}

— Danh mục mã hợp lệ:
${JSON.stringify(ALLOWED_BY_FACTOR,null,2)}

— JSON Schema:
${JSON.stringify(PWC_JSON_SCHEMA,null,2)}
`;}

function buildPrompt(jobTitle, jd){
  return `Vị trí: "${jobTitle||"(chưa nhập)"}"\n\nJD (nguyên văn, không rút gọn):\n${jd}`;
}

// ====== Gọi Gemini ======
async function callGemini(apiKey, model, userPrompt){
  const sys = await getSystemInstruction();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = {
    contents: [{ role: "user", parts: [{ text: userPrompt }]}],
    systemInstruction: { role: "system", parts: [{ text: sys }]},
    generationConfig: {
      temperature: 0.2,
      topP: 0.9,
      topK: 40,
      responseMimeType: "application/json"
    }
  };

  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if(!res.ok){ throw new Error(`Gemini lỗi ${res.status}: ${await res.text()}`); }
  const data = await res.json();
  let text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

  // Lấy JSON
  let out;
  try { out = JSON.parse(text); }
  catch {
    const m = (text||"").match(/\{[\s\S]*\}$/);
    if (!m) throw new Error("Không parse được JSON từ model.");
    out = JSON.parse(m[0]);
  }

  // Hậu xử lý & ép đúng mã
  const fixed = (out.factors || []).map(it => {
    const name = (it?.name || "").trim();
    const grade = coerceGrade(name, it?.grade);
    return {
      name,
      grade,
      reason: it?.reason || "",
      evidence: it?.evidence || ""
    };
  });

  return { jobTitle: out.jobTitle || "", factors: fixed, overallSummary: out.overallSummary || "" };
}

// ====== Render ======
function renderResult(res){
  document.querySelector("#resultWrap").classList.remove("hide");
  document.querySelector("#jobOut").textContent = res.jobTitle ? `Chức danh: ${res.jobTitle}` : "";
  const tb = document.querySelector("#tbl tbody");
  tb.innerHTML = "";
  res.factors.forEach((row, idx) => {
    const tr = document.createElement("tr");
    const allowed = (ALLOWED_BY_FACTOR[row.name]||[]).join(", ");
    tr.innerHTML = `
      <td><b>${idx+1}. ${escapeHTML(row.name)}</b><div class="muted small">Mã hợp lệ: ${escapeHTML(allowed)}</div></td>
      <td>${escapeHTML(row.reason||"")}</td>
      <td><i>${escapeHTML(row.evidence||"")}</i></td>
      <td class="w-min"><span class="chip">${escapeHTML(row.grade||"-")}</span></td>
    `;
    tb.appendChild(tr);
  });
  document.querySelector("#downloadJson").onclick = () => {
    const blob = new Blob([JSON.stringify(res, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "pwc_jd_eval.json"; a.click();
    URL.revokeObjectURL(url);
  };
}

// ====== Init ======
(async function init(){
  const res = await fetch("./pwc_prompt.txt", { cache: "no-store" });
  const pwc = res.ok ? await res.text() : "";
  document.querySelector("#pwcPreview").value = pwc || "(Không tải được pwc_prompt.txt)";

  document.querySelector("#runBtn").onclick = async () => {
    const apiKey = document.querySelector("#apiKey").value.trim();
    const model = document.querySelector("#model").value;
    const jobTitle = document.querySelector("#jobTitle").value.trim();
    const jd = document.querySelector("#jd").value.trim();
    if(!apiKey){ alert("Nhập GEMINI_API_KEY"); return; }
    if(!jd){ alert("Vui lòng dán JD đầy đủ"); return; }
    document.querySelector("#runBtn").disabled = true;
    document.querySelector("#runBtn").textContent = "Đang chạy…";
    try{
      const prompt = buildPrompt(jobTitle, jd);
      const out = await callGemini(apiKey, model, prompt);
      renderResult(out);
    }catch(err){
      alert(err.message || String(err));
    }finally{
      document.querySelector("#runBtn").disabled = false;
      document.querySelector("#runBtn").textContent = "Đánh giá JD";
    }
  };
})();