// === PATCH: Bold "Nhận xét tổng quan" (idempotent) ===
(function(){
  if (window.__BOLD_OVERVIEW_PATCH__) return;
  window.__BOLD_OVERVIEW_PATCH__ = true;

  function boldOverview(el){
    if (!el) return;
    if (el.innerHTML.indexOf('<strong>Nhận xét tổng quan:</strong>') !== -1) return;
    const txt = (el.textContent || '').trim();
    const head = 'Nhận xét tổng quan:';
    if (txt.startsWith(head)){
      const rest = txt.slice(head.length).trimStart();
      el.innerHTML = '<strong>'+head+'</strong> ' + rest;
    }
  }
  function ready(fn){ if(document.readyState!=='loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  ready(function(){
    const overall = document.getElementById('overall') || document.querySelector('.overall');
    if (!overall) return;
    boldOverview(overall);
    const mo = new MutationObserver(function(){ boldOverview(overall); });
    mo.observe(overall, {childList: true, characterData: true, subtree: true});
  });
})();

// === PATCH: De-dup (prevent double init & double render) ===
(function(){
  if (window.__APP_DEDUP_INSTALLED__) return;
  window.__APP_DEDUP_INSTALLED__ = true;

  function ready(fn){ if(document.readyState!=='loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  ready(function(){
    // 1) Clear duplicate listeners by cloning key nodes
    ['dropZone','btnEvaluate','btnClear'].forEach(function(id){
      var el = document.getElementById(id);
      if (el && !el.__dedup_cloned__) {
        var clone = el.cloneNode(true);
        clone.__dedup_cloned__ = true;
        el.parentNode.replaceChild(clone, el);
      }
    });

    // 2) Make render functions idempotent by clearing tbody first
    function clearResultTable(){
      var tb = document.querySelector('#resultTable tbody');
      if (tb) tb.innerHTML = '';
    }
    function clearSgradeTable(){
      var body = document.getElementById('sgradeBody');
      if (body) body.innerHTML = '';
    }

    if (typeof window.renderSgrade === 'function' && !window.renderSgrade.__dedup__){
      var _renderS = window.renderSgrade;
      window.renderSgrade = function(){
        clearSgradeTable();
        return _renderS.apply(this, arguments);
      };
      window.renderSgrade.__dedup__ = true;
    }
    if (typeof window.renderResult === 'function' && !window.renderResult.__dedup__){
      var _renderR = window.renderResult;
      window.renderResult = function(){
        clearResultTable();
        return _renderR.apply(this, arguments);
      };
      window.renderResult.__dedup__ = true;
    }

    // 3) Also clear once on tab switches
    var tabEval = document.getElementById('tab-eval');
    var tabSgrade = document.getElementById('tab-sgrade');
    if (tabEval && !tabEval.__dedup_bind__){
      tabEval.addEventListener('click', clearResultTable);
      tabEval.__dedup_bind__ = true;
    }
    if (tabSgrade && !tabSgrade.__dedup_bind__){
      tabSgrade.addEventListener('click', clearSgradeTable);
      tabSgrade.__dedup_bind__ = true;
    }
  });
})();
