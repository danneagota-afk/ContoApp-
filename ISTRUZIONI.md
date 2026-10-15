# ContoApp — Aurora Pop (grafica originale conservata)

Questo aggiornamento cambia SOLO la grafica (CSS, preferenze tema e riferimenti cache HTML).
Non cambia: struttura dei pannelli, posizione dei blocchi, Firebase, Worker Revolut,
importi, risparmi, registri, PWA o funzioni finanziarie.

## Cosa cambia

- Aggiunto tema Aurora Pop: viola / rosa / blu elettrico / tocchi verde e arancione.
- Primo avvio dell'aggiornamento: Aurora Pop diventa il tema iniziale se prima avevi
  il vecchio tema standard Ocean Blue. Se avevi selezionato un altro tema, resta quello.
- Restano disponibili Ocean Blue, Royal Violet, Emerald Dark, Gold Night e Crimson Luxe.
- Tutte le pagine condividono il tema; preferenza salvata nel browser.
- Nessuna barra nuova, sidebar o spostamento della Home: impaginazione invariata,
  in particolare verticale su telefono.

## Caricare su GitHub Pages

1. Consigliato: esporta/backup il JSON di Firebase prima di ogni intervento al sito.
2. Apri SOLO_MODIFICHE nel pacchetto oppure estrai lo ZIP 'SOLO MODIFICHE'.
3. Carica i 9 file direttamente nella cartella principale del repository
   danneagota-afk/ContoApp- (NON una sottocartella).
4. Commit changes, aspetta il deploy di GitHub Pages.
5. Ricarica ContoApp, anche sul telefono. Puoi selezionare Aurora Pop dal tasto Temi.

## File modificati

- theme.css: nuovo tema con stili di sola presentazione
- experience.js: aggiunta opzione Aurora Pop e prima selezione
- index.html, analisi.html, risparmi.html, revolut.html,
  vinted.html, viaggi.html, login.html: rilevano il nuovo tema
  immediatamente e aggiornano la versione delle risorse

## Verifiche

- CSS analizzato senza errori di parsing
- JS controllato con Node
- Grafica verificata in Chromium con viewport 1440x900 e 390x844;
  nessuno scorrimento orizzontale sullo schermo da 390px
- Scelta Aurora Pop -> Royal Violet -> Aurora Pop testata
- Screenshot generati con dati illustrativi, NON saldi bancari reali

L'aggiornamento non è stato pubblicato automaticamente sul tuo GitHub.
