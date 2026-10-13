/* ContoApp UX. No bank credentials or financial information are persisted here. */
(() => {
  'use strict';
  function setup() {
    // Stesso valore in tutte le pagine, refresh, PWA e nuove schede dello stesso sito.
    // In localStorage viene salvato SOLO il flag 1/0, mai saldi o credenziali.
    const STORAGE_KEY = 'contoapp.hideAmounts.v1';
    const root = document.documentElement;
    const toggle = document.querySelector('.privacy-toggle');
    let hidden = root.classList.contains('mask-values');

    function updatePrivacy(isHidden, persist = false) {
      hidden = !!isHidden;
      root.classList.toggle('mask-values', hidden);
      // Compatibilità con vecchi selettori che puntavano direttamente al body.
      document.body.classList.toggle('mask-values', hidden);
      if (toggle) {
        toggle.setAttribute('aria-pressed', String(hidden));
        toggle.textContent = hidden ? '◉ Mostra importi' : '◎ Nascondi importi';
        toggle.setAttribute('aria-label', hidden ? 'Mostra gli importi' : 'Nascondi gli importi');
        toggle.setAttribute('title', hidden ? 'Mostra gli importi in tutte le pagine' : 'Nascondi gli importi in tutte le pagine');
      }
      if (persist) {
        try { localStorage.setItem(STORAGE_KEY, hidden ? '1' : '0'); }
        catch (_) { /* La preferenza resta valida solo in questa pagina se storage è bloccato. */ }
      }
    }

    // Riconferma lo stato iniziale e quello del documento, senza modificarlo.
    try { hidden = localStorage.getItem(STORAGE_KEY) === '1'; }
    catch (_) { /* Usa quello precaricato nell'head. */ }
    updatePrivacy(hidden);

    if (toggle) {
      toggle.addEventListener('click', () => updatePrivacy(!hidden, true));
    }
    // Cambiare la preferenza in un'altra scheda aggiorna anche questa.
    window.addEventListener('storage', event => {
      if (event.key === STORAGE_KEY || event.key === null) {
        let latest = false;
        try { latest = localStorage.getItem(STORAGE_KEY) === '1'; }
        catch (_) { return; }
        updatePrivacy(latest);
      }
    });


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
