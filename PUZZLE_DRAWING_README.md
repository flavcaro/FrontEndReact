# 🧩 Puzzle Drawing - Modalità di Gioco

## Descrizione
Puzzle Drawing è una modalità di gioco collaborativa dove il canvas viene diviso in 3 sezioni verticali. Ogni giocatore disegna nella propria sezione mentre un altro giocatore cerca di indovinare cosa stanno disegnando insieme.

## Requisiti
- **Minimo giocatori**: 4 (3 disegnatori + 1 indovinatore)
- **Massimo giocatori**: 6
- **Durata turno**: 90 secondi (più tempo per coordinare il disegno)

## Come Funziona

### Struttura del Canvas
Il canvas è diviso in 3 sezioni verticali:
- **Sezione Sinistra** (primo disegnatore)
- **Sezione Centro** (secondo disegnatore)
- **Sezione Destra** (terzo disegnatore)

### Ruoli dei Giocatori

#### Disegnatori (3 giocatori)
- Ogni disegnatore ha una sezione del canvas assegnata
- Possono disegnare **solo** nella propria sezione
- Devono collaborare per creare un disegno coerente che rappresenti la parola
- Non possono comunicare tramite chat durante il disegno

#### Indovinatore (1 giocatore)
- Osserva il disegno completo mentre viene creato
- Deve indovinare la parola vedendo i 3 frammenti uniti
- Può scrivere nella chat per fare i tentativi

### Sistema di Rotazione
Il gioco continua con una rotazione dei ruoli fino a quando **tutti i giocatori hanno indovinato almeno una volta**:

1. **Round 1**: A, B, C disegnano → D indovina
2. **Round 2**: A, B, D disegnano → C indovina  
3. **Round 3**: A, C, D disegnano → B indovina
4. **Round 4**: B, C, D disegnano → A indovina

## Sistema di Punteggio

### Punti per l'Indovinatore
- **Base**: 150 punti
- **Bonus tempo veloce** (>50% tempo rimasto): +75 punti
- **Bonus tempo medio** (>25% tempo rimasto): +37 punti

### Punti per i Disegnatori
- **Base**: 50 punti (quando qualcuno indovina)
- **Team Bonus**: +30 punti aggiuntivi se l'indovinata avviene con >50% del tempo rimasto

## Strategia

### Per i Disegnatori
- **Coordinate visivamente**: Guardate cosa disegnano gli altri per creare coerenza
- **Dividete il soggetto**: Es. per "gatto" → uno disegna la testa, uno il corpo, uno la coda
- **Siate semplici**: Disegni troppo complessi sono difficili da coordinare
- **Usate colori simili**: Aiuta a creare unità visiva

### Per l'Indovinatore
- **Guardate l'insieme**: Non concentrate su una singola sezione
- **Cercate pattern**: Elementi che si ripetono o si collegano tra le sezioni
- **Pensate in modo astratto**: Il disegno potrebbe essere stilizzato o diviso in modo creativo

## Caratteristiche Tecniche

### File Principali
```
src/
├── constants/gameModes/puzzleDrawing.js      # Configurazione modalità
├── services/puzzleGameService.js             # Logica di gioco
├── hooks/usePuzzleGame.js                    # Hook React per stato gioco
├── components/Game/
│   ├── PuzzleCanvas.js                       # Canvas con sezioni
│   └── PuzzleBoard.js                        # Board completo puzzle
```

### Funzioni Chiave

#### `assignPuzzleRoles(players, roundIndex)`
Assegna i ruoli (disegnatori e indovinatore) in base al round corrente.

#### `getSectionBounds(section, canvasWidth, canvasHeight)`
Calcola i confini di una sezione specifica del canvas.

#### `isPointInSection(x, y, section, canvasWidth, canvasHeight)`
Verifica se un punto è all'interno della sezione assegnata al giocatore.

#### `calculatePuzzleScore(timeLeft, turnDuration)`
Calcola i punteggi per indovinatore e disegnatori in base al tempo rimasto.

## Come Giocare

1. **Crea una stanza** dalla home
2. **Seleziona "🧩 Puzzle Drawing"** come modalità di gioco
3. **Configura difficoltà e durata** (opzionale)
4. **Aspetta almeno 4 giocatori**
5. **Inizia la partita** (solo il creatore)
6. **Collabora e divertiti!**

## Regole Importanti

✅ **Permesso**:
- Disegnare nella propria sezione
- Usare tutti i colori disponibili
- Cambiare dimensione del pennello

❌ **Non Permesso**:
- Disegnare fuori dalla propria sezione (il disegno si ferma automaticamente)
- Comunicare nella chat durante il disegno (solo l'indovinatore può scrivere)
- Cancellare il disegno degli altri

## Suggerimenti

- 🎨 **Pianificate prima**: Pensate a come dividere l'oggetto prima di iniziare
- 🤝 **Lavoro di squadra**: La chiave è la collaborazione visiva
- ⚡ **Velocità**: Più veloce indovinate, più punti per tutti
- 🎯 **Semplicità**: Disegni semplici sono più facili da coordinare

## Esempi di Strategie

### Parola: "Casa"
- **Sezione Sinistra**: Finestra e parte del muro
- **Sezione Centro**: Porta e muro centrale  
- **Sezione Destra**: Finestra e parte del muro
- **Tutti**: Contribuiscono al tetto che attraversa le sezioni

### Parola: "Gatto"
- **Sezione Sinistra**: Testa e orecchie
- **Sezione Centro**: Corpo
- **Sezione Destra**: Coda

### Parola: "Sole"
- **Sezione Sinistra**: Raggi sul lato sinistro
- **Sezione Centro**: Cerchio centrale
- **Sezione Destra**: Raggi sul lato destro

Buon divertimento! 🎉
