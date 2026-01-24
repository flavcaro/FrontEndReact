// Modalità Chaos Tools
export const CHAOS_TOOLS = {
  id: 'chaos_tools',
  name: '🌀 Chaos Tools',
  description: 'Modificatori casuali disturbano il disegno: colori casuali, canvas deformato, ritardo input, linee tremolanti',
  icon: '🌀',
  turnDuration: 45,
  hasChaosEffects: true
};

// Lista di effetti disponibili per Chaos Tools (riutilizzabile)
const possibleEffects = [
    // Visual effects applied via CSS to the canvas container
    { id: 'mirror', style: { transform: 'scaleX(-1)' }, name: 'Specchio', type: 'visual' },
    { id: 'upsideDown', style: { transform: 'scaleY(-1)' }, name: 'Capovolto', type: 'visual' },
    { id: 'rotate', style: { transform: 'rotate(15deg)' }, name: 'Ruotato', type: 'visual' },
    {
      id: 'trembleVisual',
      name: 'Tremolio (visivo)',
      type: 'visual',
      params: {
        amplitudeRange: { min: 0, max: 2 },         
        durationRange: { min: 800, max: 1600 }, 
        zoomRange: { min: 105, max: 140 },          
        switchIntervalRange: { min: 1500, max: 4000 } 
      }
    },
    {
      id: 'skew',
      name: 'Deformato',
      type: 'visual',
      // parameterized warp effect: Canvas will create SVG displacement filters
      params: {
        // Make skew strong by default; Canvas will create a static SVG displacement filter
        // scaleRange: px displacement magnitude
        scaleRange: { min: 30, max: 120 },
        // baseFreqRange is an integer that Canvas converts to a floating baseFrequency
        baseFreqRange: { min: 8, max: 80 },
        seedRange: { min: 1, max: 3000 },
        // switchInterval kept for backwards-compat but Canvas will create static deformation
        switchIntervalRange: { min: 100000, max: 200000 }
      }
    },

    // Behavior effects (handled in drawing logic)
    { id: 'randomColor', name: 'Colori Casuali', type: 'behavior' },
    { id: 'inputLag', name: 'Input Lag', type: 'behavior', params: { min: 80, max: 260 } },
    // Trembling lines: the artist's stroke points will be perturbed while drawing
    { id: 'tremblingLines', name: 'Linee Tremolanti', type: 'behavior', params: { amplitude: { min: 6, max: 18 }, frequency: { min: 30, max: 160 } } },
    // No drawing feedback: artist's local preview is hidden (they still draw but see nothing)
    { id: 'noPreview', name: 'Nessun Feedback', type: 'behavior', params: { hideLocalPreview: true } }
];

// Helper to pick random integer in inclusive range
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Genera effetti casuali per Chaos Tools
export const generateChaosEffects = () => {
  // Seleziona 1 effetto casuale (un effetto per turno)
  const numEffects = 1;
  const shuffled = [...possibleEffects].sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, numEffects).map(effect => {
    // Clone effect so we can attach resolved params without mutating source
    const e = JSON.parse(JSON.stringify(effect));

      if (e.params) {
        // Resolve numeric ranges into concrete values but preserve the original range
        Object.keys(e.params).forEach(key => {
          const val = e.params[key];
          if (val && typeof val === 'object' && 'min' in val && 'max' in val) {
            // store the original range so drawing logic can choose a fresh random value per point
            e.params[`_${key}Range`] = { min: val.min, max: val.max };
            e.params[key] = randInt(val.min, val.max);
          }
          // boolean/static params remain unchanged
        });
    }

    return e;
  });

  return selected;
};

//FUNZIONE DI DEBUG, TOGLIERE UNA VOLTA FINITO IL CODICE
export const pickChaosEffect = (effectId) => {
  if (!effectId) return generateChaosEffects();

  const found = possibleEffects.find(e => e.id === effectId);
  if (!found) return null;

  const e = JSON.parse(JSON.stringify(found));
  if (e.params) {
    Object.keys(e.params).forEach(key => {
      const val = e.params[key];
      if (val && typeof val === 'object' && 'min' in val && 'max' in val) {
          e.params[`_${key}Range`] = { min: val.min, max: val.max };
          e.params[key] = randInt(val.min, val.max);
      }
    });
  }

  return [e];
};
