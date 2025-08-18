// === De-dup patch: prevent double init & double rendering (append-only) ===
(function(){
  if (window.__APP_DEDUP_INSTALLED__) return;
  window.__APP_DEDUP_INSTALLED__ = true;

  function ready(fn){ if(document.readyState!=='loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }

  ready(function(){

    // 1) If script got executed twice, clear old listeners on key nodes by cloning them
    ['dropZone','btnEvaluate','btnClear'].forEach(function(id){
      var el = document.getElementById(id);
      if (el && !el.__dedup_cloned__) {
        var clone = el.cloneNode(true);
        clone.__dedup_cloned__ = true;
        el.parentNode.replaceChild(clone, el);
      }
    });

    // 2) Ensure table bodies are cleared before (re)render
    function clearResultTable(){
      var tb = document.querySelector('#resultTable tbody');
      if (tb) tb.innerHTML = '';
    }
    function clearSgradeTable(){
      var body = document.getElementById('sgradeBody');
      if (body) body.innerHTML = '';
    }

    // 3) Monkey-patch known renderers to be idempotent
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

    // 4) Also clear once on tab switches (defensive)
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