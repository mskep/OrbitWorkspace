/**
 * Key Generator Service (passwords, tokens, pins)
 */

const crypto = require('crypto');

const CHAR_SETS = {
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?'
};

const SIMILAR_CHARS = 'il1Lo0O';
const ALPHANUMERIC = `${CHAR_SETS.uppercase}${CHAR_SETS.lowercase}${CHAR_SETS.numbers}`;

function clampInt(value, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return min;
  return Math.max(min, Math.min(max, parsed));
}

function randomInt(max) {
  return crypto.randomInt(0, max);
}

function randomChar(chars) {
  return chars[randomInt(chars.length)];
}

function secureShuffle(items) {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function buildSelectedSets({ uppercase, lowercase, numbers, symbols, excludeSimilar }) {
  const sets = [];

  if (uppercase) sets.push(CHAR_SETS.uppercase);
  if (lowercase) sets.push(CHAR_SETS.lowercase);
  if (numbers) sets.push(CHAR_SETS.numbers);
  if (symbols) sets.push(CHAR_SETS.symbols);

  if (excludeSimilar) {
    return sets
      .map((set) => set.split('').filter((char) => !SIMILAR_CHARS.includes(char)).join(''))
      .filter((set) => set.length > 0);
  }

  return sets;
}

/**
 * Generate password
 */
function generate(options = {}) {
  try {
    const length = clampInt(options.length ?? options.passwordLength, 8, 30);
    const uppercase = options.uppercase !== false;
    const lowercase = options.lowercase !== false;
    const numbers = options.numbers !== false;
    const symbols = options.symbols !== false;
    const excludeSimilar = Boolean(options.excludeSimilar);
    const noDuplicates = Boolean(options.noDuplicates);

    const selectedSets = buildSelectedSets({ uppercase, lowercase, numbers, symbols, excludeSimilar });
    if (selectedSets.length === 0) {
      throw new Error('At least one character type must be selected');
    }

    const fullSet = selectedSets.join('');
    if (noDuplicates && length > fullSet.length) {
      throw new Error('Length is too high when duplicate characters are disabled');
    }

    if (length < selectedSets.length) {
      throw new Error('Length must be >= number of enabled character groups');
    }

    const chars = [];
    const used = new Set();

    // Ensure at least one char from each selected group.
    for (const set of selectedSets) {
      let chosen = randomChar(set);
      if (noDuplicates) {
        let attempts = 0;
        while (used.has(chosen) && attempts < 64) {
          chosen = randomChar(set);
          attempts += 1;
        }
        if (used.has(chosen)) {
          throw new Error('Cannot satisfy no-duplicate constraints with current options');
        }
        used.add(chosen);
      }
      chars.push(chosen);
    }

    while (chars.length < length) {
      const next = randomChar(fullSet);
      if (noDuplicates && used.has(next)) continue;
      chars.push(next);
      if (noDuplicates) used.add(next);
    }

    const password = secureShuffle(chars).join('');
    const strength = calculateStrength(password);

    return {
      success: true,
      password,
      strength: strength.label,
      entropy: strength.entropy
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Generate token / API key
 */
function generateToken(options = {}) {
  try {
    const length = clampInt(options.length, 8, 256);
    const format = ['hex', 'base64url', 'alphanumeric'].includes(options.format)
      ? options.format
      : 'base64url';

    let token = '';

    if (format === 'hex') {
      const bytes = crypto.randomBytes(Math.ceil(length / 2));
      token = bytes.toString('hex').slice(0, length);
    } else if (format === 'alphanumeric') {
      const output = [];
      for (let i = 0; i < length; i += 1) {
        output.push(randomChar(ALPHANUMERIC));
      }
      token = output.join('');
    } else {
      const bytes = crypto.randomBytes(Math.ceil((length * 3) / 4) + 2);
      token = bytes
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '')
        .slice(0, length);
    }

    return {
      success: true,
      token,
      format,
      length
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Calculate password strength
 */
function calculateStrength(password) {
  const length = password.length;

  // Calculate character set size
  let charsetSize = 0;
  if (/[a-z]/.test(password)) charsetSize += 26;
  if (/[A-Z]/.test(password)) charsetSize += 26;
  if (/[0-9]/.test(password)) charsetSize += 10;
  if (/[^a-zA-Z0-9]/.test(password)) charsetSize += 32;

  // Entropy = log2(charsetSize^length)
  const entropy = Math.round(length * Math.log2(Math.max(charsetSize, 1)));

  // Determine strength label
  let label = 'weak';
  if (entropy >= 80) label = 'very strong';
  else if (entropy >= 60) label = 'strong';
  else if (entropy >= 40) label = 'medium';

  return { entropy, label };
}

/**
 * Generate PIN
 */
function generatePIN(options = {}) {
  return generate({
    length: clampInt(options.length ?? options.pinLength, 4, 12),
    uppercase: false,
    lowercase: false,
    numbers: true,
    symbols: false,
    excludeSimilar: false,
    noDuplicates: false
  });
}

/**
 * Generate memorable password
 */
function generateMemorable() {
  const words = [
    'Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot',
    'Golf', 'Hotel', 'India', 'Juliet', 'Kilo', 'Lima',
    'Mike', 'November', 'Oscar', 'Papa', 'Quebec', 'Romeo',
    'Sierra', 'Tango', 'Uniform', 'Victor', 'Whiskey', 'Xray',
    'Yankee', 'Zulu'
  ];

  const word1 = words[randomInt(words.length)];
  const word2 = words[randomInt(words.length)];
  const number = randomInt(100);

  const password = `${word1}${word2}${number}`;

  return {
    success: true,
    password,
    strength: 'medium',
    entropy: 48
  };
}

module.exports = {
  generate,
  generateToken,
  generatePIN,
  generateMemorable,
  calculateStrength
};