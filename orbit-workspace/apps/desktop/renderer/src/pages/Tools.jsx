import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import hubAPI from '../api/hubApi';
import Topbar from '../app/layout/Topbar';
import ToolCard from '../components/ToolCard';
import SearchBar from '../components/SearchBar';
import TagFilter from '../components/TagFilter';
import { useI18n } from '../i18n';

function Tools() {
  const { toolId } = useParams();
  const [tools, setTools] = useState([]);
  const [filteredTools, setFilteredTools] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const { t } = useI18n();

  useEffect(() => {
    loadTools();
  }, []);

  useEffect(() => {
    filterTools();
  }, [tools, searchQuery, selectedTags]);

  async function loadTools() {
    try {
      const toolsList = await hubAPI.tools.list();
      setTools(toolsList || []);

      // Extract unique tags
      const tags = new Set();
      toolsList.forEach((tool) => {
        if (tool.tags) {
          tool.tags.forEach((tag) => tags.add(tag));
        }
      });
      setAllTags(Array.from(tags));
    } catch (error) {
      console.error('Error loading tools:', error);
    }
  }

  function filterTools() {
    let filtered = [...tools];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (tool) =>
          tool.name.toLowerCase().includes(query) ||
          tool.description?.toLowerCase().includes(query) ||
          tool.tags?.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    // Tag filter
    if (selectedTags.length > 0) {
      filtered = filtered.filter((tool) => selectedTags.every((tag) => tool.tags?.includes(tag)));
    }

    setFilteredTools(filtered);
  }

  function handleTagToggle(tag) {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  if (toolId) {
    // Show specific tool page
    return (
      <div className="page">
        <Topbar title={t('common.myTools')} />
        <div className="page-content">
          <p>Tool page for: {toolId}</p>
          <p>Tool UI will be loaded here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <Topbar title={t('common.myTools')} />

      <div className="page-content">
        <div className="tools-header">
          <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder={t('tools.searchPlaceholder')} />
          <TagFilter tags={allTags} selectedTags={selectedTags} onTagToggle={handleTagToggle} />
        </div>

        <div className="tools-grid">
          {filteredTools.map((tool) => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
        </div>

        {filteredTools.length === 0 && (
          <div className="empty-state">
            <p>{t('tools.noToolsFound')}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Tools;
