/* Click-to-open explainer windows (native <dialog>).
   A card with data-popup="<dialog id>" opens that dialog; Esc, the close button or a
   click on the backdrop closes it. Loaded in <head> so its capture listener runs
   before the step controller: while a dialog is open, slide keys do nothing. */
(() => {
  const openDialog = () => document.querySelector('dialog.popup[open]');

  window.addEventListener('keydown', (e) => {
    if (openDialog() && e.key !== 'Escape') e.stopImmediatePropagation();
  }, true);

  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-popup]');
    if (trigger) {
      const dlg = document.getElementById(trigger.dataset.popup);
      if (dlg && !dlg.open) dlg.showModal();
      return;
    }
    const dlg = openDialog();
    if (!dlg) return;
    // the backdrop belongs to the dialog element itself; content sits in .popup-body
    if (e.target === dlg || e.target.closest('.popup-close')) dlg.close();
  });

  document.addEventListener('keydown', (e) => {
    const t = e.target.closest && e.target.closest('[data-popup]');
    if (t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); t.click(); }
  });
})();
