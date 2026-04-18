(function applyStoredTheme() {
  try {
    const theme = localStorage.getItem('theme');
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
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
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
  menuButton?.addEventListener('click', () => {
    const isHidden = mobileMenu?.classList.toggle('hidden');
    if (isHidden) {
      mobileMenu?.setAttribute('inert', '');
    } else {
      mobileMenu?.removeAttribute('inert');
    }
  });

  document.querySelectorAll('[data-mobile-nav-link]').forEach((link) => {
    link.addEventListener('click', () => {
      mobileMenu?.classList.add('hidden');
      mobileMenu?.setAttribute('inert', '');
    });
  });

  syncThemeIcons();
});
