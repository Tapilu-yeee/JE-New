/* =========================================================
   S-Grade SCOMMERCE - Frontend script (GitHub Pages)
   - Tabs: JD evaluation (Gemini) + S-grade lookup
   - JD: upload .docx/.txt, keep structure via mammoth.convertToHtml
   - PwC prompt: fetch ./pwc_prompt.txt (kept as-is)
   - Gemini: REST call to Generative Language API (no ESM import)
   - Optional fallback model: gemini-2.0-flash -> gemini-1.5-flash
   - S-grade: load ./sgrade.json, filter/search, import/export Excel (SheetJS)
   ========================================================= */

/* ====== CHỈNH API KEY Ở ĐÂY (1 dòng duy nhất) ====== */
const GOOGLE_API_KEY = "AIzaSyDOgZXvaZgeho4aLaeN1w58TYWrwIrco48";
/* ==================================================== */

const $ = (sel) => document.querySelector(sel);

function setHidden(el, hidden){ if(el) el.hidden = !!hidden; }
function escapeHtml(str){
  return String(str ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

/* ---------------- Tabs ---------------- */
function setupTabs(){
  const tabEval = $("#tab-eval");
  const tabSgrade = $("#tab-sgrade");
  const panelEval = $("#panel-eval");
  const panelSgrade = $("#panel-sgrade");

  function activate(which){
    const isEval = which === "eval";
    tabEval?.classList.toggle("active", isEval);
    tabSgrade?.classList.toggle("active", !isEval);
    tabEval?.setAttribute("aria-selected", String(isEval));
    tabSgrade?.setAttribute("aria-selected", String(!isEval));
    setHidden(panelEval, !isEval);
    setHidden(panelSgrade, isEval);
  }

  tabEval?.addEventListener("click", ()=>activate("eval"));
  tabSgrade?.addEventListener("click", ()=>activate("sgrade"));
  // default
  activate("eval");
}

/* ---------------- Shared UI: result/error ---------------- */
function showError(msg){
  const card = $("#errorCard");
  const txt = $("#errorText");
  if(txt) txt.textContent = msg || "";
  setHidden(card, !msg);
}
function showResult(text){
  const card = $("#resultCard");
  const box = $("#resultBox");
  if(box) box.textContent = text || "";
  setHidden(card, !text);
}

/* ---------------- JD Upload / Dropzone ---------------- */
function setupDropzone(){
  const dz = $("#dropZone");
  const input = $("#fileInput");
  const chosen = $("#fileChosen");

  if(!dz || !input) return;

  dz.addEventListener("click", ()=> input.click());

  dz.addEventListener("dragover", (e)=>{
    e.preventDefault();
    dz.classList.add("dragover");
  });
  dz.addEventListener("dragleave", ()=>{
    dz.classList.remove("dragover");
  });
  dz.addEventListener("drop", (e)=>{
    e.preventDefault();
    dz.classList.remove("dragover");
    const f = e.dataTransfer?.files?.[0];
    if(f){
      input.files = e.dataTransfer.files;
      if(chosen) chosen.textContent = f.name;
    }
  });

  input.addEventListener("change", ()=>{
    const f = input.files?.[0];
    if(chosen) chosen.textContent = f ? f.name : "Chưa chọn file";
  });

  $("#btnClear")?.addEventListener("click", ()=>{
    input.value = "";
    if(chosen) chosen.textContent = "Chưa chọn file";
    showError("");
    showResult("");
    const title = $("#jobTitle");
    if(title) title.value = "";
  });
}

/* ---------------- PwC prompt + JD reading ---------------- */
async function loadPwCPrompt(){
  const res = await fetch("./pwc_prompt.txt", { cache: "no-store" });
  if(!res.ok) throw new Error("Không tải được pwc_prompt.txt (hãy để file cùng thư mục index.html).");
  return await res.text();
}

async function readJDFile(file){
  const name = (file?.name || "").toLowerCase();
  if(name.endsWith(".txt")){
    return (await file.text()) || "";
  }
  if(name.endsWith(".doc") || name.endsWith(".docx")){
    if(!window.mammoth?.convertToHtml){
      throw new Error("Thiếu Mammoth convertToHtml. Kiểm tra index.html đã include mammoth.browser.min.js.");
    }
    const ab = await file.arrayBuffer();
    const out = await window.mammoth.convertToHtml({ arrayBuffer: ab }, { includeDefaultStyleMap: true });
    return out.value || "";
  }
  throw new Error("Chỉ hỗ trợ file .docx hoặc .txt");
}

/* ---------------- Gemini call (REST) ---------------- */
function compactGeminiError(err){
  const raw = String(err?.message || err || "");
  const lower = raw.toLowerCase();

  if(lower.includes("reported as leaked") || lower.includes("leaked")){
    return "API key bị Google đánh dấu leaked → tạo key mới (khuyến nghị project mới) hoặc chuyển sang backend proxy.";
  }
  if(raw.includes("SERVICE_DISABLED") || lower.includes("has not been used in project") || lower.includes("is disabled")){
    return "Generative Language API (Gemini) đang tắt/chưa bật trong project → vào Google Cloud Console và Enable API.";
  }
  if(lower.includes("quota") || lower.includes("resourceexhausted") || lower.includes("429")){
    if(lower.includes("limit: 0") || lower.includes("limit:0")){
      return "Quota = 0 → dùng project/key khác hoặc bật Billing.";
    }
    return "Vượt quota/rate limit → thử lại sau hoặc dùng key/project khác.";
  }
  if(lower.includes("api key not valid") || lower.includes("invalid api key") || lower.includes("permissiondenied") || lower.includes("403")){
    return "Key không hợp lệ/không có quyền → kiểm tra key, restriction, API đã bật.";
  }
  return raw;
}

async function generateContentREST(model, prompt){
  if(!GOOGLE_API_KEY || GOOGLE_API_KEY.includes("ĐIỀN_API_KEY")){
    throw new Error('Chưa cấu hình GOOGLE_API_KEY trong script.js (sửa dòng const GOOGLE_API_KEY = "...").');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(GOOGLE_API_KEY)}`;

  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2 }
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const data = await res.json().catch(()=> ({}));
  if(!res.ok){
    // include message if possible
    const msg = data?.error?.message || JSON.stringify(data);
    throw new Error(msg);
  }

  const text = data?.candidates?.[0]?.content?.parts?.map(p=>p.text).join("") || "";
  return text;
}

async function evaluateJD(jobTitle, jdHtmlOrText){
  const pwcPrompt = await loadPwCPrompt();
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

  // fallback model
  try{
    return await generateContentREST("gemini-2.0-flash", fullPrompt);
  }catch(e1){
    return await generateContentREST("gemini-1.5-flash", fullPrompt);
  }
}

function setupEvaluate(){
  $("#btnEvaluate")?.addEventListener("click", async ()=>{
    const btn = $("#btnEvaluate");
    try{
      showError("");
      showResult("");

      const jobTitle = $("#jobTitle")?.value?.trim();
      const file = $("#fileInput")?.files?.[0];

      if(!jobTitle) throw new Error("Vui lòng nhập tên vị trí công việc.");
      if(!file) throw new Error("Vui lòng tải lên file JD (.docx hoặc .txt).");

      if(btn){ btn.disabled = true; btn.textContent = "Đang đánh giá..."; }

      const jdText = (await readJDFile(file)).trim();
      if(!jdText) throw new Error("JD rỗng hoặc không đọc được nội dung từ file.");

      const result = await evaluateJD(jobTitle, jdText);
      if(!result) throw new Error("Không nhận được kết quả từ Gemini.");

      showResult(result);
    }catch(err){
      console.error(err);
      showError(compactGeminiError(err));
    }finally{
      if(btn){ btn.disabled = false; btn.textContent = "Đánh giá JD"; }
    }
  });
}

/* ---------------- S-Grade ---------------- */
let sgradeData = [];
let sgradeView = []; // filtered

function normalize(v){ return String(v ?? "").trim(); }

function renderSgrade(rows){
  const tbody = $("#sgradeBody");
  if(!tbody) return;
  tbody.innerHTML = "";
  const frag = document.createDocumentFragment();
  for(const r of rows){
    const tr = document.createElement("tr");
    const pos = normalize(r.positionName || r["Tên vị trí"] || r["positionName"]);
    const vn = normalize(r.vietnameseName || r["Tên tiếng Việt"] || r["vietnameseName"]);
    const rank = normalize(r.rank || r["Cấp bậc"] || r["rank"]);
    const block = normalize(r.block || r["Khối"] || "");
    const dept = normalize(r.dept || r["Phòng ban"] || "");
    const type = normalize(r.positionType || r["Loại vị trí"] || r["positionType"]);

    tr.innerHTML = `
      <td>${escapeHtml(pos)}</td>
      <td>${escapeHtml(vn)}</td>
      <td>${escapeHtml(rank)}</td>
      <td>${escapeHtml(block)}</td>
      <td>${escapeHtml(dept)}</td>
      <td class="w-min">${escapeHtml(type)}</td>
    `;
    frag.appendChild(tr);
  }
  tbody.appendChild(frag);
}

function uniqSorted(arr){
  return Array.from(new Set(arr.filter(Boolean))).sort((a,b)=>a.localeCompare(b));
}

function populateFilters(rows){
  const fRank = $("#fRank");
  const fCompany = $("#fCompany");
  const fBlock = $("#fBlock");
  const fDept = $("#fDept");

  function setOptions(select, values){
    if(!select) return;
    const keepFirst = select.querySelector("option[value='']") ? [select.querySelector("option[value='']")] : [];
    select.innerHTML = "";
    const optAll = document.createElement("option");
    optAll.value = "";
    optAll.textContent = "Tất cả";
    select.appendChild(optAll);

    for(const v of values){
      const o = document.createElement("option");
      o.value = v;
      o.textContent = v;
      select.appendChild(o);
    }
  }

  const ranks = uniqSorted(rows.map(r=>normalize(r.rank)));
  const companies = uniqSorted(rows.map(r=>normalize(r.company || r["Công ty"])));
  const blocks = uniqSorted(rows.map(r=>normalize(r.block || r["Khối"])));
  const depts = uniqSorted(rows.map(r=>normalize(r.dept || r["Phòng ban"])));

  setOptions(fRank, ranks);
  setOptions(fCompany, companies);
  setOptions(fBlock, blocks);
  setOptions(fDept, depts);
}

function applySgradeFilter(){
  const q = normalize($("#fSearch")?.value).toLowerCase();
  const rank = normalize($("#fRank")?.value);
  const company = normalize($("#fCompany")?.value);
  const block = normalize($("#fBlock")?.value);
  const dept = normalize($("#fDept")?.value);

  sgradeView = sgradeData.filter(r=>{
    const pos = normalize(r.positionName).toLowerCase();
    const vn = normalize(r.vietnameseName).toLowerCase();
    const okQ = !q || pos.includes(q) || vn.includes(q);
    const okRank = !rank || normalize(r.rank) === rank;
    const okCompany = !company || normalize(r.company || r["Công ty"]) === company;
    const okBlock = !block || normalize(r.block || r["Khối"]) === block;
    const okDept = !dept || normalize(r.dept || r["Phòng ban"]) === dept;
    return okQ && okRank && okCompany && okBlock && okDept;
  });

  renderSgrade(sgradeView);
}

function setupFilterPopover(){
  const backdrop = $("#filterBackdrop");
  const pop = $("#filterPopover");
  const openBtn = $("#btnOpenFilter");
  const closeBtn = $("#btnCloseFilter");

  function open(){
    setHidden(backdrop, false);
    setHidden(pop, false);
  }
  function close(){
    setHidden(backdrop, true);
    setHidden(pop, true);
  }

  openBtn?.addEventListener("click", open);
  closeBtn?.addEventListener("click", close);
  backdrop?.addEventListener("click", close);

  $("#btnApplyFilter")?.addEventListener("click", ()=>{
    applySgradeFilter();
    close();
  });
  $("#btnResetFilter")?.addEventListener("click", ()=>{
    const ids = ["fSearch","fRank","fCompany","fBlock","fDept"];
    for(const id of ids){
      const el = $("#"+id);
      if(!el) continue;
      if(el.tagName === "SELECT") el.value = "";
      else el.value = "";
    }
    applySgradeFilter();
  });
}

async function loadSgradeJSON(){
  const res = await fetch("./sgrade.json", { cache: "no-store" });
  if(!res.ok) throw new Error("Không tải được sgrade.json");
  const data = await res.json();
  // normalize to expected keys
  return (data || []).map(r=>({
    positionName: normalize(r.positionName),
    vietnameseName: normalize(r.vietnameseName),
    rank: normalize(r.rank),
    positionType: normalize(r.positionType),
    company: normalize(r.company || ""),
    block: normalize(r.block || ""),
    dept: normalize(r.dept || "")
  }));
}

function setupTemplateDownload(){
  $("#btnDownloadTemplate")?.addEventListener("click", ()=>{
    // prefer clean template if exists
    window.location.href = "./s_grade_template.xlsx";
  });
}

function setupExcelImportExport(){
  const excelInput = $("#excelInput");
  const btnImport = $("#btnImportExcel");
  const btnExport = $("#btnExportExcel");

  btnImport?.addEventListener("click", ()=> excelInput?.click());

  excelInput?.addEventListener("change", async ()=>{
    const file = excelInput.files?.[0];
    if(!file) return;

    try{
      const ab = await file.arrayBuffer();
      const wb = XLSX.read(ab, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

      // Map various possible headers to our fields
      sgradeData = rows.map(r=>({
        positionName: normalize(r.positionName || r["Tên vị trí"] || r["Position Name"]),
        vietnameseName: normalize(r.vietnameseName || r["Tên tiếng Việt"] || r["Vietnamese Name"]),
        rank: normalize(r.rank || r["Cấp bậc"] || r["Rank"]),
        company: normalize(r.company || r["Công ty"] || r["Company"]),
        block: normalize(r.block || r["Khối"] || r["Block"]),
        dept: normalize(r.dept || r["Phòng ban"] || r["Department"]),
        positionType: normalize(r.positionType || r["Loại vị trí"] || r["Position Type"])
      }));

      populateFilters(sgradeData);
      applySgradeFilter();
    }catch(e){
      alert("Import Excel lỗi: " + (e?.message || e));
    }finally{
      excelInput.value = "";
    }
  });

  btnExport?.addEventListener("click", ()=>{
    const rows = (sgradeView?.length ? sgradeView : sgradeData).map(r=>({
      "Tên vị trí": r.positionName,
      "Tên tiếng Việt": r.vietnameseName,
      "Cấp bậc": r.rank,
      "Khối": r.block,
      "Phòng ban": r.dept,
      "Loại vị trí": r.positionType,
      "Công ty": r.company
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "S-Grade");
    XLSX.writeFile(wb, "s-grade-export.xlsx");
  });
}

async function setupSgrade(){
  try{
    sgradeData = await loadSgradeJSON();
    sgradeView = [...sgradeData];
    populateFilters(sgradeData);
    renderSgrade(sgradeView);
  }catch(e){
    console.warn(e);
    // don't block the rest
  }

  setupFilterPopover();
  setupTemplateDownload();
  setupExcelImportExport();
}

/* ---------------- Init ---------------- */
document.addEventListener("DOMContentLoaded", ()=>{
  setupTabs();
  setupDropzone();
  setupEvaluate();
  setupSgrade();
});
