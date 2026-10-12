/* ContoApp UX. No bank credentials or financial information are persisted here. */
(() => {
  'use strict';
  function setup() {
    const toggle = document.querySelector('.privacy-toggle');
    if (toggle) {
      let hidden = false;
      toggle.addEventListener('click', () => {
        hidden = !hidden;
        document.body.classList.toggle('mask-values', hidden);
        toggle.setAttribute('aria-pressed', String(hidden));
        toggle.textContent = hidden ? '◉ Mostra importi' : '◎ Nascondi importi';
        toggle.setAttribute('aria-label', hidden ? 'Mostra gli importi' : 'Nascondi gli importi');
      });
    }


    // The two quick amount tiles are real keyboard-operable controls, not just decorative cards.
    for (const id of ['note20', 'note50']) {
      const tile = document.getElementById(id);
      if (!tile) continue;
      tile.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          tile.click();
        }
      });
    }

    // Visually separate irreversible bulk deletions from ordinary controls.
    for (const id of ['reset-all-btn', 'reset-extra-btn', 'reset-work-btn', 'btn-reset']) {
      const target = document.getElementById(id);
      if (!target || target.closest('.danger-zone')) continue;
      const details = document.createElement('details');
      details.className = 'danger-zone';
      const summary = document.createElement('summary');
      summary.textContent = 'Gestione e cancellazione dati';
      const explain = document.createElement('p');
      explain.textContent = 'Questa operazione modifica il tuo registro personale. Verifica prima di continuare.';
      target.parentNode.insertBefore(details, target);
      details.append(summary, explain, target);
    }

    const pwVisibility = document.getElementById('show-password');
    if (pwVisibility) {
      pwVisibility.addEventListener('change', () => {
        const password = document.getElementById('password');
        if (password) password.type = pwVisibility.checked ? 'text' : 'password';
      });
    }

    // Better keyboard entry and accessible fallback for legacy unlabeled fields.
    document.querySelectorAll('input, select, textarea').forEach(el => {
      if (!el.hasAttribute('aria-label') && !el.labels?.length && el.getAttribute('placeholder')) {
        el.setAttribute('aria-label', el.getAttribute('placeholder'));
      }
      if (el instanceof HTMLInputElement && el.type === 'number') {
        el.inputMode = 'decimal';
      }
    });

    // Prevent accidental appending to operations when pressing Escape.
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      const close = document.getElementById('m-close-btn');
      const cancel = document.getElementById('ms-cancel-btn');
      const modal = document.getElementById('modal');
      const sub = document.getElementById('modal-sub');
      if (modal && getComputedStyle(modal).display !== 'none' && close) close.click();
      else if (sub && getComputedStyle(sub).display !== 'none' && cancel) cancel.click();
    });

    // Explicit offline message: service worker does not store account data offline.
    const notice = document.createElement('div');
    notice.className = 'offline-notice';
    notice.setAttribute('role', 'status');
    notice.hidden = true;
    notice.textContent = 'Sei offline. I saldi non si aggiornano finché non torna la connessione.';
    notice.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2200;padding:11px 16px;text-align:center;background:#593344;color:#fff4f6;border-bottom:1px solid #9e6174;font:600 13px system-ui,sans-serif';
    document.body.append(notice);
    const updateConnection = () => { notice.hidden = navigator.onLine; };
    window.addEventListener('online', updateConnection);
    window.addEventListener('offline', updateConnection);
    updateConnection();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup, { once: true });
  else setup();
})();
