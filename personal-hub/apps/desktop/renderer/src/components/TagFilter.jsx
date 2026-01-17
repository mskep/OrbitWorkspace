import React from 'react';

function TagFilter({ tags, selectedTags, onTagToggle }) {
  if (tags.length === 0) {
    return null;
  }

  return (
    <div className="tag-filter">
      {tags.map((tag) => (
        <button
          key={tag}
          className={`tag-chip ${selectedTags.includes(tag) ? 'active' : ''}`}
          onClick={() => onTagToggle(tag)}
        >
          {tag}
        </button>
      ))}
    </div>
  );
}

export default TagFilter;
