// === Upload filename fix v2 (append-only) ===
(function(){
  function ready(fn){
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }
  ready(function(){
    const dropZone = document.getElementById('dropZone') || document.querySelector('.dropzone');
    const fileInput = document.getElementById('fileInput') || (dropZone && dropZone.querySelector('input[type="file"]'));
    if (!dropZone || !fileInput) return;

    // ensure label exists
    let fileNameEl = document.getElementById('dzFilename');
    if (!fileNameEl){
      fileNameEl = document.createElement('span');
      fileNameEl.id = 'dzFilename';
      fileNameEl.className = 'dz-filename';
      fileNameEl.setAttribute('aria-live','polite');
      dropZone.appendChild(fileNameEl);
    }

    // cache default children to toggle
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

    // input change (click to choose)
    fileInput.addEventListener('change', function(){ refreshFromFiles(fileInput.files); });

    // drag & drop: still show filename even if code khác xử lý fileInput
    dropZone.addEventListener('dragover', function(e){ e.preventDefault(); });
    dropZone.addEventListener('drop', function(e){
      e.preventDefault();
      const files = e.dataTransfer && e.dataTransfer.files;
      refreshFromFiles(files && files.length ? files : fileInput.files);
    });

    // clear
    if (clearBtn){
      clearBtn.addEventListener('click', function(){
        try{ fileInput.value=''; }catch(e){}
        showDefault();
      });
    }

    // initial
    showDefault();
  });
})();