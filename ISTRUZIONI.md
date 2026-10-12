# ContoApp - login privato e app installabile

Questa versione parte dal codice originale di ContoApp ricevuto come file ZIP, NON dal server bancario modificato precedentemente.

## Installazione su GitHub Pages
1. Vai su https://github.com/danneagota-afk/ContoApp- e apri il branch main.
2. Assicurati che il backup JSON Firebase sia stato scaricato e che nelle regole `.read`/`.write` sia autorizzato soltanto il tuo UID Firebase.
3. In GitHub usa Add file > Upload files. Estrai prima questo archivio; carica tutti i file nella stessa cartella di index.html (il file README è facoltativo).
4. Commit changes. Attendi la pubblicazione di GitHub Pages.
5. Apri https://danneagota-afk.github.io/ContoApp-/login.html e accedi con email/password configurate in Firebase Authentication (NON credenziali Revolut).
6. Verifica il patrimonio esistente senza aggiungere o cancellare movimenti nella prima prova. Prova poi Analitica, Risparmi, Vinted e Esci.
7. Per l'iPhone: Safari > apri la pagina > Condividi > Aggiungi alla schermata Home > Apri come app (se disponibile) > Aggiungi.

## Importante
- NON mettere credenziali, chiavi private o dati bancari dentro al repository pubblico.
- Nessun file di questo archivio modifica Firebase, il suo database o Cloudflare per conto tuo.
- Se in Firebase le regole sono ancora bloccate (`false`), il login funziona ma il patrimonio non potrà essere letto fino a quando il TUO UID è autorizzato.
- L'autenticazione viene gestita da Firebase Authentication con le regole RTDB sul server: non affidarti alla sola schermata di login.
- Le PWA sono web app installabili, non app native App Store. Questa prima versione richiede Internet e non ha ancora la sincronizzazione bancario Revolut.
- Service worker in modalità *solo rete*, senza memorizzare dati bancari o patrimoniali in una cache offline.
- Dopo che avremo verificato il login, procederemo con l'integrazione Open Banking sul Worker Cloudflare.
