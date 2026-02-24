/**
 * Password Generator Service
 */

const CHAR_SETS = {
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?'
};

const SIMILAR_CHARS = 'il1Lo0O';

/**
 * Generate password
 */
function generate(options) {
  try {
    const {
      length = 16,
      uppercase = true,
      lowercase = true,
      numbers = true,
      symbols = true,
      excludeSimilar = false,
      noDuplicates = false
    } = options;

    // Build character set
    let chars = '';
    if (uppercase) chars += CHAR_SETS.uppercase;
    if (lowercase) chars += CHAR_SETS.lowercase;
    if (numbers) chars += CHAR_SETS.numbers;
    if (symbols) chars += CHAR_SETS.symbols;

    if (excludeSimilar) {
      chars = chars.split('').filter(c => !SIMILAR_CHARS.includes(c)).join('');
    }

    if (chars.length === 0) {
      throw new Error('At least one character type must be selected');
    }

    // Generate password
    let password = '';
    const usedChars = new Set();

    while (password.length < length) {
      const randomIndex = Math.floor(Math.random() * chars.length);
      const char = chars[randomIndex];

      if (noDuplicates && usedChars.has(char)) {
        continue;
      }

      password += char;
      if (noDuplicates) {
        usedChars.add(char);
      }
    }

    // Calculate strength
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
 * Calculate password strength
 */
function calculateStrength(password) {
  let entropy = 0;
  const length = password.length;

  // Calculate character set size
  let charsetSize = 0;
  if (/[a-z]/.test(password)) charsetSize += 26;
  if (/[A-Z]/.test(password)) charsetSize += 26;
  if (/[0-9]/.test(password)) charsetSize += 10;
  if (/[^a-zA-Z0-9]/.test(password)) charsetSize += 32;

  // Entropy = log2(charsetSize^length)
  entropy = length * Math.log2(charsetSize);

  // Determine strength label
  let label = 'weak';
  if (entropy >= 80) label = 'very strong';
  else if (entropy >= 60) label = 'strong';
  else if (entropy >= 40) label = 'medium';

  return { entropy: Math.round(entropy), label };
}

/**
 * Generate PIN
 */
function generatePIN(options) {
  return generate({
    length: options.length || 4,
    uppercase: false,
    lowercase: false,
    numbers: true,
    symbols: false
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

  const word1 = words[Math.floor(Math.random() * words.length)];
  const word2 = words[Math.floor(Math.random() * words.length)];
  const number = Math.floor(Math.random() * 100);

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
  generatePIN,
  generateMemorable,
  calculateStrength
};
