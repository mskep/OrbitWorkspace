import React from 'react';
import { useNavigate } from 'react-router-dom';

function ToolCard({ tool }) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (tool.accessible && tool.permissionsGranted) {
      navigate(`/tools/${tool.id}`);
    }
  };

  const isLocked = !tool.accessible || !tool.permissionsGranted;

  return (
    <div
      className={`tool-card ${isLocked ? 'locked' : ''}`}
      onClick={handleClick}
      style={{ cursor: isLocked ? 'not-allowed' : 'pointer' }}
    >
      <div className="tool-card-header">
        <div className="tool-icon">{tool.icon || '🔧'}</div>
        {tool.premium && !tool.accessible && (
          <div className="premium-badge">Premium</div>
        )}
        {isLocked && <div className="lock-icon">🔒</div>}
      </div>

      <h3 className="tool-name">{tool.name}</h3>
      <p className="tool-description">{tool.description}</p>

      {tool.tags && tool.tags.length > 0 && (
        <div className="tool-tags">
          {tool.tags.map((tag) => (
            <span key={tag} className="tool-tag">
              {tag}
            </span>
          ))}
        </div>
      )}

      {!tool.permissionsGranted && (
        <div className="tool-warning">
          Missing permissions: {tool.missingPermissions?.join(', ')}
        </div>
      )}

      {tool.premium && !tool.accessible && (
        <button className="btn-upgrade" onClick={(e) => e.stopPropagation()}>
          Upgrade to Premium
        </button>
      )}
    </div>
  );
}

export default ToolCard;
