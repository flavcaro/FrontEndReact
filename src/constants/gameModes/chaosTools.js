// Modalità Chaos Tools
export const CHAOS_TOOLS = {
  id: 'chaos_tools',
  name: '🌀 Chaos Tools',
  description: 'Modificatori casuali disturbano il disegno: colori casuali, canvas deformato, ritardo input, zoom imprevisti, linee tremolanti',
  icon: '🌀',
  turnDuration: 45,
  hasChaosEffects: true
};

// Genera effetti casuali per Chaos Tools
export const generateChaosEffects = () => {
  const possibleEffects = [
    { id: 'mirror', style: { transform: 'scaleX(-1)' }, name: 'Specchio' },
    { id: 'upsideDown', style: { transform: 'scaleY(-1)' }, name: 'Capovolto' },
    { id: 'rotate', style: { transform: 'rotate(15deg)' }, name: 'Ruotato' },
    { id: 'zoom', style: { transform: 'scale(1.2)' }, name: 'Zoom' },
    { id: 'tremble', style: { animation: 'tremble 0.1s infinite' }, name: 'Tremolio' },
    { id: 'skew', style: { transform: 'skew(10deg, 5deg)' }, name: 'Deformato' }
  ];

  // Seleziona 1-3 effetti casuali
  const numEffects = Math.floor(Math.random() * 3) + 1;
  const selected = [];
  const shuffled = [...possibleEffects].sort(() => 0.5 - Math.random());

  for (let i = 0; i < numEffects; i++) {
    selected.push(shuffled[i]);
  }

  return selected;
};