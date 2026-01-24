import React from 'react';
import Button from '../common/Button';

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
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button className={`mode-btn ${selectedModeId === 'classica' ? 'active' : ''}`} onClick={() => setSelectedModeId('classica')}>Classica</button>
          <button className={`mode-btn ${selectedModeId === 'sopravvivenza' ? 'active' : ''}`} onClick={() => setSelectedModeId('sopravvivenza')}>Sopravvivenza</button>
          <button className={`mode-btn ${selectedModeId === 'chaos_tools' ? 'active' : ''}`} onClick={() => setSelectedModeId('chaos_tools')}>Chaos</button>
          <button className={`mode-btn ${selectedModeId === 'puzzleDrawing' ? 'active' : ''}`} onClick={() => setSelectedModeId('puzzle_drawing')}>Puzzle</button>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <label className="lobby-label">Durata turno</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
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

          <div style={{ width: 160 }}>
            <label className="lobby-label">Rounds</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
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
        </div>

        <div style={{ marginBottom: 12 }}>
          <label className="lobby-label">Difficoltà</label>
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
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

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button onClick={onCancel} variant="tertiary">✕ Annulla</Button>
          <Button onClick={onCreate} variant="primary">🎉 Crea stanza</Button>
        </div>
      </div>
    </div>
  );
}
