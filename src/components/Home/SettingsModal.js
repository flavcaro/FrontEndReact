import React, { useState, useEffect } from 'react';
import Button from '../common/Button';
import { getSoundSettings, setSoundSettings, pauseBackgroundMusic, resumeBackgroundMusic, setMusicVolume } from '../../utils/audioUtils';
import '../../styles/settings-modal.css';

export default function SettingsModal({ onClose }) {
  const [settings, setSettings] = useState({
    soundEffects: true,
    music: true,
    effectsVolume: 0.3,
    musicVolume: 0.15
  });

  useEffect(() => {
    // Load settings from localStorage
    const savedSettings = getSoundSettings();
    setSettings(savedSettings);
  }, []);

  const handleToggle = (key) => {
    const newSettings = {
      ...settings,
      [key]: !settings[key]
    };
    setSettings(newSettings);
    setSoundSettings(newSettings);

    // Control background music in real-time
    if (key === 'music') {
      if (newSettings.music) {
        resumeBackgroundMusic();
      } else {
        pauseBackgroundMusic();
      }
    }
  };

  const handleVolumeChange = (key, value) => {
    const volume = parseFloat(value);
    const newSettings = {
      ...settings,
      [key]: volume
    };
    setSettings(newSettings);
    setSoundSettings(newSettings);

    // Update music volume in real-time
    if (key === 'musicVolume') {
      setMusicVolume(volume);
    }
  };

  return (
    <>
      <div className="settings-backdrop" onClick={onClose}></div>
      <div className="settings-card">
        <div className="settings-header">
          <h2>⚙️ Impostazioni Audio</h2>
          <button className="settings-close" onClick={onClose}>✕</button>
        </div>
        
        <div className="settings-body">
          <div className="setting-item">
            <div className="setting-info">
              <h3>🔊 Effetti Sonori</h3>
              <p>Suoni di clic dei pulsanti e feedback audio</p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.soundEffects}
                onChange={() => handleToggle('soundEffects')}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
          
          {settings.soundEffects && (
            <div className="setting-item volume-setting">
              <div className="setting-info">
                <h3>🔉 Volume Effetti</h3>
                <p>{Math.round(settings.effectsVolume * 100)}%</p>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.effectsVolume}
                onChange={(e) => handleVolumeChange('effectsVolume', e.target.value)}
                className="volume-slider"
              />
            </div>
          )}

          <div className="setting-item">
            <div className="setting-info">
              <h3>🎵 Musica di Sottofondo</h3>
              <p>Musica durante la home page</p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.music}
                onChange={() => handleToggle('music')}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
          
          {settings.music && (
            <div className="setting-item volume-setting">
              <div className="setting-info">
                <h3>🔉 Volume Musica</h3>
                <p>{Math.round(settings.musicVolume * 100)}%</p>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.musicVolume}
                onChange={(e) => handleVolumeChange('musicVolume', e.target.value)}
                className="volume-slider"
              />
            </div>
          )}
        </div>

        <div className="settings-footer">
          <Button onClick={onClose} variant="primary">
            Chiudi
          </Button>
        </div>
      </div>
    </>
  );
}
