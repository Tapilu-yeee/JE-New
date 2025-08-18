// === Upload filename fix (append-only) ===
(function(){
  document.addEventListener('DOMContentLoaded', function(){
    const fileInput = document.querySelector('#fileInput') || document.querySelector('input[type="file"]');
    const dropZone = document.querySelector('#dropZone') || fileInput?.closest('.dropzone');
    if(!fileInput || !dropZone) return;

    // Ensure "Đã chọn: <tên>" label exists
    let fileNameEl = document.querySelector('#dzFilename');
    if (!fileNameEl){
      fileNameEl = document.createElement('span');
      fileNameEl.id = 'dzFilename';
      fileNameEl.className = 'dz-filename';
      fileNameEl.setAttribute('aria-live','polite');
      dropZone.appendChild(fileNameEl);
    }

    // Cache default children (except input & filename)
    const defaultChildren = Array.from(dropZone.children).filter(el => el !== fileNameEl && el !== fileInput);

    const evalBtn = document.querySelector('#btnEvaluate') || Array.from(document.querySelectorAll('button')).find(b => /đánh\s*g(i|í)a\s*jd/i.test((b.textContent||'').toLowerCase()));
    const clearBtn = document.querySelector('#btnClear') || Array.from(document.querySelectorAll('button')).find(b => /xóa\s*nội\s*dung/i.test((b.textContent||'').toLowerCase()));

    function setEnabled(on){
      if (evalBtn) evalBtn.disabled = !on;
    }
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

    function refresh(){
      if (fileInput.files && fileInput.files.length){
        showFilename(fileInput.files[0].name);
      } else {
        showDefault();
      }
    }

    fileInput.addEventListener('change', refresh);
    if (clearBtn){
      clearBtn.addEventListener('click', function(){
        try{ fileInput.value=''; }catch(e){}
        refresh();
      });
    }
    refresh();
  });
})();