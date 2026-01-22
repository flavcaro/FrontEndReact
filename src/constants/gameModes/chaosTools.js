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
    // Visual effects applied via CSS to the canvas container
    { id: 'mirror', style: { transform: 'scaleX(-1)' }, name: 'Specchio', type: 'visual' },
    { id: 'upsideDown', style: { transform: 'scaleY(-1)' }, name: 'Capovolto', type: 'visual' },
    { id: 'rotate', style: { transform: 'rotate(15deg)' }, name: 'Ruotato', type: 'visual' },
    { id: 'zoom', style: { transform: 'scale(1.2)' }, name: 'Zoom', type: 'visual' },
    { id: 'trembleVisual', style: { animation: 'tremble 0.12s infinite' }, name: 'Tremolio (visivo)', type: 'visual' },
    { id: 'skew', style: { transform: 'skew(10deg, 5deg)' }, name: 'Deformato', type: 'visual' },

    // Behavior effects (handled in drawing logic)
    { id: 'randomColor', name: 'Colori Casuali', type: 'behavior' },
    { id: 'inputLag', name: 'Input Lag', type: 'behavior', params: { min: 80, max: 260 } },
    // Trembling lines: the artist's stroke points will be perturbed while drawing
    { id: 'tremblingLines', name: 'Linee Tremolanti', type: 'behavior', params: { amplitude: { min: 1, max: 6 }, frequency: { min: 30, max: 160 } } },
    // No drawing feedback: artist's local preview is hidden (they still draw but see nothing)
    { id: 'noPreview', name: 'Nessun Feedback', type: 'behavior', params: { hideLocalPreview: true } }
  ];

  // Helper to pick random integer in inclusive range
  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  // Seleziona 1-3 effetti casuali
  const numEffects = Math.floor(Math.random() * 3) + 1;
  const shuffled = [...possibleEffects].sort(() => 0.5 - Math.random());
  let selected = shuffled.slice(0, numEffects).map(effect => {
    // Clone effect so we can attach resolved params without mutating source
    const e = JSON.parse(JSON.stringify(effect));

    if (e.params) {
      // Resolve numeric ranges into concrete values
      Object.keys(e.params).forEach(key => {
        const val = e.params[key];
        if (val && typeof val === 'object' && 'min' in val && 'max' in val) {
          e.params[key] = randInt(val.min, val.max);
        }
        // boolean/static params remain unchanged
      });
    }

    return e;
  });

  // Ensure at least one behavior effect is present if any behaviors are available
  const hasBehavior = selected.some(s => s.type === 'behavior');
  const availableBehaviors = possibleEffects.filter(p => p.type === 'behavior');
  if (!hasBehavior && availableBehaviors.length > 0) {
    // Replace a random selected effect with a random behavior effect
    const replaceIndex = Math.floor(Math.random() * selected.length);
    const behaviorChoice = availableBehaviors[Math.floor(Math.random() * availableBehaviors.length)];
    selected[replaceIndex] = JSON.parse(JSON.stringify(behaviorChoice));

    // Resolve params for the inserted behavior if needed
    if (selected[replaceIndex].params) {
      Object.keys(selected[replaceIndex].params).forEach(key => {
        const val = selected[replaceIndex].params[key];
        if (val && typeof val === 'object' && 'min' in val && 'max' in val) {
          selected[replaceIndex].params[key] = randInt(val.min, val.max);
        }
      });
    }
  }

  return selected;
};