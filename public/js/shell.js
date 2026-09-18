/**
 * Renders the sidebar into <div id="sidebar-root"></div> on every
 * authenticated page. Sections/items come from GET /nav-sections (A3) —
 * nothing here is hardcoded per-tenant, so a tenant with a smaller
 * nav_sections config (like the ministry demo tenant in the seed) simply
 * renders fewer sections, no frontend branching needed.
 */
const NAV_ITEM_META = {
  dashboard: { label: 'لوحة التحكم', icon: 'dashboard', href: '/dashboard.html' },
  video_list: { label: 'قائمة الفيديوهات', icon: 'video', href: '/content-items.html?type=VIDEO' },
  photo_list: { label: 'قائمة الصور', icon: 'image', href: '/content-items.html?type=IMAGE' },
  document_list: { label: 'قائمة المستندات', icon: 'document', href: '/content-items.html?type=DOCUMENT' },
  event_clips: { label: 'مقاطع الحدث', icon: 'clip', href: '/content-items.html?type=VIDEO' },
  event_photos: { label: 'صور الحدث', icon: 'clip', href: '/content-items.html?type=IMAGE' },
  video_productions: { label: 'إنتاجات الفيديو', icon: 'film', href: '/content-items.html?type=VIDEO' },
  ai_brands: { label: 'العلامات التجارية (ذكاء اصطناعي)', icon: 'sparkle', href: '/ai-predictions.html?type=BRAND' },
  ai_clip_characters: { label: 'شخصيات المقاطع (ذكاء اصطناعي)', icon: 'sparkle', href: '/ai-predictions.html?type=CHARACTER' },
  ai_clip_text: { label: 'نص المقطع (ذكاء اصطناعي)', icon: 'sparkle', href: '/ai-predictions.html?type=TEXT' },
  characters: { label: 'الشخصيات', icon: 'people', href: '/persons-list.html' },
  merge_suggestions: { label: 'دمج المكررين', icon: 'shuffle', href: '/merge-suggestions.html' },
  brands: { label: 'العلامات التجارية', icon: 'tag', href: '/brands.html' },
  researcher_list: { label: 'مهام الباحثين', icon: 'user', href: '/tasks.html' },
  event_type: { label: 'نوع الحدث', icon: 'book', href: '/event-types.html' },
  settings: { label: 'الإعدادات', icon: 'settings', href: '/settings.html' },
};

async function renderShell(activeHref) {
  const root = document.getElementById('sidebar-root');
  if (!root) return;

  const user = HBJ.getUser() || {};
  const initials = (user.fullName || '?').trim().charAt(0);

  let sections = [];
  try {
    sections = await HBJ.api('/nav-sections');
  } catch {
    // If nav-sections can't load, the page still works — just without the
    // dynamic grouping. A hardcoded "Dashboard" link keeps navigation from
    // being a complete dead end.
    sections = [{ sectionName: 'عام', items: ['dashboard'] }];
  }

  const sectionsHtml = sections.map((section) => `
    <div class="nav-section">
      <div class="nav-section-title">${escapeHtml(section.sectionName)}</div>
      ${(section.items || []).map((key) => {
        const meta = NAV_ITEM_META[key];
        if (!meta) return '';
        const isActive = activeHref && meta.href.startsWith(activeHref);
        return `<a class="nav-item${isActive ? ' active' : ''}" href="${meta.href}">
          <span class="nav-icon">${icon(meta.icon, 17)}</span>${meta.label}
        </a>`;
      }).join('')}
    </div>
  `).join('');

  root.innerHTML = `
    <aside class="sidebar">
      <div class="sidebar-profile">
        <div class="sidebar-avatar">${escapeHtml(initials)}</div>
        <div>
          <div class="sidebar-name">${escapeHtml(user.fullName || '')}</div>
          <div class="sidebar-role">${escapeHtml(roleLabel(user.role))}</div>
        </div>
      </div>
      <a class="nav-item${activeHref === '/dashboard.html' ? ' active' : ''}" href="/dashboard.html">
        <span class="nav-icon">${icon('dashboard', 17)}</span>لوحة التحكم
      </a>
      <a class="nav-item${activeHref === '/search.html' ? ' active' : ''}" href="/search.html">
        <span class="nav-icon">${icon('search', 17)}</span>البحث
      </a>
      ${sectionsHtml}
      <div class="sidebar-footer">
        <a class="nav-item" href="/profile.html"><span class="nav-icon">${icon('user', 17)}</span>الملف الشخصي</a>
        <a class="nav-item" href="#" id="logoutLink"><span class="nav-icon">${icon('power', 17)}</span>تسجيل الخروج</a>
      </div>
    </aside>
  `;

  document.getElementById('logoutLink').addEventListener('click', (e) => {
    e.preventDefault();
    HBJ.logout();
  });
}

function roleLabel(role) {
  const map = {
    OWNER: 'مالك',
    SUPER_ADMIN: 'مدير عام',
    ADMIN: 'مدير',
    MEDIA_ADMIN: 'مدير وسائط',
    RESEARCHER: 'باحث',
  };
  return map[role] || role || '';
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
