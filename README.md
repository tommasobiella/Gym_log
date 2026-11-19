# Gym Log (Standalone Offline-First PWA)

Web app leggera e offline-first per registrare e consultare i propri allenamenti in palestra su iPhone, Android e desktop.  
**Zero account, zero server, zero dipendenze esterne**: tutti i dati restano sul dispositivo (`IndexedDB`) con backup e ripristino in un singolo file `.json`.

## Funzionalità

- **Modalità Registra (Scrittura):** navigazione rapida per gruppo muscolare, calcolo automatico di `Ultima serie`, `PR` e giorni dall'ultimo allenamento, inserimento tramite Bottom Sheet iOS con tastoni `±1 kg`, preset `-0,5 / +0,5 / +2,5` e `6 / 9 / 12`, note e swipe down per chiudere.
- **Modalità Storico (Lettura):** toggle inferiore fisso tra **Per Seduta** (diario mensile collassabile con gruppi muscolari allenati) e **Per Esercizio** (raggruppato per distretto con PR, delta ultima seduta, grafico andamento e dettaglio serie con note individuali), con modifica ed eliminazione di qualsiasi serie passata.
- **Gestione Esercizi:** catalogo iniziale di esempio completamente modificabile (rinomina inline con `Invio`, spostamento di gruppo, eliminazione) + creazione di nuovi esercizi personalizzati.
- **Backup & Ripristino (`.json`):** tasto rapido **Backup** in alto a destra per salvare e ripristinare tutto lo storico in un unico file `gym-log-backup.json` (cartella locale su browser desktop/Android compatibili, oppure *Salva su File / iCloud Drive* su iPhone).

## Come installarla su iPhone (PWA)

1. Apri il link dell'app in **Safari** (`https://tommasobiella.github.io/Gym_log/`).
2. Tocca il pulsante **Condividi** (quadrato con freccia verso l'alto) in basso.
3. Scorri e seleziona **Aggiungi alla schermata Home**.
4. Apri l'app dall'icona creata sulla Home: da questo momento funziona anche **completamente offline** in palestra.

## Pubblicare su GitHub Pages

1. Carica i file di questa cartella in un repository pubblico su GitHub (branch `main`).
2. Vai in **Settings $\rightarrow$ Pages**.
3. In **Build and deployment**, seleziona **Deploy from a branch** $\rightarrow$ `main` $\rightarrow$ `/ (root)` e salva.
4. Dopo ~30 secondi l'app è live su `https://<tuo-username>.github.io/<nome-repo>/`.
