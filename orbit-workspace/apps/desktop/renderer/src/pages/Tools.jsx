import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Copy,
  FilterX,
  Globe,
  Lock,
  RefreshCw,
  ShieldAlert,
  Tag,
  Wrench,
} from 'lucide-react';
import hubAPI from '../api/hubApi';
import Topbar from '../app/layout/Topbar';
import CustomSelect from '../components/CustomSelect';
import SearchBar from '../components/SearchBar';
import { useI18n } from '../i18n';

const USAGE_STORAGE_KEY = 'orbit.tools.usage.v1';

const KEY_GENERATOR_DEFAULT_CONFIG = {
  mode: 'password',
  passwordLength: 16,
  uppercase: true,
  lowercase: true,
  numbers: true,
  symbols: true,
  excludeSimilar: false,
  noDuplicates: false,
  tokenLength: 48,
  tokenFormat: 'base64url',
  pinLength: 6,
};

function clampInt(value, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return min;
  return Math.max(min, Math.min(max, parsed));
}

function normalizeKeyGeneratorConfig(config) {
  const source = {
    ...KEY_GENERATOR_DEFAULT_CONFIG,
    ...(config && typeof config === 'object' ? config : {}),
  };

  const modeOptions = ['password', 'token', 'pin', 'memorable'];
  const formatOptions = ['hex', 'base64url', 'alphanumeric'];

  return {
    mode: modeOptions.includes(source.mode) ? source.mode : 'password',
    passwordLength: clampInt(source.passwordLength ?? source.length, 8, 30),
    uppercase: source.uppercase !== false,
    lowercase: source.lowercase !== false,
    numbers: source.numbers !== false,
    symbols: source.symbols !== false,
    excludeSimilar: Boolean(source.excludeSimilar),
    noDuplicates: Boolean(source.noDuplicates),
    tokenLength: clampInt(source.tokenLength, 8, 256),
    tokenFormat: formatOptions.includes(source.tokenFormat) ? source.tokenFormat : 'base64url',
    pinLength: clampInt(source.pinLength, 4, 12),
  };
}

function readUsageMap() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(USAGE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeUsageMap(usageMap) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(usageMap));
  } catch {
    // ignore storage failures
  }
}

function formatLastUsed(value, fallback) {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString([], {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function copyText(value) {
  if (!value) return false;

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // fallback below
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

function KeyGeneratorPanel({
  t,
  configLoading,
  keyConfig,
  onUpdateConfig,
  onSaveConfig,
  onGenerate,
  onCopy,
  generatorValue,
  generatorInfo,
  generationError,
  isGenerating,
  isSavingConfig,
  saveState,
  copyState,
}) {
  const modeOptions = [
    { value: 'password', label: t('tools.modePassword') },
    { value: 'token', label: t('tools.modeToken') },
    { value: 'pin', label: t('tools.modePin') },
    { value: 'memorable', label: t('tools.modeMemorable') },
  ];

  return (
    <section className="tools-v2-generator card card-padding-md">
      <div className="tools-v2-generator-top">
        <div>
          <h3>{t('tools.generatorTitle')}</h3>
          <p>{t('tools.generatorSubtitle')}</p>
        </div>

        <div className="tools-v2-generator-top-actions">
          <CustomSelect
            value={keyConfig.mode}
            onChange={(value) => onUpdateConfig({ mode: value })}
            size="sm"
            options={modeOptions}
          />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onSaveConfig}
            disabled={configLoading || isSavingConfig}
          >
            {isSavingConfig ? t('tools.savingConfig') : t('tools.saveConfig')}
          </button>
        </div>
      </div>

      {saveState === 'saved' && <div className="tools-v2-inline-status success">{t('tools.configSaved')}</div>}
      {saveState === 'error' && <div className="tools-v2-inline-status error">{t('tools.configSaveFailed')}</div>}

      <div className="tools-v2-generator-options">
        {keyConfig.mode === 'password' && (
          <div className="tools-v2-password-layout">
            <div className="tools-v2-length-card tools-v2-length-card--compact">
              <div className="tools-v2-length-header">
                <label htmlFor="tools-password-length">{t('tools.passwordLength')}</label>
                <span className="tools-v2-length-value">{keyConfig.passwordLength}</span>
              </div>

              <input
                id="tools-password-length"
                className="tools-v2-length-slider"
                type="range"
                min="8"
                max="30"
                value={keyConfig.passwordLength}
                onChange={(event) => onUpdateConfig({ passwordLength: clampInt(event.target.value, 8, 30) })}
              />

              <div className="tools-v2-length-hints">
                <span>8</span>
                <span>30</span>
              </div>
            </div>

            <div className="tools-v2-toggle-grid">
              {[
                ['uppercase', t('tools.includeUppercase')],
                ['lowercase', t('tools.includeLowercase')],
                ['numbers', t('tools.includeNumbers')],
                ['symbols', t('tools.includeSymbols')],
                ['excludeSimilar', t('tools.excludeSimilar')],
                ['noDuplicates', t('tools.noDuplicates')],
              ].map(([key, label]) => {
                const checked = Boolean(keyConfig[key]);
                return (
                  <label key={key} className={`tools-v2-toggle-card ${checked ? 'active' : ''}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => onUpdateConfig({ [key]: event.target.checked })}
                    />
                    <span className="tools-v2-toggle-box" aria-hidden="true">
                      {checked ? '✓' : ''}
                    </span>
                    <span className="tools-v2-toggle-label">{label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {keyConfig.mode === 'token' && (
          <div className="tools-v2-inline-config-row">
            <div className="tools-v2-length-card tools-v2-length-card--compact">
              <div className="tools-v2-length-header">
                <label htmlFor="tools-token-length">{t('tools.tokenLength')}</label>
                <span className="tools-v2-length-value">{keyConfig.tokenLength}</span>
              </div>

              <input
                id="tools-token-length"
                className="tools-v2-length-slider"
                type="range"
                min="8"
                max="256"
                value={keyConfig.tokenLength}
                onChange={(event) => onUpdateConfig({ tokenLength: clampInt(event.target.value, 8, 256) })}
              />

              <div className="tools-v2-length-hints">
                <span>8</span>
                <span>256</span>
              </div>
            </div>

            <div className="tools-v2-select-card">
              <label>{t('tools.tokenFormat')}</label>
              <CustomSelect
                value={keyConfig.tokenFormat}
                onChange={(value) => onUpdateConfig({ tokenFormat: value })}
                size="sm"
                options={[
                  { value: 'base64url', label: t('tools.formatBase64Url') },
                  { value: 'hex', label: t('tools.formatHex') },
                  { value: 'alphanumeric', label: t('tools.formatAlphaNum') },
                ]}
              />
            </div>
          </div>
        )}

        {keyConfig.mode === 'pin' && (
          <div className="tools-v2-inline-config-row">
            <div className="tools-v2-length-card tools-v2-length-card--compact">
              <div className="tools-v2-length-header">
                <label htmlFor="tools-pin-length">{t('tools.pinLength')}</label>
                <span className="tools-v2-length-value">{keyConfig.pinLength}</span>
              </div>

              <input
                id="tools-pin-length"
                className="tools-v2-length-slider"
                type="range"
                min="4"
                max="12"
                value={keyConfig.pinLength}
                onChange={(event) => onUpdateConfig({ pinLength: clampInt(event.target.value, 4, 12) })}
              />

              <div className="tools-v2-length-hints">
                <span>4</span>
                <span>12</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="tools-v2-generator-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={onGenerate} disabled={isGenerating || configLoading}>
          <RefreshCw size={14} />
          {isGenerating ? t('tools.generating') : t('tools.generate')}
        </button>

        <button type="button" className="btn btn-secondary btn-sm" onClick={onCopy} disabled={!generatorValue}>
          <Copy size={14} />
          {copyState === 'copied'
            ? t('tools.copied')
            : copyState === 'error'
              ? t('tools.copyFailed')
              : t('tools.copy')}
        </button>
      </div>

      <div className="tools-v2-generated-wrap">
        <label>{t('tools.output')}</label>
        <textarea
          value={generatorValue}
          readOnly
          rows={4}
          placeholder={t('tools.outputPlaceholder')}
          className="tools-v2-generated-output"
        />
      </div>

      {generationError && <div className="tools-v2-inline-status error">{generationError}</div>}

      {generatorInfo && (
        <div className="tools-v2-generator-meta">
          <span>{t('tools.length')}: {generatorInfo.length}</span>
          {generatorInfo.strength ? <span>{t('tools.strength')}: {generatorInfo.strength}</span> : null}
          {Number.isFinite(generatorInfo.entropy) ? <span>{t('tools.entropy')}: {generatorInfo.entropy} bits</span> : null}
          {generatorInfo.format ? <span>{t('tools.tokenFormat')}: {generatorInfo.format}</span> : null}
        </div>
      )}
    </section>
  );
}

function Tools() {
  const { toolId } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();

  const [tools, setTools] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [usageMap, setUsageMap] = useState(() => readUsageMap());

  const [toolConfig, setToolConfig] = useState(null);
  const [configLoading, setConfigLoading] = useState(false);

  const [keyConfig, setKeyConfig] = useState(KEY_GENERATOR_DEFAULT_CONFIG);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [saveState, setSaveState] = useState('idle');
  const [copyState, setCopyState] = useState('idle');
  const [generatorValue, setGeneratorValue] = useState('');
  const [generatorInfo, setGeneratorInfo] = useState(null);
  const [generationError, setGenerationError] = useState('');

  useEffect(() => {
    loadTools();
  }, []);

  useEffect(() => {
    if (!toolId) {
      setToolConfig(null);
      setConfigLoading(false);
      return;
    }

    let active = true;
    setConfigLoading(true);

    hubAPI.tools.getConfig(toolId)
      .then((cfg) => {
        if (!active) return;
        setToolConfig(cfg && typeof cfg === 'object' ? cfg : {});
      })
      .catch(() => {
        if (!active) return;
        setToolConfig({});
      })
      .finally(() => {
        if (active) setConfigLoading(false);
      });

    return () => {
      active = false;
    };
  }, [toolId]);

  useEffect(() => {
    if (toolId !== 'password_generator' || configLoading) return;
    setKeyConfig(normalizeKeyGeneratorConfig(toolConfig));
    setSaveState('idle');
    setCopyState('idle');
    setGenerationError('');
    setGeneratorInfo(null);
    setGeneratorValue('');
  }, [toolId, configLoading, toolConfig]);

  async function loadTools() {
    setIsLoading(true);
    try {
      const list = await hubAPI.tools.list();
      setTools(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error('Error loading tools:', error);
      setTools([]);
    } finally {
      setIsLoading(false);
    }
  }

  const allTags = useMemo(() => {
    const tagSet = new Set();
    for (const tool of tools) {
      if (!Array.isArray(tool.tags)) continue;
      for (const tag of tool.tags) tagSet.add(tag);
    }
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
  }, [tools]);

  const enrichedTools = useMemo(() => {
    return tools.map((tool) => {
      const usage = usageMap?.[tool.id] || {};
      return {
        ...tool,
        usageCount: Number(usage.count || 0),
        lastUsedAt: usage.lastUsedAt || null,
        missingCount: Array.isArray(tool.missingPermissions) ? tool.missingPermissions.length : 0,
        isReady: Boolean(tool.accessible && tool.permissionsGranted),
      };
    });
  }, [tools, usageMap]);

  const filteredTools = useMemo(() => {
    let list = [...enrichedTools];

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((tool) => {
        const inName = tool.name?.toLowerCase().includes(q);
        const inDesc = tool.description?.toLowerCase().includes(q);
        const inTags = Array.isArray(tool.tags) && tool.tags.some((tag) => tag.toLowerCase().includes(q));
        return inName || inDesc || inTags;
      });
    }

    if (activeFilter === 'ready') {
      list = list.filter((tool) => tool.isReady);
    } else if (activeFilter === 'locked') {
      list = list.filter((tool) => !tool.isReady);
    } else if (activeFilter === 'internet') {
      list = list.filter((tool) => tool.requiresInternet);
    }

    if (selectedTags.length > 0) {
      list = list.filter((tool) => selectedTags.every((tag) => tool.tags?.includes(tag)));
    }

    list.sort((a, b) => {
      const direction = sortConfig.direction === 'desc' ? -1 : 1;
      let result = 0;

      if (sortConfig.key === 'usage') {
        result = a.usageCount - b.usageCount;
        if (result === 0) {
          const at = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0;
          const bt = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0;
          result = at - bt;
        }
      } else if (sortConfig.key === 'permissions') {
        result = a.missingCount - b.missingCount;
      } else if (sortConfig.key === 'status') {
        result = Number(a.isReady) - Number(b.isReady);
      } else {
        result = String(a.name || '').localeCompare(String(b.name || ''));
      }

      if (result === 0) {
        result = String(a.name || '').localeCompare(String(b.name || ''));
      }

      return result * direction;
    });

    return list;
  }, [enrichedTools, searchQuery, activeFilter, selectedTags, sortConfig]);

  const selectedTool = useMemo(
    () => (toolId ? enrichedTools.find((tool) => tool.id === toolId) : null),
    [toolId, enrichedTools]
  );

  function toggleTag(tag) {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]));
  }

  function resetFilters() {
    setSearchQuery('');
    setSelectedTags([]);
    setActiveFilter('all');
    setSortConfig({ key: 'name', direction: 'asc' });
  }

  function handleOpenTool(tool) {
    const current = readUsageMap();
    const next = {
      ...current,
      [tool.id]: {
        count: Number(current?.[tool.id]?.count || 0) + 1,
        lastUsedAt: new Date().toISOString(),
      },
    };

    writeUsageMap(next);
    setUsageMap(next);
    navigate(`/tools/${tool.id}`);
  }

  function updateKeyConfig(patch) {
    setKeyConfig((prev) => normalizeKeyGeneratorConfig({ ...prev, ...patch }));
    setSaveState('idle');
  }

  async function saveKeyConfig() {
    try {
      setIsSavingConfig(true);
      setSaveState('idle');
      const saved = await hubAPI.tools.setConfig({ toolId: 'password_generator', config: keyConfig });
      if (!saved || saved.error) {
        throw new Error(saved?.error || 'Failed to save config');
      }
      setToolConfig(saved);
      setKeyConfig(normalizeKeyGeneratorConfig(saved));
      setSaveState('saved');
    } catch (error) {
      console.error('Failed to save key generator config:', error);
      setSaveState('error');
    } finally {
      setIsSavingConfig(false);
    }
  }

  async function runKeyGeneration() {
    try {
      setIsGenerating(true);
      setGenerationError('');

      let action = 'generate';
      let payload = {};

      if (keyConfig.mode === 'password') {
        action = 'generate';
        payload = {
          length: keyConfig.passwordLength,
          uppercase: keyConfig.uppercase,
          lowercase: keyConfig.lowercase,
          numbers: keyConfig.numbers,
          symbols: keyConfig.symbols,
          excludeSimilar: keyConfig.excludeSimilar,
          noDuplicates: keyConfig.noDuplicates,
        };
      } else if (keyConfig.mode === 'token') {
        action = 'generateToken';
        payload = {
          length: keyConfig.tokenLength,
          format: keyConfig.tokenFormat,
        };
      } else if (keyConfig.mode === 'pin') {
        action = 'generatePIN';
        payload = {
          length: keyConfig.pinLength,
        };
      } else {
        action = 'generateMemorable';
      }

      const result = await hubAPI.tools.run({
        toolId: 'password_generator',
        action,
        payload,
      });

      if (!result?.success) {
        throw new Error(result?.error || t('tools.generatorErrorDefault'));
      }

      const value = result.password || result.token || '';
      if (!value) {
        throw new Error(t('tools.generatorErrorDefault'));
      }

      setGeneratorValue(value);
      setGeneratorInfo({
        length: value.length,
        strength: result.strength || null,
        entropy: Number.isFinite(result.entropy) ? result.entropy : null,
        format: result.format || null,
      });
      setCopyState('idle');
    } catch (error) {
      console.error('Key generation failed:', error);
      setGenerationError(error?.message || t('tools.generatorErrorDefault'));
    } finally {
      setIsGenerating(false);
    }
  }

  async function copyGeneratedValue() {
    const ok = await copyText(generatorValue);
    setCopyState(ok ? 'copied' : 'error');
    setTimeout(() => setCopyState('idle'), 1800);
  }

  if (toolId) {
    return (
      <div className="page">
        <Topbar title={t('common.myTools')} />

        <div className="page-content">
          <div className="tools-v2-detail-shell">
            <button type="button" className="tools-v2-back" onClick={() => navigate('/tools')}>
              {t('tools.backToList')}
            </button>

            {!selectedTool ? (
              <div className="tools-v2-empty-state">
                <h3>{t('tools.toolNotFoundTitle')}</h3>
                <p>{t('tools.toolNotFoundDesc')}</p>
              </div>
            ) : (
              <>
                <section className="tools-v2-detail-hero">
                  <div className="tools-v2-detail-icon">{selectedTool.icon || '🔧'}</div>
                  <div className="tools-v2-detail-text">
                    <h2>{selectedTool.name}</h2>
                    <p>{selectedTool.description}</p>
                    <div className="tools-v2-detail-badges">
                      <span className={`tools-v2-badge ${selectedTool.isReady ? 'ok' : 'warn'}`}>
                        {selectedTool.isReady ? t('tools.ready') : t('tools.locked')}
                      </span>
                      {selectedTool.requiresInternet && (
                        <span className="tools-v2-badge neutral">{t('tools.requiresInternet')}</span>
                      )}
                      {selectedTool.premium && (
                        <span className="tools-v2-badge premium">Premium</span>
                      )}
                    </div>
                  </div>
                </section>

                {selectedTool.id === 'password_generator' ? (
                  <KeyGeneratorPanel
                    t={t}
                    configLoading={configLoading}
                    keyConfig={keyConfig}
                    onUpdateConfig={updateKeyConfig}
                    onSaveConfig={saveKeyConfig}
                    onGenerate={runKeyGeneration}
                    onCopy={copyGeneratedValue}
                    generatorValue={generatorValue}
                    generatorInfo={generatorInfo}
                    generationError={generationError}
                    isGenerating={isGenerating}
                    isSavingConfig={isSavingConfig}
                    saveState={saveState}
                    copyState={copyState}
                  />
                ) : (
                  <section className="tools-v2-detail-card">
                    <h4>{t('tools.toolComingSoonTitle')}</h4>
                    <p>{t('tools.toolComingSoonDesc')}</p>
                  </section>
                )}

                <section className="tools-v2-detail-footer">
                  <div>
                    <Clock3 size={14} />
                    <span>{t('tools.used')}:</span>
                    <strong>{selectedTool.usageCount}</strong>
                  </div>
                  <div>
                    <Clock3 size={14} />
                    <span>{t('tools.lastUsed')}:</span>
                    <strong>{formatLastUsed(selectedTool.lastUsedAt, t('tools.neverUsed'))}</strong>
                  </div>
                </section>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <Topbar title={t('common.myTools')} />

      <div className="page-content">
        <section className="tools-v2-hero">
          <div>
            <h2>{t('tools.libraryTitle')}</h2>
            <p>{t('tools.librarySubtitle')}</p>
          </div>
          <button type="button" className="tools-v2-refresh" onClick={loadTools} disabled={isLoading}>
            {t('tools.refresh')}
          </button>
        </section>

        <section className="tools-v2-controls">
          <div className="tools-v2-control-main">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder={t('tools.searchPlaceholder')}
            />

            <div className="tools-v2-select-row">
              <CustomSelect
                value={sortConfig.key}
                onChange={(value) => setSortConfig((prev) => ({ ...prev, key: value }))}
                size="sm"
                options={[
                  { value: 'name', label: t('tools.sortName') },
                  { value: 'usage', label: t('tools.sortUsage') },
                  { value: 'permissions', label: t('tools.sortPermissions') },
                  { value: 'status', label: t('tools.sortStatus') },
                ]}
              />

              <CustomSelect
                value={sortConfig.direction}
                onChange={(value) => setSortConfig((prev) => ({ ...prev, direction: value }))}
                size="sm"
                options={[
                  { value: 'asc', label: t('tools.sortAsc') },
                  { value: 'desc', label: t('tools.sortDesc') },
                ]}
              />

              <button type="button" className="tools-v2-reset" onClick={resetFilters}>
                <FilterX size={14} />
                {t('tools.resetFilters')}
              </button>
            </div>
          </div>

          <div className="tools-v2-filter-row">
            <div className="tools-v2-segments">
              {[
                { id: 'all', label: t('tools.filterAll') },
                { id: 'ready', label: t('tools.filterReady') },
                { id: 'locked', label: t('tools.filterLocked') },
                { id: 'internet', label: t('tools.filterInternet') },
              ].map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  className={`tools-v2-segment ${activeFilter === filter.id ? 'active' : ''}`}
                  onClick={() => setActiveFilter(filter.id)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {allTags.length > 0 && (
            <div className="tools-v2-tags">
              {allTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={`tools-v2-tag ${selectedTags.includes(tag) ? 'active' : ''}`}
                  onClick={() => toggleTag(tag)}
                >
                  <Tag size={11} />
                  {tag}
                </button>
              ))}
            </div>
          )}
        </section>

        {isLoading ? (
          <div className="tools-v2-empty-state">
            <p>{t('common.loading')}</p>
          </div>
        ) : filteredTools.length === 0 ? (
          <div className="tools-v2-empty-state">
            <h3>{t('tools.noToolsFoundTitle')}</h3>
            <p>{t('tools.noToolsFoundDesc')}</p>
            <button type="button" className="tools-v2-reset" onClick={resetFilters}>
              <FilterX size={14} />
              {t('tools.resetFilters')}
            </button>
          </div>
        ) : (
          <section className="tools-v2-grid">
            {filteredTools.map((tool) => {
              const missingPermissions = Array.isArray(tool.missingPermissions) ? tool.missingPermissions : [];

              return (
                <article key={tool.id} className={`tools-v2-card ${tool.isReady ? 'ready' : 'locked'}`}>
                  <header className="tools-v2-card-header">
                    <div className="tools-v2-card-icon">{tool.icon || '🔧'}</div>
                    <div className="tools-v2-card-title-wrap">
                      <h3>{tool.name}</h3>
                      <span>{tool.version || 'v1.0.0'}</span>
                    </div>
                    {tool.isReady ? <CheckCircle2 size={16} className="state ready" /> : <Lock size={16} className="state locked" />}
                  </header>

                  <p className="tools-v2-card-desc">{tool.description}</p>

                  <div className="tools-v2-card-meta">
                    <span>
                      <Wrench size={13} />
                      {t('tools.used')}: {tool.usageCount}
                    </span>
                    <span>
                      <Clock3 size={13} />
                      {formatLastUsed(tool.lastUsedAt, t('tools.neverUsed'))}
                    </span>
                    {tool.requiresInternet && (
                      <span>
                        <Globe size={13} />
                        {t('tools.requiresInternet')}
                      </span>
                    )}
                  </div>

                  {Array.isArray(tool.tags) && tool.tags.length > 0 && (
                    <div className="tools-v2-card-tags">
                      {tool.tags.slice(0, 4).map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                  )}

                  {!tool.permissionsGranted && missingPermissions.length > 0 && (
                    <div className="tools-v2-warning">
                      <ShieldAlert size={14} />
                      <span>{t('tools.missingPermissions')}: {missingPermissions.join(', ')}</span>
                    </div>
                  )}

                  <footer className="tools-v2-card-footer">
                    <button type="button" className="tools-v2-open" onClick={() => handleOpenTool(tool)}>
                      {t('tools.open')}
                      <ArrowRight size={14} />
                    </button>
                  </footer>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
}

export default Tools;