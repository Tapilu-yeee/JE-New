// FIX: stable upload behavior without hiding overlays
(function(){
  function ready(fn){
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }
  ready(function(){
    const dropZone = document.getElementById('dropZone') || document.querySelector('.dropzone');
    if (!dropZone) return;
    const fileInput = document.getElementById('fileInput') || dropZone.querySelector('input[type="file"]');
    if (!fileInput) return;

    // Detect text container inside dropzone (the div containing 'Click to upload...')
    let labelDiv = null;
    const children = Array.from(dropZone.children);
    for (const el of children){
      if (el.tagName === 'DIV' && !el.classList.contains('dz-icon') && el !== fileInput){
        labelDiv = el; break;
      }
    }
    if (!labelDiv){
      labelDiv = document.createElement('div');
      dropZone.insertBefore(labelDiv, fileInput);
    }
    const defaultHTML = labelDiv.innerHTML;

    const evalBtn = document.getElementById('btnEvaluate') || Array.from(document.querySelectorAll('button')).find(b => /đánh\s*g(i|í)a\s*jd/i.test((b.textContent||'').toLowerCase()));
    const clearBtn = document.getElementById('btnClear') || Array.from(document.querySelectorAll('button')).find(b => /xóa\s*nội\s*dung/i.test((b.textContent||'').toLowerCase()));
    if (evalBtn) evalBtn.disabled = true;

    function updateLabel(files){
      if (files && files.length){
        labelDiv.textContent = 'Đã chọn: ' + files[0].name;
        if (evalBtn) evalBtn.disabled = false;
      } else {
        labelDiv.innerHTML = defaultHTML;
        if (evalBtn) evalBtn.disabled = true;
      }
    }

    // Click anywhere on dropzone to open picker
    dropZone.addEventListener('click', function(e){
      if (e.target && e.target.tagName === 'INPUT') return;
      fileInput.click();
    });
    // Keyboard
    dropZone.setAttribute('role','button');
    if (!dropZone.getAttribute('tabindex')) dropZone.setAttribute('tabindex','0');
    dropZone.addEventListener('keydown', function(e){
      if (e.key === 'Enter' || e.key === ' '){
        e.preventDefault(); fileInput.click();
      }
    });

    // Change + DnD
    fileInput.addEventListener('change', function(){ updateLabel(fileInput.files); });
    dropZone.addEventListener('dragover', function(e){ e.preventDefault(); });
    dropZone.addEventListener('drop', function(e){
      e.preventDefault();
      const files = e.dataTransfer && e.dataTransfer.files;
      updateLabel(files && files.length ? files : fileInput.files);
    });

    // Clear
    if (clearBtn){
      clearBtn.addEventListener('click', function(){
        try{ fileInput.value=''; }catch(e){}
        updateLabel(null);
      });
    }

    // Init
    updateLabel(fileInput.files);
  });
})();