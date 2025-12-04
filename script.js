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

  $("#btnEvaluate")?.addEventListener("click", ()=>{
    alert("Demo UI: phần đánh giá JD đang ở chế độ giao diện.");
  });
})();

let S_DATA = [];
let FILTERS = { search:"", rank:"", company:"", block:"", dept:"" };
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

function fillFilterOptions(){
  const ranks = uniq(S_DATA.map(x=>x.rank));
  const blocks = uniq(S_DATA.map(x=>x.block));
  const depts = uniq(S_DATA.map(x=>x.department));

  const fRank = $("#fRank");
  const fBlock = $("#fBlock");
  const fDept = $("#fDept");

  if(fRank){
    fRank.innerHTML = `<option value="">Tất cả</option>` + ranks.map(v=>`<option>${escapeHtml(v)}</option>`).join("");
    fRank.value = FILTERS.rank || "";
  }
  if(fBlock){
    fBlock.innerHTML = `<option value="">Tất cả</option>` + blocks.map(v=>`<option>${escapeHtml(v)}</option>`).join("");
    fBlock.value = FILTERS.block || "";
  }
  if(fDept){
    fDept.innerHTML = `<option value="">Tất cả</option>` + depts.map(v=>`<option>${escapeHtml(v)}</option>`).join("");
    fDept.value = FILTERS.dept || "";
  }
}

function openFilter(){
  $("#filterBackdrop")?.removeAttribute("hidden");
  $("#filterPopover")?.removeAttribute("hidden");
  $("#fSearch").value = FILTERS.search || "";
  $("#fCompany").value = FILTERS.company || "";
  fillFilterOptions();
}
function closeFilter(){
  $("#filterBackdrop")?.setAttribute("hidden","");
  $("#filterPopover")?.setAttribute("hidden","");
}

function setupFiltersUI(){
  $("#btnOpenFilter")?.addEventListener("click", openFilter);
  $("#btnCloseFilter")?.addEventListener("click", closeFilter);
  $("#filterBackdrop")?.addEventListener("click", closeFilter);

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
        fillFilterOptions();
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
