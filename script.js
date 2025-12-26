import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

/* ====== CHỈNH API KEY Ở ĐÂY ====== */
const GOOGLE_API_KEY = "AIzaSyBIO0tEWq8IdMzO1XrKBpcxRVK6337RQ5c";
/* ================================= */

const $ = (q, root=document) => root.querySelector(q);
const $$ = (q, root=document) => Array.from(root.querySelectorAll(q));

function setTab(which){
  const showEval = which === "eval";
  $$("#tab-eval").forEach(el=>{ el.classList.toggle("active", showEval); el.setAttribute("aria-selected", showEval?"true":"false"); });
  $$("#tab-sgrade").forEach(el=>{ el.classList.toggle("active", !showEval); el.setAttribute("aria-selected", showEval?"false":"true"); });

  const pEval = $("#panel-eval");
  const pS = $("#panel-sgrade");
  if(pEval){ pEval.hidden = !showEval; pEval.classList.toggle("show", showEval); }
  if(pS){ pS.hidden = showEval; pS.classList.toggle("show", !showEval); }
}

document.addEventListener("click", (e)=>{
  const t = e.target.closest("#tab-eval, #tab-sgrade");
  if(!t) return;
  if(t.id === "tab-eval") setTab("eval");
  if(t.id === "tab-sgrade") setTab("sgrade");
});

(function setupJD(){
  const dz = $("#dropZone");
  const fi = $("#fileInput");
  const fc = $("#fileChosen");
  if(!dz || !fi) return;

  const open = ()=>fi.click();
  dz.addEventListener("click", open);
  dz.addEventListener("keydown", (e)=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); open(); }});

  dz.addEventListener("dragover", (e)=>e.preventDefault());
  dz.addEventListener("drop", (e)=>{
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if(f){ fi.files = e.dataTransfer.files; if(fc) fc.textContent = "Đã chọn: " + f.name; }
  });
  fi.addEventListener("change", ()=>{ const f=fi.files?.[0]; if(fc) fc.textContent = f?("Đã chọn: "+f.name):"Chưa chọn file"; });

  $("#btnClear")?.addEventListener("click", ()=>{
    $("#jobTitle").value = "";
    fi.value = "";
    if(fc) fc.textContent = "Chưa chọn file";
  });


  const showError = (msg)=>{
    const card = $("#errorCard");
    const txt = $("#errorText");
    if(txt) txt.textContent = msg || "";
    if(card) card.hidden = !msg;
  };
  const showResult = (text)=>{
    const card = $("#resultCard");
    const box = $("#resultBox");
    if(box) box.textContent = text || "";
    if(card) card.hidden = !text;
  };

  async function loadPwCPrompt(){
    const res = await fetch("./pwc_prompt.txt", { cache: "no-store" });
    if(!res.ok) throw new Error("Không tải được pwc_prompt.txt. Đảm bảo file nằm cùng thư mục và GitHub Pages đã publish.");
    return await res.text();
  }

  async function readJDFile(file){
    const name = (file?.name || "").toLowerCase();
    if(name.endsWith(".txt")){
      return await file.text();
    }
    const ab = await file.arrayBuffer();
    const out = await window.mammoth.extractRawText({ arrayBuffer: ab });
    return out.value || "";
  }

  function friendlyGeminiError(err){
    const msg = String(err?.message || err || "");
    if(/reported as leaked/i.test(msg) || /leaked/i.test(msg)){
      return "API key đã bị Google đánh dấu bị lộ (leaked) và bị chặn. Hãy tạo API key mới trong project mới hoặc rotate key.";
    }
    if(/SERVICE_DISABLED/i.test(msg) || /has not been used in project/i.test(msg)){
      return "Project chưa bật Generative Language API (Gemini). Vào Google Cloud Console > APIs & Services và bật Generative Language API.";
    }
    if(/quota/i.test(msg) || /429/.test(msg) || /Quota exceeded/i.test(msg)){
      return "Bạn đã vượt quota hoặc quota của project = 0. Hãy dùng project/key khác hoặc bật Billing để có quota.";
    }
    return msg;
  }

  async function evaluateWithGemini({jobTitle, jdText}){
    if(!GOOGLE_API_KEY || GOOGLE_API_KEY.includes("ĐIỀN_API_KEY")){
      throw new Error("Chưa cấu hình GOOGLE_API_KEY trong script.js (dòng const GOOGLE_API_KEY = ...).");
    }

    const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const pwcPrompt = await loadPwCPrompt();

    const fullPrompt = `
${pwcPrompt}

---
Tên vị trí: ${jobTitle}

JD mới:
${jdText}

Yêu cầu bắt buộc:
- Đánh giá theo đúng 12 yếu tố PwC.
- Mỗi yếu tố có: Mức (A–J), Lý do, Dẫn chứng từ JD.
- Trả kết quả ở dạng bảng (12 dòng tương ứng 12 yếu tố).
- Nếu JD thiếu thông tin ở yếu tố nào, ghi "Thiếu dữ liệu" và nêu giả định tối thiểu.
`.trim();

    const resp = await model.generateContent(fullPrompt);
    return resp?.response?.text?.() || "";
  }

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

      const result = await evaluateWithGemini({ jobTitle, jdText });
      if(!result) throw new Error("Không nhận được kết quả từ Gemini.");

      showResult(result);
    }catch(err){
      console.error(err);
      showError(friendlyGeminiError(err));
    }finally{
      if(btn){ btn.disabled = false; btn.textContent = "Đánh giá JD"; }
    }
  });
})();

let S_DATA = [];
let FILTERS = { search:"", rank:"", company:"", block:"", dept:"" };

const STORAGE_KEY = "sgrade_data_v1";

function saveToStorage(){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ts: Date.now(), data: S_DATA}));
  }catch(e){
    console.warn("Không lưu được dữ liệu vào trình duyệt (localStorage).", e);
  }
}

function loadFromStorage(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return null;
    const parsed = JSON.parse(raw);
    if(Array.isArray(parsed?.data)) return parsed.data;
  }catch(e){
    console.warn("Không đọc được dữ liệu từ localStorage.", e);
  }
  return null;
}

const normalize = (s)=>String(s??"").trim();
const uniq = (arr)=>Array.from(new Set(arr.map(v=>normalize(v)).filter(Boolean))).sort((a,b)=>a.localeCompare(b,"vi",{numeric:true}));

function readObj(o, keys){
  for(const k of keys){
    const v = o?.[k];
    if(v !== undefined && String(v).trim() !== "") return v;
  }
  return "";
}

function toRow(o){
  return {
    positionName: normalize(readObj(o, ["positionName","Tên vị trí","Ten vi tri","Position name","title","Tên"])),
    vietnameseName: normalize(readObj(o, ["vietnameseName","Tên tiếng Việt","Ten tieng Viet","Vietnamese name"])),
    rank: normalize(readObj(o, ["rank","Cấp bậc","Cap bac","Grade"])),
    block: normalize(readObj(o, ["block","Khối","Khoi","Division","BU"])),
    department: normalize(readObj(o, ["department","Phòng ban","Phong ban","Dept","Department"])),
    positionType: normalize(readObj(o, ["positionType","Loại vị trí","Loai vi tri","Position type","type"])),
    company: normalize(readObj(o, ["company","Công ty","Cong ty","Company"]))
  };
}

function applyFilters(data){
  const s = FILTERS.search.toLowerCase();
  return data.filter(r=>{
    if(s){
      const hay = (r.positionName + " " + r.vietnameseName).toLowerCase();
      if(!hay.includes(s)) return false;
    }
    if(FILTERS.rank && r.rank !== FILTERS.rank) return false;
    if(FILTERS.company && r.company !== FILTERS.company) return false;
    if(FILTERS.block && r.block !== FILTERS.block) return false;
    if(FILTERS.dept && r.department !== FILTERS.dept) return false;
    return true;
  });
}

function escapeHtml(s){
  return String(s??"").replace(/[&<>"']/g, (m)=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));
}

function renderTable(){
  const body = $("#sgradeBody");
  if(!body) return;
  const rows = applyFilters(S_DATA);
  body.innerHTML = rows.map(r=>`
    <tr>
      <td>${escapeHtml(r.positionName || "-")}</td>
      <td>${escapeHtml(r.vietnameseName || "-")}</td>
      <td class="w-min">${escapeHtml(r.rank || "-")}</td>
      <td>${escapeHtml(r.block || "-")}</td>
      <td>${escapeHtml(r.department || "-")}</td>
      <td class="w-min">${escapeHtml(r.positionType || "-")}</td>
    </tr>
  `).join("");

  if(rows.length === 0){
    body.innerHTML = `<tr><td colspan="6" class="muted" style="padding:16px;">Không có dữ liệu phù hợp bộ lọc.</td></tr>`;
  }
}

function fillFilterOptions(opts = {}){
  const selCompany = (opts.company ?? $("#fCompany")?.value ?? FILTERS.company ?? "").trim();
  const selBlock = (opts.block ?? $("#fBlock")?.value ?? FILTERS.block ?? "").trim();

  // Companies fixed + companies from data (Excel) if any
  const fixedCompanies = ["Ahamove","GHN Express","GHN Logistics","Giao Hàng Nặng","Gido","SCOMMERCE"];
  const companies = uniq([...fixedCompanies, ...S_DATA.map(x=>x.company).filter(Boolean)]);

  const ranks = uniq(S_DATA.map(x=>x.rank).filter(Boolean));

  const scopedCompany = selCompany ? S_DATA.filter(x => (x.company||"").trim() === selCompany) : S_DATA;
  const blocks = uniq(scopedCompany.map(x=>x.block).filter(Boolean));

  const scopedBlock = selBlock ? scopedCompany.filter(x => (x.block||"").trim() === selBlock) : scopedCompany;
  const depts = uniq(scopedBlock.map(x=>x.department).filter(Boolean));

  const fRank = $("#fRank");
  const fCompany = $("#fCompany");
  const fBlock = $("#fBlock");
  const fDept = $("#fDept");

  if(fRank){
    fRank.innerHTML = `<option value="">Tất cả</option>` + ranks.map(v=>`<option>${escapeHtml(v)}</option>`).join("");
    if(!opts.keepValues) fRank.value = FILTERS.rank || "";
  }

  if(fCompany){
    fCompany.innerHTML = `<option value="">Tất cả</option>` + companies.map(v=>`<option>${escapeHtml(v)}</option>`).join("");
    fCompany.value = selCompany || "";
  }

  if(fBlock){
    fBlock.innerHTML = `<option value="">Tất cả</option>` + blocks.map(v=>`<option>${escapeHtml(v)}</option>`).join("");
    const want = opts.keepValues ? selBlock : (FILTERS.block || "");
    fBlock.value = blocks.includes(want) ? want : "";
  }

  if(fDept){
    fDept.innerHTML = `<option value="">Tất cả</option>` + depts.map(v=>`<option>${escapeHtml(v)}</option>`).join("");
    const wantDept = opts.keepValues ? (fDept.value||"") : (FILTERS.dept || "");
    fDept.value = depts.includes(wantDept) ? wantDept : "";
  }
}

function openFilter(){
  $("#filterBackdrop")?.removeAttribute("hidden");
  $("#filterPopover")?.removeAttribute("hidden");

  $("#fSearch").value = FILTERS.search || "";
  $("#fRank").value = FILTERS.rank || "";
  $("#fCompany").value = FILTERS.company || "";
  $("#fBlock").value = FILTERS.block || "";
  $("#fDept").value = FILTERS.dept || "";

  fillFilterOptions({company: FILTERS.company || "", block: FILTERS.block || "", keepValues:true});
}
function closeFilter(){
  $("#filterBackdrop")?.setAttribute("hidden","");
  $("#filterPopover")?.setAttribute("hidden","");
}

function setupFiltersUI(){
  $("#btnOpenFilter")?.addEventListener("click", openFilter);
  $("#btnCloseFilter")?.addEventListener("click", closeFilter);
  $("#filterBackdrop")?.addEventListener("click", closeFilter);

  

  // Cascade: chọn Công ty -> lọc lại Khối/Phòng ban theo Công ty
  $("#fCompany")?.addEventListener("change", ()=>{
    const company = $("#fCompany").value.trim();
    $("#fBlock").value = "";
    $("#fDept").value = "";
    fillFilterOptions({company, block:"", keepValues:true});
  });

  // Cascade: chọn Khối -> lọc lại Phòng ban theo Công ty + Khối
  $("#fBlock")?.addEventListener("change", ()=>{
    const company = $("#fCompany").value.trim();
    const block = $("#fBlock").value.trim();
    $("#fDept").value = "";
    fillFilterOptions({company, block, keepValues:true});
  });
$("#btnResetFilter")?.addEventListener("click", ()=>{
    FILTERS = { search:"", rank:"", company:"", block:"", dept:"" };
    $("#fSearch").value = "";
    $("#fCompany").value = "";
    fillFilterOptions();
  });

  $("#btnApplyFilter")?.addEventListener("click", ()=>{
    FILTERS.search = $("#fSearch").value.trim();
    FILTERS.rank = $("#fRank").value.trim();
    FILTERS.company = $("#fCompany").value.trim();
    FILTERS.block = $("#fBlock").value.trim();
    FILTERS.dept = $("#fDept").value.trim();
    closeFilter();
    renderTable();
  });
}

function ensureXLSX(){
  if(!window.XLSX){
    alert("Thiếu thư viện XLSX (SheetJS). Kiểm tra <script src='...xlsx.full.min.js'> trong index.html");
    return false;
  }
  return true;
}

function setupExcelActions(){
  const inp = $("#excelInput");

  $("#btnImportExcel")?.addEventListener("click", ()=>{
    if(!ensureXLSX()) return;
    inp?.click();
  });

  inp?.addEventListener("change", (e)=>{
    const f = e.target.files?.[0];
    if(!f) return;

    const fr = new FileReader();
    fr.onload = (evt)=>{
      try{
        const data = new Uint8Array(evt.target.result);
        const wb = XLSX.read(data, {type:"array"});
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, {defval:""});

        const mapped = rows.map(r=>{
          const low = {};
          Object.keys(r||{}).forEach(k=> low[String(k).trim().toLowerCase()] = r[k]);
          const pick = (keys)=>{
            for(const k of keys){
              const v = low[String(k).trim().toLowerCase()];
              if(v !== undefined && String(v).trim() !== "") return v;
            }
            return "";
          };
          return toRow({
            positionName: pick(["positionname","tên vị trí","ten vi tri","position name"]),
            vietnameseName: pick(["vietnamesename","tên tiếng việt","ten tieng viet","vietnamese name"]),
            rank: pick(["rank","cấp bậc","cap bac","grade"]),
            block: pick(["block","khối","khoi"]),
            department: pick(["department","phòng ban","phong ban","dept"]),
            positionType: pick(["positiontype","loại vị trí","loai vi tri","position type"]),
            company: pick(["company","công ty","cong ty"])
          });
        }).filter(x=>x.positionName || x.vietnameseName);

        S_DATA = mapped;
        saveToStorage();
        fillFilterOptions({company:"", block:"", keepValues:true});
        renderTable();
        alert(`Đã nhập ${mapped.length} dòng từ Excel.`);
      }catch(err){
        console.error(err);
        alert("Không đọc được file Excel. Hãy dùng đúng template .xlsx.");
      }finally{
        e.target.value = "";
      }
    };
    fr.readAsArrayBuffer(f);
  });

  $("#btnExportExcel")?.addEventListener("click", ()=>{
    if(!ensureXLSX()) return;
    const rows = applyFilters(S_DATA).map(r=>({
      positionName:r.positionName,
      vietnameseName:r.vietnameseName,
      rank:r.rank,
      block:r.block,
      department:r.department,
      positionType:r.positionType,
      company:r.company
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "S-Grade");
    XLSX.writeFile(wb, "sgrade_export.xlsx");
  });

  $("#btnDownloadTemplate")?.addEventListener("click", ()=>{
    const a = document.createElement("a");
    a.href = "./s_grade_template.xlsx";
    a.download = "s_grade_template.xlsx";
    document.body.appendChild(a);
    a.click();
    a.remove();
  });
}

async function loadSgrade(){
  // Ưu tiên dữ liệu đã import (Excel) để refresh không bị mất Khối/Phòng ban
  const cached = loadFromStorage();
  if(cached && Array.isArray(cached) && cached.length){
    S_DATA = cached.map(toRow);
    fillFilterOptions({company: FILTERS.company || "", block: FILTERS.block || "", keepValues:true});
    renderTable();
    return;
  }

  try{
    const res = await fetch("./sgrade.json", {cache:"no-store"});
    const raw = await res.json();
    const arr = Array.isArray(raw) ? raw : (raw.data || raw.items || []);
    S_DATA = arr.map(toRow);
  }catch(err){
    console.warn("Không load được sgrade.json, dùng dữ liệu rỗng.", err);
    S_DATA = [];
  }
  fillFilterOptions();
  renderTable();
}

setupFiltersUI();
setupExcelActions();
loadSgrade();
setTab("eval");
