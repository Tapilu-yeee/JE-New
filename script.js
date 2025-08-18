
/* =============================
   S-Grade SCOMMERCE (GitHub Pages)
   Cấu hình API Gemini: CHỈ SỬA 1 DÒNG DƯỚI ĐÂY
   ============================= */
// === CẤU HÌNH API GEMINI Ở ĐÂY (thay YOUR_API_LINK_HERE bằng link đầy đủ ở Google AI Studio) ===
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=AIzaSyD9fDIYcMI_juMCXsoz8StSTOSvPUPid1w";

// ----------------- UI helpers -----------------
const $ = (s) => document.querySelector(s);
const on = (el, ev, fn) => el.addEventListener(ev, fn);

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

const SYSTEM_PROMPT = `Bạn là chuyên gia đánh giá giá trị công việc theo khung PwC đã được chuẩn hoá nội bộ.
YÊU CẦU BẮT BUỘC:
1) Đọc JD (văn bản) và đánh giá ĐỦ 12 yếu tố sau: ${FACTORS.join(", ")}.
2) Mỗi yếu tố chỉ chọn MỘT mức (ví dụ: A, B, C, D, E..., hoặc A1, B1... theo mô tả trong tài liệu).
3) Mỗi yếu tố phải có: "reason" (lý do) và "evidence" (trích dẫn nguyên văn ngắn từ JD).
4) CHỈ TRẢ VỀ JSON DUY NHẤT theo schema sau, không giải thích thêm:
{
  "jobTitle": "<tên vị trí trích xuất được từ JD, nếu có>",
  "factors": [
    { "name": "<tên yếu tố>", "grade": "<mức>", "reason": "<lý do>", "evidence": "<dẫn chứng ngắn>" }
  ],
  "overallSummary": "<nhận xét tổng quan ngắn gọn>"
}`;

// Tabs
const tabEval = $("#tab-eval");
const tabSgrade = $("#tab-sgrade");
const panelEval = $("#panel-eval");
const panelSgrade = $("#panel-sgrade");
function setTab(which){
  if(which==="eval"){
    tabEval.classList.add("active");
    tabSgrade.classList.remove("active");
    panelEval.classList.add("show");
    panelSgrade.classList.remove("show");
    panelSgrade.hidden = true;
    panelEval.hidden = false;
  } else {
    tabSgrade.classList.add("active");
    tabEval.classList.remove("active");
    panelSgrade.classList.add("show");
    panelEval.classList.remove("show");
    panelEval.hidden = true;
    panelSgrade.hidden = false;
  }
}
on(tabEval,"click",()=>setTab("eval"));
on(tabSgrade,"click",()=>setTab("sgrade"));

// Upload zone
const dropZone = $("#dropZone");
const fileInput = $("#fileInput");
dropZone.addEventListener("click",()=>fileInput.click());
dropZone.addEventListener("dragover",(e)=>{ e.preventDefault(); dropZone.style.borderColor="#10b981"; });
dropZone.addEventListener("dragleave",()=>{ dropZone.style.borderColor="var(--border)"; });
dropZone.addEventListener("drop",(e)=>{
  e.preventDefault(); dropZone.style.borderColor="var(--border)";
  if(e.dataTransfer.files?.length){ window.__LAST_FILE = e.dataTransfer.files[0]; try{ const evt=new Event("change"); fileInput.dispatchEvent(evt);}catch(_){} }
});

// Read file (.txt, .docx)
async function readFileContent(file){
  if(!file) return "";
  if(file.type === "text/plain"){
    return await file.text();
  }
  // docx
  if(file.name.toLowerCase().endsWith(".docx")){
    const arrayBuffer = await file.arrayBuffer();
    const res = await window.mammoth.extractRawText({arrayBuffer});
    return res.value || "";
  }
  throw new Error("Định dạng không hỗ trợ. Vui lòng dùng .docx hoặc .txt");
}

// Build prompt
function buildPrompt(jobTitle, jdText){
  return `Vị trí cần đánh giá: "${jobTitle || "(chưa nhập)"}"\n\nJD:\n${jdText}`;
}

// Call Gemini
async function callGemini(prompt){
  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }]}],
    systemInstruction: { role: "system", parts: [{ text: SYSTEM_PROMPT }]},
    generationConfig: { temperature: 0.2, responseMimeType: "application/json" }
  };
  const res = await fetch(GEMINI_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if(!res.ok){
    const t = await res.text();
    throw new Error(`Gemini API lỗi ${res.status}: ${t.slice(0,200)}`);
  }
  const data = await res.json();
  // Lấy text trả về (tuỳ API)
  let text =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ||
    data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data ||
    data?.candidates?.[0]?.content?.parts?.[0]?.executableCode ||
    data?.candidates?.[0]?.content?.parts?.[0]?.functionCall ||
    data?.candidates?.[0]?.content?.parts?.[0]?.stringValue ||
    "";
  if (typeof text !== "string") text = JSON.stringify(text);

  // Tìm JSON trong chuỗi (phòng khi model thêm backticks)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if(!jsonMatch) throw new Error("Phản hồi không chứa JSON hợp lệ.");
  return JSON.parse(jsonMatch[0]);
}

// Render
const resultCard = $("#resultCard");
const resultBody = document.querySelector('#resultBody') || document.querySelector('#resultTable tbody');
const resultHeader = $("#resultHeader");
const overall = $("#overall");
function renderResult(jobTitle, result){
  const title = result.jobTitle || jobTitle || "Không rõ chức danh";
  resultHeader.textContent = `Kết quả đánh giá: ${title}`;

  // Map theo 12 yếu tố (đảm bảo đủ dòng)
  const map = {};
  (result.factors||[]).forEach(f=>{ map[(f.name||"").trim()] = f; });

  resultBody.innerHTML = "";
  FACTORS.forEach((name, idx)=>{
    const row = map[name] || { name, grade:"-", reason:"(Không có dữ liệu)", evidence:"" };
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><b>${idx+1}. ${name}</b></td>
      <td>${escapeHTML(row.reason||"")}</td>
      <td><i>${escapeHTML(row.evidence||"")}</i></td>
      <td class="w-min"><span class="chip">${escapeHTML(row.grade||"-")}</span></td>
    `;
    resultBody.appendChild(tr);
  });
  overall.textContent = result.overallSummary ? ("Nhận xét tổng quan: " + result.overallSummary) : "";
  resultCard.hidden = false;
}
function escapeHTML(s){
  return (s||"").replace(/[&<>"']/g,m=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]));
}

// Actions
const btnEvaluate = $("#btnEvaluate");
const btnClear = $("#btnClear");
const jobTitleInput = $("#jobTitle");
const errorCard = $("#errorCard");
const errorText = $("#errorText");

on(btnClear,"click",()=>{
  jobTitleInput.value = "";
  fileInput.value = "";
  resultCard.hidden = true;
  errorCard.hidden = true;
});

on(btnEvaluate,"click", async ()=>{
  try{
    errorCard.hidden = true;
    resultCard.hidden = true;
    btnEvaluate.disabled = true; btnEvaluate.textContent = "Đang đánh giá...";
    const file = fileInput.files?.[0] || window.__LAST_FILE;
    if(!file) throw new Error("Vui lòng chọn tệp JD (.docx hoặc .txt)");
    const jdText = await readFileContent(file);
    const prompt = buildPrompt(jobTitleInput.value.trim(), jdText);
    const result = await callGemini(prompt);
    renderResult(jobTitleInput.value.trim(), result);
  }catch(err){
    errorText.textContent = err.message || String(err);
    errorCard.hidden = false;
  }finally{
    btnEvaluate.disabled = false; btnEvaluate.textContent = "Đánh giá JD";
  }
});

// -------------------- S-GRADE --------------------
async function loadSgrade(){
  const urls = [
    "./sgrade.json",
    "sgrade.json",
    new URL("sgrade.json", location.href).toString()
  ];
  let data = [];
  for (const u of urls){
    try{
      const res = await fetch(u, {cache:"no-store"});
      if(res.ok){
        const j = await res.json();
        if (Array.isArray(j)) { data = j; break; }
      }
    }catch(err){
      console.warn("[S-GRADE] try", u, "failed:", err);
    }
  }
  if (!Array.isArray(data)) data = [];
  window.__S_GRADE = data;
  renderSgrade();
  fillRanks();
  const hintEl = document.getElementById("sgradeBody");
  if (hintEl && (!data || data.length === 0)){
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 4;
    td.className = "muted";
    td.textContent = "Không tải được dữ liệu S-Grade. Hãy chắc chắn có file sgrade.json ở cùng thư mục với index.html (và commit lên GitHub Pages).";
    tr.appendChild(td);
    hintEl.appendChild(tr);
  }
}
function fillRanks(){
  const data = window.__S_GRADE||[];
  const set = new Set(data.map(x=>x.rank));
  const select = $("#rankFilter");
  select.innerHTML = `<option value="all">Tất cả</option>`+ Array.from(set).sort().map(r=>`<option value="${r}">${r}</option>`).join("");
}
function renderSgrade(){
  const body = $("#sgradeBody");
  const q = ($("#searchTerm").value||"").toLowerCase();
  const rank = $("#rankFilter").value||"all";
  const data = (window.__S_GRADE||[]).filter(x=>{
    const okRank = rank==="all" || (x.rank===rank);
    const okQ = !q || (x.positionName||"").toLowerCase().includes(q) || (x.vietnameseName||"").toLowerCase().includes(q);
    return okRank && okQ;
  });
  body.innerHTML = data.map(x=>`
    <tr>
      <td>${escapeHTML(x.positionName||"")}</td>
      <td>${escapeHTML(x.vietnameseName||"")}</td>
      <td>${escapeHTML(x.positionType||"")}</td>
      <td>${escapeHTML(x.rank||"")}</td>
    </tr>
  `).join("");
}
on($("#searchTerm"),"input",renderSgrade);
on($("#rankFilter"),"change",renderSgrade);

// Template / Import / Export (client-only)
on($("#btnTemplate"),"click",()=>{
  const header = ["positionName","vietnameseName","positionType","rank"];
  const example = ["Sample Position","Vị Trí Mẫu","Indirect","S7"];
  const ws=XLSX.utils.aoa_to_sheet([header, example]);
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Template");
  XLSX.writeFile(wb, "s_grade_template.xlsx");
});
on($("#btnImport"),"click",()=>$("#excelInput").click());
on($("#excelInput"),"change",e=>{
  const f = e.target.files?.[0]; if(!f) return;
  const fr = new FileReader();
  fr.onload = (evt)=>{
    const data = new Uint8Array(evt.target.result);
    const wb = XLSX.read(data, {type:'array'});
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws);
    const cleaned = rows.map(r=>({
      positionName: String(r.positionName||"").trim(),
      vietnameseName: String(r.vietnameseName||"").trim(),
      positionType: String(r.positionType||"").trim(),
      rank: String(r.rank||"").trim()
    })).filter(r=>r.positionName && r.rank);
    window.__S_GRADE = (window.__S_GRADE||[]).concat(cleaned);
    fillRanks(); renderSgrade();
  };
  fr.readAsArrayBuffer(f);
});
on($("#btnExport"),"click",()=>{
  const data = window.__S_GRADE||[];
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "SGrade");
  XLSX.writeFile(wb, "sgrade_export.xlsx");
});

// Init
setTab("eval");
loadSgrade();

// === Upload UX consolidated (filename, click, dragdrop, enable button) ===
(function(){
  function ready(fn){
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }
  ready(function(){
    const dropZone = document.getElementById('dropZone') || document.querySelector('.dropzone');
    const fileInput = document.getElementById('fileInput') || (dropZone && dropZone.querySelector('input[type="file"]'));
    if(!dropZone || !fileInput) return;

    // ensure label exists
    let fileNameEl = document.getElementById('dzFilename');
    if (!fileNameEl){
      fileNameEl = document.createElement('span');
      fileNameEl.id = 'dzFilename';
      fileNameEl.className = 'dz-filename';
      fileNameEl.setAttribute('aria-live','polite');
      dropZone.appendChild(fileNameEl);
    }

    // cache default children (except input & filename)
    const defaultChildren = Array.from(dropZone.children).filter(el => el !== fileNameEl && el !== fileInput);

    const evalBtn = document.getElementById('btnEvaluate') || Array.from(document.querySelectorAll('button')).find(b => /đánh\s*g(i|í)a\s*jd/i.test((b.textContent||'').toLowerCase()));
    const clearBtn = document.getElementById('btnClear') || Array.from(document.querySelectorAll('button')).find(b => /xóa\s*nội\s*dung/i.test((b.textContent||'').toLowerCase()));

    function setEnabled(on){ if (evalBtn) evalBtn.disabled = !on; }
    function showDefault(){
      fileNameEl.textContent = '';
      defaultChildren.forEach(el => { el.style.display = ''; });
      dropZone.classList.remove('has-file');
      setEnabled(false);
    }
    function showFilename(name){
      fileNameEl.textContent = 'Đã chọn: ' + name;
      defaultChildren.forEach(el => { el.style.display = 'none'; });
      dropZone.classList.add('has-file');
      setEnabled(true);
    }
    function refreshFromFiles(files){
      if (files && files.length){
        showFilename(files[0].name);
      } else {
        showDefault();
      }
    }

    // click anywhere in dropzone to open file picker
    dropZone.addEventListener('click', function(e){
      if (e.target && e.target.tagName === 'INPUT') return;
      fileInput.click();
    });

    // keyboard accessibility
    dropZone.setAttribute('role','button');
    if (!dropZone.getAttribute('tabindex')) dropZone.setAttribute('tabindex','0');
    dropZone.addEventListener('keydown', function(e){
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInput.click();
      }
    });

    // drag & drop feedback + file capture
    dropZone.addEventListener('dragover', function(e){ e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', function(){ dropZone.classList.remove('dragover'); });
    dropZone.addEventListener('drop', function(e){
      e.preventDefault();
      dropZone.classList.remove('dragover');
      const files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length) { window.__LAST_FILE = files[0]; }
      refreshFromFiles(files && files.length ? files : fileInput.files);
    });

    // input change
    fileInput.addEventListener('change', function(){
      if (fileInput.files && fileInput.files[0]) { window.__LAST_FILE = fileInput.files[0]; }
      refreshFromFiles(fileInput.files);
    });

    // clear
    if (clearBtn){
      clearBtn.addEventListener('click', function(){
        try{ fileInput.value=''; }catch(e){}
        showDefault();
      });
    }

    // init
    showDefault();
  });
})();
