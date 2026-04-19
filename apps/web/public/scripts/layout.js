(function applyStoredTheme() {
  try {
    const theme = localStorage.getItem('cherrypicker:theme');
    if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    }
  } catch {
    // Ignore storage access issues.
  }
})();

function syncThemeIcons() {
  const isDark = document.documentElement.classList.contains('dark');
  const sunEl = document.getElementById('theme-icon-sun');
  const moonEl = document.getElementById('theme-icon-moon');
  const sunElMobile = document.getElementById('theme-icon-sun-mobile');
  const moonElMobile = document.getElementById('theme-icon-moon-mobile');

  sunEl?.classList.toggle('hidden', !isDark);
  moonEl?.classList.toggle('hidden', isDark);
  sunElMobile?.classList.toggle('hidden', !isDark);
  moonElMobile?.classList.toggle('hidden', isDark);
}

function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.classList.toggle('dark');
  try {
    localStorage.setItem('cherrypicker:theme', isDark ? 'dark' : 'light');
  } catch {
    // Ignore storage access issues.
  }
  syncThemeIcons();
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);
  document.getElementById('theme-toggle-mobile')?.addEventListener('click', toggleTheme);

  const menuButton = document.getElementById('mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');

  // Set inert on page load (menu starts hidden).
  // We set it via JS instead of in the HTML so that if JS fails to load,
  // the menu is still accessible (just visually hidden via CSS).
  mobileMenu?.setAttribute('inert', '');

  function closeMenu() {
    mobileMenu?.classList.add('hidden');
    mobileMenu?.setAttribute('inert', '');
    menuButton?.focus();
  }

  function openMenu() {
    mobileMenu?.classList.remove('hidden');
    mobileMenu?.removeAttribute('inert');
    // Move focus to the first link in the menu
    const firstLink = mobileMenu?.querySelector('a');
    firstLink?.focus();
  }

  menuButton?.addEventListener('click', () => {
    const isHidden = mobileMenu?.classList.contains('hidden');
    if (isHidden) {
      openMenu();
    } else {
      closeMenu();
    }
  });

  // Close menu on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mobileMenu && !mobileMenu.classList.contains('hidden')) {
      closeMenu();
    }
  });

  // Focus trap: keep Tab within the menu while it's open
  mobileMenu?.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const focusable = mobileMenu.querySelectorAll('a, button, [tabindex]:not([tabindex="-1"])');
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  document.querySelectorAll('[data-mobile-nav-link]').forEach((link) => {
    link.addEventListener('click', () => {
      closeMenu();
    });
  });

  syncThemeIcons();
});
