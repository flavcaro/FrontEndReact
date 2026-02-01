import clickSound from '../sounds/PIZZA TOWER Taunt Sound Effect.mp3';
import backgroundMusic from '../sounds/ClascyJitto - Leaning Dream [OST Version] (Pizza Tower OST).mp3';

// Web Audio API for lowest latency
let audioContext = null;
let audioBuffer = null;
let isInitialized = false;

// Background music management
let backgroundMusicAudio = null;
let isMusicPlaying = false;

// Sound settings stored in localStorage
const SETTINGS_KEY = 'sketchup_sound_settings';

// Get sound settings from localStorage
export const getSoundSettings = () => {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (err) {
    console.error('Failed to load sound settings:', err);
  }
  // Default settings
  return {
    soundEffects: false,
    music: false,
    effectsVolume: 0.3,
    musicVolume: 0.15
  };
};

// Save sound settings to localStorage
export const setSoundSettings = (settings) => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save sound settings:', err);
  }
};

// Initialize audio context and load sound
export const initAudio = async () => {
  if (isInitialized) return;
  
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  
  if (!audioBuffer) {
    try {
      const response = await fetch(clickSound);
      const arrayBuffer = await response.arrayBuffer();
      audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      isInitialized = true;
    } catch (err) {
      console.error('Failed to load audio:', err);
    }
  }
};

// Play sound instantly using Web Audio API
export const playClickSound = () => {
  // Check if sound effects are enabled
  const settings = getSoundSettings();
  if (!settings.soundEffects) {
    return;
  }

  if (audioContext && audioBuffer) {
    const source = audioContext.createBufferSource();
    const gainNode = audioContext.createGain();
    
    source.buffer = audioBuffer;
    gainNode.gain.value = settings.effectsVolume || 0.3;
    
    source.connect(gainNode);
    gainNode.connect(audioContext.destination);
    source.start(0);
  }
};

// Setup global click listener for all buttons
export const setupGlobalButtonSound = () => {
  // Pre-load audio
  initAudio();
  
  // Add global click listener
  document.addEventListener('click', (e) => {
    // Check if clicked element is a button or inside a button
    const button = e.target.closest('button');
    if (button && !button.disabled) {
      playClickSound();
    }
  }, true); // Use capture phase for earliest detection
};

// Play background music
export const playBackgroundMusic = () => {
  const settings = getSoundSettings();
  if (!settings.music) {
    return;
  }

  if (!backgroundMusicAudio) {
    backgroundMusicAudio = new Audio(backgroundMusic);
    backgroundMusicAudio.loop = true;
    backgroundMusicAudio.volume = settings.musicVolume || 0.15;
  } else {
    // Update volume if settings changed
    backgroundMusicAudio.volume = settings.musicVolume || 0.15;
  }

  if (!isMusicPlaying) {
    backgroundMusicAudio.play().catch(err => {
      console.log('Background music autoplay prevented:', err);
    });
    isMusicPlaying = true;
  }
};

// Stop background music
export const stopBackgroundMusic = () => {
  if (backgroundMusicAudio && isMusicPlaying) {
    backgroundMusicAudio.pause();
    backgroundMusicAudio.currentTime = 0;
    isMusicPlaying = false;
  }
};

// Pause background music (without resetting)
export const pauseBackgroundMusic = () => {
  if (backgroundMusicAudio && isMusicPlaying) {
    backgroundMusicAudio.pause();
    isMusicPlaying = false;
  }
};

// Resume background music
export const resumeBackgroundMusic = () => {
  const settings = getSoundSettings();
  if (!settings.music || !backgroundMusicAudio) {
    return;
  }

  if (!isMusicPlaying) {
    backgroundMusicAudio.play().catch(err => {
      console.log('Failed to resume music:', err);
    });
    isMusicPlaying = true;
  }
};

// Check if music is currently playing
export const isMusicCurrentlyPlaying = () => isMusicPlaying;

// Update music volume in real-time
export const setMusicVolume = (volume) => {
  if (backgroundMusicAudio) {
    backgroundMusicAudio.volume = Math.max(0, Math.min(1, volume));
  }
};
