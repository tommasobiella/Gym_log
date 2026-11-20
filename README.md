# Gym Log

Web app offline-first per registrare e analizzare gli allenamenti in palestra su iPhone, Android e desktop.  
**Zero account, zero server, zero abbonamenti**: tutti i dati restano salvati localmente sul dispositivo tramite `IndexedDB`.

> **App live:** [https://tommasobiella.github.io/Gym_log/](https://tommasobiella.github.io/Gym_log/)

---

## Installazione (consigliata come app su iPhone)

1. Apri **[tommasobiella.github.io/Gym_log](https://tommasobiella.github.io/Gym_log/)** in **Safari**.
2. Tocca **Condividi** (icona con la freccia verso l'alto) nella barra inferiore.
3. Seleziona **Aggiungi alla schermata Home** e conferma.
4. Avvia **Gym Log** dalla nuova icona sulla Home: funziona a schermo intero anche **completamente offline**.

*(Su Android / Desktop con Chrome o Edge puoi installarla allo stesso modo tramite **Aggiungi a schermata Home** o **Installa app** dalla barra degli indirizzi.)*

---

## Come si usa

### 1. Registra (allenamento in tempo reale)
- **Gruppi Muscolari:** scegli il distretto per vedere gli esercizi assegnati, l'ultima seduta (`Ultimo`) e le eventuali serie registrate oggi.
- **Inserimento serie:** tocca un esercizio per aprire la scheda dedicata con:
  - tasti rapidi **Carico** (`±1 kg` e preselettori `-0,5 / +0,5 / +2,5`) e **Ripetizioni** (`±1` e preset `6 / 9 / 12`), oppure tocca direttamente il numero per digitarlo;
  - campo **Note** (apre una finestra dedicata per annotare sensazioni, cedimento o drop set senza spostare la tastiera);
  - pulsante **Salva Serie** in basso.
- **Andamento esercizio & PR:** nella scheda di un esercizio tocca il riepilogo `Ultima · PR` in alto per aprire lo storico specifico con **massimo carico (PR)**, **media volume/serie** ($\text{kg} \times \text{rip}$) e grafico delle ultime sedute.
- **Gestione esercizi:** dal tasto **Nuovo** aggiungi esercizi personalizzati; dal menu **`...`** nella scheda puoi rinominare l'esercizio, spostarlo in un altro gruppo, archiviarlo o eliminarlo.

### 2. Storico (diario cronologico)
- Mostra tutte le sedute ordinate per mese e data con i gruppi muscolari allenati e il conteggio delle serie.
- Espandi una seduta e tocca qualsiasi esercizio per visualizzare, modificare o eliminare le singole serie registrate (carico, ripetizioni, note).
- Usa la barra di ricerca in alto per filtrare per esercizio, gruppo o data.

### 3. Impostazioni (icona ingranaggio in alto a destra)
- **Serie completate oggi:** riepilogo rapido e modifica immediata delle serie della giornata corrente.
- **Esercizi archiviati:** consulta e ripristina in un tocco gli esercizi nascosti.
- **Colore tema:** scegli l'accento cromatico dell'interfaccia (Blu, Viola, Smeraldo, Ambra, Corallo, Ciano).
- **Backup Locale & Ripristino (`.json`):** esporta tutto lo storico in `gym-log-backup.json` (su iPhone tramite *Salva su File / iCloud Drive*, o direttamente in una cartella locale sui browser compatibili) e ripristinalo in qualsiasi momento su un altro dispositivo.

---

## Struttura del repository

- `index.html` — Interfaccia, stili e logica applicativa
- `db.js` — Livello di persistenza locale su `IndexedDB`
- `backup.js` — Esportazione/importazione JSON e gestione cartella locale
- `default-exercises.json` — Catalogo iniziale di esercizi precaricati al primo avvio
- `manifest.json` / `sw.js` — Configurazione PWA e caching offline
- `icon-192.svg` / `icon-512.svg` — Icone dell'app
