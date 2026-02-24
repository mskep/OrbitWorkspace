function validateToolManifest(manifest) {
  const required = ['id', 'name', 'version', 'description'];

  for (const field of required) {
    if (!manifest[field]) {
      return { valid: false, error: `Missing required field: ${field}` };
    }
  }

  if (manifest.permissions && !Array.isArray(manifest.permissions)) {
    return { valid: false, error: 'permissions must be an array' };
  }

  return { valid: true };
}

function validateConfig(config) {
  if (typeof config !== 'object' || config === null) {
    return { valid: false, error: 'Config must be an object' };
  }
  return { valid: true };
}

function sanitizePath(filepath) {
  // Basic path sanitization to prevent directory traversal
  return filepath.replace(/\.\./g, '');
}

module.exports = {
  validateToolManifest,
  validateConfig,
  sanitizePath
};
