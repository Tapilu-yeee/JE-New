/* =========================================
   JD Evaluation - Frontend (GitHub Pages)
   Notes:
   - Không hiện ô nhập API nữa. Điền link API cố định bên dưới.
   - Tùy bạn thay YOUR_API_LINK_HERE bằng link Gemini lấy ở Google AI Studio.
   ========================================= */
// === CẤU HÌNH API GEMINI Ở ĐÂY ===
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=AIzaSyD9fDIYcMI_juMCXsoz8StSTOSvPUPid1w";

// 12 yếu tố theo phương pháp PwC
const FACTORS = [
  "Trình độ học vấn",
  "Kinh nghiệm",
  "Mức độ phức tạp của công việc",
  "Phạm vi công việc",
  "Mức độ giải quyết vấn đề",
  "Mức độ cần được chỉ dẫn/giám sát",
  "Mức độ liên lạc khi thực hiện công việc",
  "Trách nhiệm giám sát & quản lý",
  "Ảnh hưởng của các quyết định",
  "Quyền hạn",
  "Môi trường làm việc",
  "Yêu cầu thể chất"
];

// System hướng dẫn theo PwC + yêu cầu xuất JSON chuẩn
const SYSTEM_PROMPT = `Bạn là chuyên gia đánh giá giá trị công việc theo phương pháp PwC nội bộ.
Luôn chấm đủ 12 yếu tố sau: ${FACTORS.join(", ")}.
Trả lại kết quả DUY NHẤT dưới dạng JSON theo schema:
{
  "factors": [
    { "name": "<tên yếu tố>", "grade": "<mức A/B/C...>", "reason": "<lý do>", "evidence": "<trích dẫn từ JD>" }
  ]
}
- Không trả lời văn bản ngoài JSON.
- Nếu JD không đủ dữ kiện, vẫn cố gắng chọn mức gần nhất và nêu rõ giả định trong reason.
`;

// ===== UI: Tabs =====
const tabs = document.querySelectorAll(".tab");
const panels = {
  jd: document.getElementById("tab-jd"),
  sgrade: document.getElementById("tab-sgrade")
};
const underline = document.querySelector(".tab-underline");
function activateTab(which) {
  tabs.forEach((t) => t.classList.toggle("active", t.dataset.tab === which));
  panels.jd.classList.toggle("show", which === "jd");
  panels.sgrade.classList.toggle("show", which === "sgrade");
  // underline
  const active = document.querySelector('.tab.active');
  if (active) {
    const rect = active.getBoundingClientRect();
    const parentRect = active.parentElement.getBoundingClientRect();
    underline.style.width = rect.width + "px";
    underline.style.transform = `translateX(${rect.left - parentRect.left}px)`;
  }
}
tabs.forEach((btn) => btn.addEventListener("click", () => activateTab(btn.dataset.tab)));
window.addEventListener("load", () => activateTab("jd"));

// ===== Dropzone =====
const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
dropzone.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.classList.add("drag"); });
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("drag"));
dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("drag");
  if (e.dataTransfer.files?.length) fileInput.files = e.dataTransfer.files;
});

// ===== JD Evaluation =====
const evaluateBtn = document.getElementById("evaluateBtn");
const resultSection = document.getElementById("resultSection");
const resultBody = document.getElementById("resultBody");

evaluateBtn.addEventListener("click", async () => {
  const jobTitle = document.getElementById("jobTitle").value.trim();
  const file = fileInput.files?.[0];
  if (!file) { alert("Vui lòng chọn JD (.docx hoặc .txt)"); return; }

  const jdText = await readFileText(file);
  const prompt = buildPrompt(jdText, jobTitle);
  showLoading(true);

  try {
    const data = await callGemini(prompt);
    const parsed = safeJson(data);
    renderResult(parsed?.factors || []);
  } catch (err) {
    console.error(err);
    alert("Không thể gọi Gemini. Kiểm tra GEMINI_API_URL hoặc quota.");
  } finally {
    showLoading(false);
  }
});

function showLoading(on){
  evaluateBtn.disabled = !!on;
  evaluateBtn.textContent = on ? "Đang đánh giá..." : "Đánh giá JD";
}

function buildPrompt(jdText, jobTitle){
  return [
`[HƯỚNG DẪN HỆ THỐNG]`,
SYSTEM_PROMPT,
`[NHIỆM VỤ] Đánh giá JD theo 12 yếu tố PwC đã chuẩn hóa. Yêu cầu:
- Phải có đủ 12 đối tượng trong mảng "factors" theo đúng thứ tự FACTORS đã nêu.
- "grade" dùng thang A/B/C/D... (có thể có số nếu cần theo hệ thống nội bộ).
- "reason" súc tích, dùng ngôn ngữ Việt, 1-3 câu, bám theo phương pháp PwC.
- "evidence" là trích dẫn ngắn gọn những câu chữ quan trọng từ JD.
`,
`[THÔNG TIN] Vị trí: ${jobTitle || "(chưa cung cấp)"}\n[JD]\n${jdText}`
  ].join("\n\n");
}

async function callGemini(prompt){
  const body = {
    contents: [
      { role:"user", parts:[{ text: prompt }] }
    ],
    generationConfig: {
      temperature: 0.3,
      responseMimeType: "application/json"
    }
  };
  const res = await fetch(GEMINI_API_URL, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify(body)
  });
  if(!res.ok) throw new Error(await res.text());
  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return text;
}

function safeJson(raw){
  try { return JSON.parse(raw); } catch(_){}
  // fallback: try to extract JSON in code block
  const m = raw.match(/\{[\s\S]*\}/);
  if(m) { try { return JSON.parse(m[0]); } catch(_){} }
  return null;
}

function renderResult(items){
  // Bảo đảm 12 yếu tố đủ thứ tự; nếu thiếu, bổ sung placeholder
  const map = new Map(items.map(x => [x.name, x]));
  const rows = FACTORS.map(name => {
    const it = map.get(name) || { name, grade: "—", reason: "—", evidence: "—" };
    return it;
  });

  resultBody.innerHTML = rows.map(r => `
    <tr>
      <td><strong>${escapeHtml(r.name)}</strong></td>
      <td><span class="badge">${escapeHtml(r.grade || "—")}</span></td>
      <td>${escapeHtml(r.reason || "—")}</td>
      <td>${escapeHtml(r.evidence || "—")}</td>
    </tr>
  `).join("");
  resultSection.classList.remove("hidden");
}

function escapeHtml(str){
  return (str||"").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

// ====== S-Grade lookup (simple client-side) ======
async function loadSgrade(){
  try{
    const res = await fetch("sgrade.json");
    const data = await res.json();
    window.__SGRADE__ = data;
    renderSgrade();
  }catch(e){
    console.warn("Không tải được sgrade.json", e);
  }
}
function renderSgrade(){
  const body = document.getElementById("sgradeBody");
  const q = document.getElementById("searchInput").value.trim().toLowerCase();
  const lv = document.getElementById("levelFilter").value;
  const rows = (window.__SGRADE__ || []).filter(x => {
    const okQ = !q || (x.title||"").toLowerCase().includes(q) || (x.vi||"").toLowerCase().includes(q);
    const okL = !lv || x.level === lv;
    return okQ && okL;
  }).map(x => `
    <tr>
      <td>${escapeHtml(x.title)}</td>
      <td>${escapeHtml(x.vi)}</td>
      <td>${escapeHtml(x.type)}</td>
      <td>${escapeHtml(x.level)}</td>
    </tr>
  `).join("");
  body.innerHTML = rows || `<tr><td colspan="4">Không có dữ liệu</td></tr>`;
}
document.getElementById("searchInput").addEventListener("input", renderSgrade);
document.getElementById("levelFilter").addEventListener("change", renderSgrade);
document.getElementById("downloadTemplate").addEventListener("click", () => {
  window.location.href = "s_grade_template.xlsx";
});
document.getElementById("excelImport").addEventListener("change", (e) => {
  alert("Nhập Excel: demo client-side. Hãy tiếp tục dùng file sgrade.json trên GitHub để dữ liệu hiển thị khi reload.");
});
document.getElementById("exportExcel").addEventListener("click", () => {
  alert("Xuất Excel: bản GitHub Pages không có server nên demo tạm. Dữ liệu hiện đang nằm ở sgrade.json.");
});
loadSgrade();

// ===== helpers =====
async function readFileText(file){
  if(file.name.endsWith(".txt")){
    return await file.text();
  }
  if(file.name.endsWith(".docx")){
    // Đọc docx đơn giản bằng TextDecoder cho demo (không giải nén - chỉ fallback)
    // Khuyến nghị chuẩn bị thêm parser nếu cần độ chính xác cao.
    const buf = await file.arrayBuffer();
    // best-effort: cố gắng trích text
    return new TextDecoder().decode(new Uint8Array(buf));
  }
  return await file.text();
}
