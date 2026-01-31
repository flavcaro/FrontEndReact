import React from 'react';
import Button from '../common/Button';
import { PUZZLE_SECTIONS_CONFIG } from '../../constants/gameConfig';

export default function CustomCreateForm({
  selectedModeId,
  setSelectedModeId,
  modeOptions,
  setModeOption,
  onCreate,
  onCancel
}) {
  const durationTips = {
    60: '60s — ideale per disegni più dettagliati',
    45: '45s — buon compromesso tra dettaglio e velocità',
    30: '30s — partite veloci e dinamiche'
  };

  const roundsTips = {
    3: '3 round — partita breve',
    6: '6 round — partita standard',
    9: '9 round — partita lunga'
  };

  const puzzleCyclesTips = {
    1: 'Ogni giocatore indovina almeno 1 volta',
    2: 'Ogni giocatore indovina almeno 2 volte',
    3: 'Ogni giocatore indovina almeno 3 volte'
  };

  const difficultyHelp = {
    easy: 'Parole più semplici e frequenti.',
    medium: 'Mix di parole facili e mediamente difficili.',
    hard: 'Parole più rare/dettagliate per sfida maggiore.'
  };

  return (
    <div className="custom-create">
      <h3 style={{ marginTop: 0 }}>Impostazioni</h3>

      <div style={{ marginBottom: 12 }}>
        <div style={{ marginBottom: 8, color: '#475569' }}>Scegli la modalità</div>
        <div className="options-row modes-select" style={{ marginBottom: 12 }}>
          <button className={`mode-btn ${selectedModeId === 'classica' ? 'active' : ''}`} onClick={() => setSelectedModeId('classica')}>Classica</button>
          <button className={`mode-btn ${selectedModeId === 'sopravvivenza' ? 'active' : ''}`} onClick={() => setSelectedModeId('sopravvivenza')}>Sopravvivenza</button>
          <button className={`mode-btn ${selectedModeId === 'chaos_tools' ? 'active' : ''}`} onClick={() => setSelectedModeId('chaos_tools')}>Chaos</button>
          <button className={`mode-btn ${selectedModeId === 'puzzleDrawing' ? 'active' : ''}`} onClick={() => setSelectedModeId('puzzleDrawing')}>Puzzle</button>
        </div>

        <div className="options-row duration-rounds-row" style={{ gap: 12, marginBottom: 12 }}>
          <div className="duration-col" style={{ minWidth: 0 }}>
            <label className="lobby-label">Durata turno</label>
            <div className="vertical-options" style={{ marginTop: 6 }}>
              {[60,45,30].map((d) => (
                <button
                  key={d}
                  title={durationTips[d]}
                  className={`option-btn ${modeOptions[selectedModeId]?.turnDuration === d ? 'active' : ''}`}
                  onClick={() => setModeOption(selectedModeId, 'turnDuration', d)}
                >
                  <span style={{ marginRight: 6 }}>{d === 60 ? '⏳' : d === 45 ? '⏱️' : '⚡'}</span>
                  {d}s
                </button>
              ))}
            </div>
          </div>

          {/* Rounds solo per modalità classica, sopravvivenza e chaos */}
          {selectedModeId !== 'puzzleDrawing' && (
            <div className="rounds-box rounds-col" style={{ minWidth: 0 }}>
              <label className="lobby-label">Rounds</label>
              <div className="vertical-options" style={{ marginTop: 6 }}>
                {[3,6,9].map((r) => (
                  <button
                    key={r}
                    title={roundsTips[r]}
                    className={`option-btn ${modeOptions[selectedModeId]?.rounds === r ? 'active' : ''}`}
                    onClick={() => setModeOption(selectedModeId, 'rounds', r)}
                  >
                    <span style={{ marginRight: 6 }}>🎯</span>
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Cicli solo per Puzzle Drawing */}
          {selectedModeId === 'puzzleDrawing' && (
            <div className="rounds-box" style={{ width: 180 }}>
              <label className="lobby-label">Cicli di gioco</label>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                {[1,2,3].map((c) => (
                  <button
                    key={c}
                    title={puzzleCyclesTips[c]}
                    className={`option-btn ${modeOptions[selectedModeId]?.cycles === c ? 'active' : ''}`}
                    onClick={() => setModeOption(selectedModeId, 'cycles', c)}
                  >
                    <span style={{ marginRight: 6 }}>🔄</span>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ marginBottom: 12 }}>
          <label className="lobby-label">Difficoltà</label>
          <div className="difficulty-grid" style={{ marginTop: 6 }}>
            {['easy','medium','hard'].map((d) => (
              <button
                key={d}
                title={difficultyHelp[d]}
                className={`option-btn ${modeOptions[selectedModeId]?.difficulty === d ? 'active' : ''}`}
                onClick={() => setModeOption(selectedModeId, 'difficulty', d)}
              >
                <span style={{ marginRight: 6 }}>{d === 'easy' ? '🟢' : d === 'medium' ? '🟡' : '🔴'}</span>
                {d === 'easy' ? 'Facile' : d === 'medium' ? 'Media' : 'Difficile'}
              </button>
            ))}
          </div>
          <div className="difficulty-help" style={{ marginTop: 8, color: '#64748b', fontSize: 13 }}>
            {difficultyHelp[modeOptions[selectedModeId]?.difficulty || 'medium']}
          </div>
        </div>

        {/* Configurazione Sezioni per Puzzle Drawing */}
        {selectedModeId === 'puzzleDrawing' && (
          <div style={{ marginBottom: 12 }}>
            <label className="lobby-label">Configurazione Canvas</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              {Object.entries(PUZZLE_SECTIONS_CONFIG).map(([key, config]) => (
                <button
                  key={key}
                  className={`option-btn ${modeOptions[selectedModeId]?.sections === parseInt(key) ? 'active' : ''}`}
                  onClick={() => setModeOption(selectedModeId, 'sections', parseInt(key))}
                  style={{ flex: 1 }}
                >
                  <span style={{ marginRight: 6 }}>{key === '2' ? '📐' : '🧩'}</span>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span>{key} Sezioni</span>
                    <span style={{ fontSize: 11, opacity: 0.8 }}>{config.description}</span>
                  </div>
                </button>
              ))}
            </div>
            <div className="difficulty-help" style={{ marginTop: 8, color: '#64748b', fontSize: 13 }}>
              {modeOptions[selectedModeId]?.sections === 2 
                ? 'Canvas diviso in 2 sezioni: 2 giocatori disegnano, 2 indovinano simultaneamente'
                : 'Canvas diviso in 3 sezioni: 3 giocatori disegnano, 1 indovina (classico)'
              }
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button onClick={onCancel} variant="tertiary">✕ Annulla</Button>
          <Button onClick={onCreate} variant="primary">Crea stanza</Button>
        </div>
      </div>
    </div>
  );
}
