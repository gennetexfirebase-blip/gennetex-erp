/* Optional viewing preferences; never changes records or server state. */
(() => {
  const key = 'gennetex-admin-table-density';
  const toolbar = document.querySelector('.topbar .user');
  if (!toolbar) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn btn-ghost btn-sm density-toggle';
  button.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">density_small</span>';
  button.setAttribute('aria-label', 'Хүснэгтийг нягт харах');
  button.title = 'Хүснэгтийг нягт харах';
  let compact = false;
  try { compact = localStorage.getItem(key) === 'compact'; } catch (_) { /* Storage may be unavailable. */ }
  function apply() {
    document.documentElement.classList.toggle('tables-compact', compact);
    button.setAttribute('aria-pressed', String(compact));
  }
  button.addEventListener('click', () => {
    compact = !compact;
    apply();
    try { localStorage.setItem(key, compact ? 'compact' : 'comfortable'); } catch (_) { /* Keep the current preference in memory. */ }
  });
  toolbar.insertBefore(button, document.getElementById('themeToggle'));
  apply();
})();
