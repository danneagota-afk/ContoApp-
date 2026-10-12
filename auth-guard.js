import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

function createLoadingScreen() {
  const screen = document.createElement('div');
  screen.id = 'contoapp-auth-loading';
  screen.setAttribute('role', 'status');
  screen.setAttribute('aria-live', 'polite');
  screen.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#080a10;color:#ebedf3;display:flex;align-items:center;justify-content:center;padding:24px;font:16px system-ui,sans-serif;text-align:center';
  const info = document.createElement('div');
  const icon = document.createElement('div');
  icon.style.cssText = 'font-size:34px;margin-bottom:16px';
  icon.textContent = '🔒';
  const heading = document.createElement('strong');
  heading.textContent = 'ContoApp privata';
  heading.style.cssText = 'display:block;font-size:21px;margin-bottom:10px';
  const message = document.createElement('p');
  message.id = 'contoapp-auth-message';
  message.textContent = 'Verifica accesso e caricamento dati…';
  message.style.cssText = 'color:#aeb8cb;line-height:1.6';
  info.append(icon, heading, message);
  screen.append(info);
  document.body.append(screen);
  return { screen, message, info };
}

/** Protegge la UI e attende Firebase Auth PRIMA di leggere Realtime Database. */
export async function requireAuth(app) {
  const { screen, message, info } = createLoadingScreen();
  const auth = getAuth(app);
  let user;
  try {
    user = await new Promise((resolve, reject) => {
      const unsubscribe = onAuthStateChanged(auth, person => {
        unsubscribe();
        resolve(person);
      }, error => {
        unsubscribe();
        reject(error);
      });
    });
  } catch (error) {
    message.textContent = 'Impossibile verificare l’accesso. Controlla Internet e ricarica la pagina.';
    console.error('Firebase Auth:', error.code || error.message);
    return new Promise(() => {});
  }

  if (!user) {
    const name = location.pathname.split('/').pop() || 'index.html';
    const safeName = ['index.html', 'analisi.html', 'risparmi.html', 'vinted.html', 'revolut.html'].includes(name)
      ? name : 'index.html';
    location.replace('./login.html?next=' + encodeURIComponent(safeName));
    return new Promise(() => {});
  }

  const navbar = document.querySelector('.navbar');
  if (navbar && !document.getElementById('contoapp-logout')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'contoapp-logout';
    button.textContent = 'Esci';
    button.style.cssText = 'border:1px solid #293247;background:#111725;color:#e8edf5;border-radius:12px;padding:10px 14px;cursor:pointer;font-size:13px;font-weight:700';
    button.addEventListener('click', async () => {
      if (!confirm('Vuoi uscire da ContoApp?')) return;
      button.disabled = true;
      try {
        await signOut(auth);
        location.replace('./login.html');
      } catch (err) {
        button.disabled = false;
        alert('Impossibile uscire. Riprova.');
      }
    });
    navbar.append(button);
  }

  return {
    ready() { screen.remove(); },
    error(err) {
      message.textContent = 'Accesso ai dati negato o connessione non disponibile. Verifica che il tuo utente sia autorizzato nelle regole Firebase.';
      console.error('Realtime Database:', err.code || err.message);
      if (!document.getElementById('contoapp-login-again')) {
        const again = document.createElement('button');
        again.id = 'contoapp-login-again';
        again.textContent = 'Torna al login';
        again.style.cssText = 'margin-top:16px;padding:12px 18px;border:0;border-radius:12px;background:#367af6;color:#fff;font-weight:700;cursor:pointer';
        again.onclick = async () => { await signOut(auth); location.replace('./login.html'); };
        info.append(again);
      }
    }
  };
}
