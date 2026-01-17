import React, { useState } from 'react';

function YouTubeDownloaderPage() {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    if (!url) {
      setStatus('Please enter a URL');
      return;
    }

    setLoading(true);
    setStatus('Downloading...');

    try {
      // Call the tool API
      const result = await window.hubAPI.tools.run({
        toolId: 'youtube_downloader',
        action: 'download',
        payload: { url }
      });

      if (result.success) {
        setStatus('Download completed!');
      } else {
        setStatus(`Error: ${result.error}`);
      }
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>YouTube Downloader</h2>
      <p>Download YouTube videos in the best quality</p>

      <div style={{ marginTop: '20px' }}>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter YouTube URL"
          style={{ width: '100%', padding: '10px', marginBottom: '10px' }}
          disabled={loading}
        />

        <button
          onClick={handleDownload}
          disabled={loading}
          style={{ padding: '10px 20px' }}
        >
          {loading ? 'Downloading...' : 'Download'}
        </button>

        {status && (
          <div style={{ marginTop: '10px', padding: '10px', background: '#2d2d2d' }}>
            {status}
          </div>
        )}
      </div>

      <div style={{ marginTop: '20px', fontSize: '0.9em', color: '#808080' }}>
        Note: This is a placeholder implementation. In production, you would integrate yt-dlp or similar.
      </div>
    </div>
  );
}

export default YouTubeDownloaderPage;
