# Game Modes Structure

Le modalità di gioco sono ora organizzate in file separati per permettere lo sviluppo collaborativo.

## Struttura dei file

```
src/constants/gameModes/
├── classica.js          # Modalità Classica
├── chaosTools.js        # Modalità Chaos Tools
└── sopravvivenza.js     # Modalità Sopravvivenza
```

## Come aggiungere una nuova modalità

1. **Crea un nuovo file** in `src/constants/gameModes/nomeModalita.js`
2. **Esporta la configurazione** della modalità come oggetto
3. **Esporta eventuali funzioni specifiche** (effetti, logica, ecc.)
4. **Importa nel gameConfig.js** e aggiungila all'oggetto `GAME_MODES`

### Esempio struttura file modalità:

```javascript
// Modalità Esempio
export const ESEMPIO = {
  id: 'esempio',
  name: '🎯 Esempio',
  description: 'Descrizione della modalità',
  icon: '🎯',
  turnDuration: 60,
  // altre proprietà specifiche...
};

// Funzioni specifiche della modalità
export const funzioneEsempio = (parametri) => {
  // logica specifica
};
```

### Vantaggi

- **Collaborazione**: Più sviluppatori possono lavorare su modalità diverse senza conflitti
- **Manutenibilità**: Codice organizzato e modulare
- **Scalabilità**: Facile aggiungere nuove modalità
- **Testabilità**: Ogni modalità può essere testata indipendentemente

## Modalità esistenti

- **Classica**: Regole tradizionali
- **Chaos Tools**: Effetti casuali che disturbano il disegno
- **Sopravvivenza**: Difficoltà crescente con sistema di vite