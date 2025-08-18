

// === PATCH: Bold "Nhận xét tổng quan:" safely ===
(function(){
  function boldOverviewOnce(el){
    if (!el) return;
    // Avoid double-bolding
    if (el.innerHTML.includes('<strong>Nhận xét tổng quan:</strong>')) return;
    const txt = (el.textContent || '').trim();
    const needle = 'Nhận xét tổng quan:';
    if (txt.startsWith(needle)){
      const rest = txt.slice(needle.length).trimStart();
      el.innerHTML = '<strong>' + needle + '</strong> ' + rest;
    }
  }
  function ready(fn){ if(document.readyState!=='loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  ready(function(){
    const overall = document.getElementById('overall') || document.querySelector('.overall');
    if (!overall) return;
    boldOverviewOnce(overall);
    // If app updates this node later, observe and bold again (first line only)
    const mo = new MutationObserver(function(){ boldOverviewOnce(overall); });
    mo.observe(overall, {childList: true, characterData: true, subtree: true});
  });
})();
