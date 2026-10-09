// Settings sidebar: full-height, collapsible to an icon rail on wide screens (state kept in
// localStorage), an off-canvas drawer with a backdrop on narrow screens (< 768px).
// The search form is a single DOM node that moves between the sidebar and the top bar, so
// it is always visible: in the sidebar when that is expanded, otherwise in the top bar.

const KEY = 'synoikon.sidebar';
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

export function setupSidebar({ store }) {
  const $ = (id) => document.getElementById(id);
  const root = document.documentElement;
  const sb = $('sidebar'), body = $('sbBody'), toggle = $('sbToggle'), menu = $('menuBtn'), backdrop = $('sbBackdrop');
  const form = $('search'), sideSlot = $('searchSlotSide'), topSlot = $('searchSlotTop'), secSearch = $('secSearch');
  const mq = matchMedia('(max-width: 767.98px)');
  const mobile = () => mq.matches;
  let collapsed = store.get(KEY) === 'collapsed';
  let open = false;

  function placeSearch() {
    const target = mobile() || collapsed ? topSlot : sideSlot;
    if (form.parentNode !== target) {
      const focused = form.contains(document.activeElement) ? document.activeElement : null;
      target.append(form);
      focused?.focus({ preventScroll: true });
    }
    secSearch.hidden = target === topSlot;
  }

  function sync() {
    const m = mobile();
    root.classList.toggle('sb-collapsed', !m && collapsed);
    root.classList.toggle('sb-open', m && open);
    const expanded = m ? open : !collapsed;
    const label = m ? 'Close settings' : collapsed ? 'Expand settings' : 'Collapse settings';
    toggle.setAttribute('aria-expanded', String(expanded));
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
    menu.setAttribute('aria-expanded', String(m && open));
    sb.inert = m && !open;
    backdrop.hidden = !(m && open);
    placeSearch();
  }

  function setCollapsed(v) {
    collapsed = v;
    store.set(KEY, v ? 'collapsed' : 'expanded');
    sync();
  }
  function openDrawer(focusEl) {
    open = true; sync();
    (focusEl || toggle).focus({ preventScroll: !!focusEl });
  }
  function closeDrawer({ restoreFocus = true } = {}) {
    if (!open) return;
    open = false; sync();
    if (restoreFocus) menu.focus({ preventScroll: true });
  }
  /** Expand (desktop) or open (mobile) the sidebar and bring one section into view. */
  function reveal(sectionId) {
    const sec = $(sectionId);
    const first = sec?.querySelector(FOCUSABLE);
    if (mobile()) openDrawer(first); else { if (collapsed) setCollapsed(false); first?.focus({ preventScroll: true }); }
    if (sec) {
      sec.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      sec.classList.add('flash'); setTimeout(() => sec.classList.remove('flash'), 1200);
    }
  }

  toggle.addEventListener('click', () => (mobile() ? closeDrawer() : setCollapsed(!collapsed)));
  menu.addEventListener('click', () => (open ? closeDrawer() : openDrawer()));
  backdrop.addEventListener('click', () => closeDrawer());
  for (const b of sb.querySelectorAll('.sb-rail button')) b.addEventListener('click', () => reveal(b.dataset.section));
  document.addEventListener('keydown', (e) => {
    if (!(mobile() && open)) return;
    if (e.key === 'Escape' && !document.querySelector('dialog[open]')) { e.preventDefault(); closeDrawer(); return; }
    if (e.key === 'Tab') { // keep focus inside the open drawer
      const items = [...sb.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  mq.addEventListener('change', () => { open = false; sync(); });
  sync();
  return { reveal, closeDrawer, isMobile: mobile, isCollapsed: () => !mobile() && collapsed, isOpen: () => mobile() && open, body };
}
