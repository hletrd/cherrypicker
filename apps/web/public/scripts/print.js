(function installPrintController() {
  if (window.__cherrypickerPrintInstalled) return;
  window.__cherrypickerPrintInstalled = true;

  var priorDark = false;
  var prepared = false;

  function preparePrint() {
    if (prepared) return;
    prepared = true;
    priorDark = document.documentElement.classList.contains('dark');
    document.documentElement.classList.add('print-mode');
    document.documentElement.classList.remove('dark');
  }

  function restorePrintTheme() {
    if (!prepared) return;
    document.documentElement.classList.remove('print-mode');
    document.documentElement.classList.toggle('dark', priorDark);
    prepared = false;
  }

  function requestPrint() {
    preparePrint();
    window.print();
  }

  document.addEventListener('click', function onPrintClick(event) {
    var target = event.target instanceof Element
      ? event.target.closest('[data-print-trigger]')
      : null;
    if (!target || target.hasAttribute('disabled')) return;
    event.preventDefault();
    requestPrint();
  });
  window.addEventListener('beforeprint', preparePrint);
  window.addEventListener('afterprint', restorePrintTheme);
})();
