function renderRpNav(active) {
  const root = document.getElementById('rp-nav-root');
  if (!root) return;
  const researcher = RP.getResearcher() || {};

  const links = [
    { href: '/researcher-portal/browse.html', label: 'تصفح الأرشيف' },
    { href: '/researcher-portal/my-requests.html', label: 'طلباتي' },
  ];

  root.innerHTML = `
    <header style="background:var(--color-surface); border-bottom:1px solid var(--color-border); padding:16px 32px; display:flex; align-items:center; justify-content:space-between;">
      <div style="display:flex; align-items:center; gap:32px;">
        <strong style="font-size:16px; display:flex; align-items:center; gap:8px;">${icon('search', 18)}بوابة الباحث الخارجي</strong>
        <nav style="display:flex; gap:20px;">
          ${links.map((l) => `<a href="${l.href}" style="font-size:14px; ${active === l.href ? 'color:var(--color-primary); font-weight:700;' : 'color:var(--color-text-muted);'}">${l.label}</a>`).join('')}
        </nav>
      </div>
      <div style="display:flex; align-items:center; gap:16px; font-size:13px; color:var(--color-text-muted);">
        <span>${escapeHtmlRp(researcher.fullName || '')}</span>
        <a href="#" id="rpLogout" style="color:var(--color-danger-text);">تسجيل الخروج</a>
      </div>
    </header>
  `;
  document.getElementById('rpLogout').addEventListener('click', (e) => { e.preventDefault(); RP.logout(); });
}

function escapeHtmlRp(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
