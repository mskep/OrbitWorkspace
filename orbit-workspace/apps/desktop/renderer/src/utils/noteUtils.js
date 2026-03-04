/**
 * Detect if stored content is JSON blocks or legacy markdown.
 */
export function isJsonContent(content) {
  if (!content || !content.trim()) return false;
  const trimmed = content.trim();
  return trimmed.startsWith('[') && trimmed.endsWith(']');
}

/**
 * Extract plain text from BlockNote JSON for sidebar preview.
 */
export function extractPlainText(content) {
  if (!content) return '';
  if (!isJsonContent(content)) return content;
  try {
    const blocks = JSON.parse(content);
    const texts = [];
    const walk = (blockList) => {
      for (const block of blockList) {
        if (block.content) {
          if (Array.isArray(block.content)) {
            for (const inline of block.content) {
              if (typeof inline === 'string') texts.push(inline);
              else if (inline.text) texts.push(inline.text);
            }
          } else if (typeof block.content === 'string') {
            texts.push(block.content);
          }
        }
        if (block.children && block.children.length) walk(block.children);
      }
    };
    walk(blocks);
    return texts.join(' ').trim() || '';
  } catch {
    return content;
  }
}
