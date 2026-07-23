(function initializeLayout() {
  function applyStoredTheme() {
    try {
      var theme = localStorage.getItem('cherrypicker:theme');
      if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
      }
    } catch {
      // Storage can be unavailable in private or restricted browsing modes.
    }
  }

  function syncThemeIcons() {
    var isDark = document.documentElement.classList.contains('dark');
    document.getElementById('theme-icon-sun')?.classList.toggle('hidden', !isDark);
    document.getElementById('theme-icon-moon')?.classList.toggle('hidden', isDark);
    document.getElementById('theme-icon-sun-mobile')?.classList.toggle('hidden', !isDark);
    document.getElementById('theme-icon-moon-mobile')?.classList.toggle('hidden', isDark);
  }

  function toggleTheme() {
    var isDark = document.documentElement.classList.toggle('dark');
    try {
      localStorage.setItem('cherrypicker:theme', isDark ? 'dark' : 'light');
    } catch {
      // Theme remains active for this page even when it cannot be persisted.
    }
    syncThemeIcons();
  }

  function setMenuOpen(open, returnFocus) {
    var menuButton = document.getElementById('mobile-menu-btn');
    var mobileMenu = document.getElementById('mobile-menu');
    if (!menuButton || !mobileMenu) return;

    mobileMenu.classList.toggle('hidden', !open);
    if (open) mobileMenu.removeAttribute('inert');
    else mobileMenu.setAttribute('inert', '');
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
    if (!open && returnFocus) menuButton.focus();
  }

  function setupCurrentPage() {
    document.querySelectorAll('a[aria-current="page"]').forEach(function (link) {
      link.setAttribute('aria-current', 'page');
    });
  }

  function setupControls() {
    var desktopTheme = document.getElementById('theme-toggle');
    var mobileTheme = document.getElementById('theme-toggle-mobile');
    var menuButton = document.getElementById('mobile-menu-btn');
    var mobileMenu = document.getElementById('mobile-menu');

    if (desktopTheme && desktopTheme.dataset.layoutBound !== 'true') {
      desktopTheme.dataset.layoutBound = 'true';
      desktopTheme.addEventListener('click', toggleTheme);
    }
    if (mobileTheme && mobileTheme.dataset.layoutBound !== 'true') {
      mobileTheme.dataset.layoutBound = 'true';
      mobileTheme.addEventListener('click', toggleTheme);
    }
    if (menuButton && menuButton.dataset.layoutBound !== 'true') {
      menuButton.dataset.layoutBound = 'true';
      menuButton.addEventListener('click', function () {
        var isOpen = menuButton.getAttribute('aria-expanded') === 'true';
        setMenuOpen(!isOpen, false);
      });
    }
    if (mobileMenu) {
      setMenuOpen(false, false);
      mobileMenu.querySelectorAll('[data-mobile-nav-link]').forEach(function (link) {
        if (link.dataset.layoutBound === 'true') return;
        link.dataset.layoutBound = 'true';
        link.addEventListener('click', function () {
          setMenuOpen(false, false);
        });
      });
    }

    setupCurrentPage();
    syncThemeIcons();
  }

  applyStoredTheme();

  if (!window.__cherrypickerLayoutGlobalBound) {
    window.__cherrypickerLayoutGlobalBound = true;
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape'
        && document.getElementById('mobile-menu-btn')?.getAttribute('aria-expanded') === 'true') {
        setMenuOpen(false, true);
      }
    });
    window.addEventListener('resize', function () {
      if (window.matchMedia('(min-width: 768px)').matches) setMenuOpen(false, false);
    });
    document.addEventListener('astro:page-load', setupControls);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupControls, { once: true });
  } else {
    setupControls();
  }
})();
