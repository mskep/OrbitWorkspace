/**
 * Color Picker Service
 * Simple color extraction from image
 */

const fs = require('fs');
const path = require('path');

/**
 * Extract dominant colors from image (simplified version)
 */
async function extractPalette({ imagePath, colorCount = 9 }) {
  try {
    // Simple color extraction - you can enhance with canvas/image libraries
    // For now, return predefined palette as example

    const colors = generateColorPalette(colorCount);

    return {
      success: true,
      colors
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Generate a color palette (placeholder)
 */
function generateColorPalette(count) {
  // Generate harmonious colors
  const baseHue = Math.floor(Math.random() * 360);
  const colors = [];

  for (let i = 0; i < count; i++) {
    const hue = (baseHue + (i * 360 / count)) % 360;
    const saturation = 60 + Math.random() * 30;
    const lightness = 45 + Math.random() * 20;

    const hex = hslToHex(hue, saturation, lightness);
    colors.push(hex);
  }

  return colors;
}

/**
 * Convert HSL to HEX
 */
function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;

  let r = 0, g = 0, b = 0;

  if (0 <= h && h < 60) {
    r = c; g = x; b = 0;
  } else if (60 <= h && h < 120) {
    r = x; g = c; b = 0;
  } else if (120 <= h && h < 180) {
    r = 0; g = c; b = x;
  } else if (180 <= h && h < 240) {
    r = 0; g = x; b = c;
  } else if (240 <= h && h < 300) {
    r = x; g = 0; b = c;
  } else if (300 <= h && h < 360) {
    r = c; g = 0; b = x;
  }

  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);

  return rgbToHex(r, g, b);
}

/**
 * Convert RGB to HEX
 */
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * Convert HEX to RGB
 */
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

/**
 * Convert RGB to HSL
 */
function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

/**
 * Get color formats
 */
function getColorFormats({ hex }) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;

  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  return {
    success: true,
    formats: {
      hex,
      rgb: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
      hsl: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`,
      cmyk: rgbToCmyk(rgb.r, rgb.g, rgb.b)
    }
  };
}

/**
 * Convert RGB to CMYK
 */
function rgbToCmyk(r, g, b) {
  let c = 1 - (r / 255);
  let m = 1 - (g / 255);
  let y = 1 - (b / 255);
  let k = Math.min(c, m, y);

  c = ((c - k) / (1 - k)) || 0;
  m = ((m - k) / (1 - k)) || 0;
  y = ((y - k) / (1 - k)) || 0;

  return `cmyk(${Math.round(c * 100)}, ${Math.round(m * 100)}, ${Math.round(y * 100)}, ${Math.round(k * 100)})`;
}

module.exports = {
  extractPalette,
  getColorFormats
};
