import React, { useState, useEffect } from 'react';

function YouTubeDownloaderSettings() {
  const [config, setConfig] = useState({
    downloadPath: '',
    format: 'best',
    audioOnly: false
  });

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    try {
      const data = await window.hubAPI.tools.getConfig('youtube_downloader');
      if (data) {
        setConfig(data);
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
  }

  async function handleSave() {
    try {
      await window.hubAPI.tools.setConfig({
        toolId: 'youtube_downloader',
        config
      });
      alert('Settings saved!');
    } catch (error) {
      alert('Error saving settings: ' + error.message);
    }
  }

  async function handlePickFolder() {
    try {
      const folder = await window.hubAPI.fs.pickFolder();
      if (folder) {
        setConfig({ ...config, downloadPath: folder });
      }
    } catch (error) {
      console.error('Error picking folder:', error);
    }
  }

  return (
    <div style={{ padding: '20px' }}>
      <h3>YouTube Downloader Settings</h3>

      <div style={{ marginTop: '20px' }}>
        <label>
          Download Path:
          <div style={{ display: 'flex', marginTop: '5px' }}>
            <input
              type="text"
              value={config.downloadPath}
              onChange={(e) => setConfig({ ...config, downloadPath: e.target.value })}
              style={{ flex: 1, padding: '8px' }}
            />
            <button onClick={handlePickFolder} style={{ marginLeft: '10px', padding: '8px' }}>
              Browse
            </button>
          </div>
        </label>
      </div>

      <div style={{ marginTop: '15px' }}>
        <label>
          Format:
          <select
            value={config.format}
            onChange={(e) => setConfig({ ...config, format: e.target.value })}
            style={{ display: 'block', marginTop: '5px', padding: '8px' }}
          >
            <option value="best">Best Quality</option>
            <option value="mp4">MP4</option>
            <option value="webm">WebM</option>
          </select>
        </label>
      </div>

      <div style={{ marginTop: '15px' }}>
        <label>
          <input
            type="checkbox"
            checked={config.audioOnly}
            onChange={(e) => setConfig({ ...config, audioOnly: e.target.checked })}
          />
          Audio Only
        </label>
      </div>

      <button onClick={handleSave} style={{ marginTop: '20px', padding: '10px 20px' }}>
        Save Settings
      </button>
    </div>
  );
}

export default YouTubeDownloaderSettings;
