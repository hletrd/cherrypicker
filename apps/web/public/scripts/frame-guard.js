(function guardAgainstFraming() {
  var root = document.documentElement;

  if (window.top === window.self) {
    root.classList.remove('frame-guard-pending');
    root.removeAttribute('data-frame-blocked');
    return;
  }

  root.setAttribute('data-frame-blocked', 'true');
  try {
    window.top.location.replace(window.self.location.href);
  } catch (_error) {
    // Cross-origin frame access can throw. The document deliberately remains
    // hidden and pointer-inert through its frame-guard-pending class.
  }
})();
