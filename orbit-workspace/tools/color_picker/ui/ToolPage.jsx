import React, { useState } from 'react';
import { Upload, Copy, Download, Palette } from 'lucide-react';
import Topbar from '../../../app/layout/Topbar';

function ColorPickerPage() {
  const [colors, setColors] = useState([]);
  const [selectedColor, setSelectedColor] = useState(null);
  const [colorFormats, setColorFormats] = useState(null);
  const [paletteSize, setPaletteSize] = useState(9);
  const [copied, setCopied] = useState(false);

  const handleImageUpload = async () => {
    try {
      const filePath = await window.hubAPI.fs.pickFile({
        filters: [
          { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }
        ]
      });

      if (!filePath) return;

      const result = await window.hubAPI.tools.run({
        toolId: 'color_picker',
        action: 'extractPalette',
        payload: { imagePath: filePath, colorCount: paletteSize }
      });

      if (result.success) {
        setColors(result.colors);
        if (result.colors.length > 0) {
          selectColor(result.colors[0]);
        }
      }
    } catch (error) {
      console.error('Failed to extract palette:', error);
    }
  };

  const selectColor = async (hex) => {
    setSelectedColor(hex);

    const result = await window.hubAPI.tools.run({
      toolId: 'color_picker',
      action: 'getColorFormats',
      payload: { hex }
    });

    if (result.success) {
      setColorFormats(result.formats);
    }
  };

  const copyFormat = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <div className="page">
      <Topbar title="Color Picker & Palette" />

      <div className="page-content">
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          {/* Upload Section */}
          <div className="card" style={{ padding: '32px', marginBottom: '24px', textAlign: 'center' }}>
            <div
              style={{
                padding: '60px',
                border: '2px dashed var(--border-default)',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: 'var(--bg-tertiary)',
                marginBottom: '24px',
                cursor: 'pointer',
                transition: 'all var(--transition-default)'
              }}
              onClick={handleImageUpload}
            >
              <Upload size={48} style={{ color: 'var(--accent-primary)', marginBottom: '16px' }} />
              <h3 style={{ marginBottom: '8px' }}>Drop Image Here or Click</h3>
              <p style={{ color: 'var(--text-tertiary)', fontSize: '14px' }}>
                Supports: PNG, JPG, WEBP
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'center' }}>
              <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                Number of colors:
              </label>
              <input
                type="range"
                min="3"
                max="20"
                value={paletteSize}
                onChange={(e) => setPaletteSize(parseInt(e.target.value))}
                style={{ width: '200px' }}
              />
              <span style={{ fontSize: '14px', fontWeight: '600', minWidth: '30px' }}>
                {paletteSize}
              </span>
            </div>
          </div>

          {/* Palette */}
          {colors.length > 0 && (
            <div className="card" style={{ padding: '32px', marginBottom: '24px' }}>
              <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Palette size={20} />
                Extracted Palette
              </h3>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))',
                gap: '12px',
                marginBottom: '24px'
              }}>
                {colors.map((color, index) => (
                  <div
                    key={index}
                    onClick={() => selectColor(color)}
                    style={{
                      aspectRatio: '1',
                      backgroundColor: color,
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      border: selectedColor === color ? '3px solid var(--accent-primary)' : '1px solid var(--border-default)',
                      boxShadow: selectedColor === color ? 'var(--shadow-glow)' : 'none',
                      transition: 'all var(--transition-fast)',
                      display: 'flex',
                      alignItems: 'flex-end',
                      justifyContent: 'center',
                      padding: '8px'
                    }}
                  >
                    <span style={{
                      fontSize: '11px',
                      fontWeight: '600',
                      color: '#fff',
                      textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                      fontFamily: 'monospace'
                    }}>
                      {color}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Color Details */}
          {selectedColor && colorFormats && (
            <div className="card" style={{ padding: '32px' }}>
              <h3 style={{ marginBottom: '20px' }}>Color Details</h3>

              <div style={{
                width: '100%',
                height: '100px',
                backgroundColor: selectedColor,
                borderRadius: 'var(--radius-lg)',
                marginBottom: '24px',
                border: '1px solid var(--border-default)'
              }}></div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  { label: 'HEX', value: colorFormats.hex },
                  { label: 'RGB', value: colorFormats.rgb },
                  { label: 'HSL', value: colorFormats.hsl },
                  { label: 'CMYK', value: colorFormats.cmyk }
                ].map((format) => (
                  <div
                    key={format.label}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      backgroundColor: 'var(--bg-tertiary)',
                      borderRadius: 'var(--radius-md)'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>
                        {format.label}
                      </div>
                      <div style={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: '600' }}>
                        {format.value}
                      </div>
                    </div>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => copyFormat(format.value)}
                    >
                      <Copy size={14} />
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ColorPickerPage;
