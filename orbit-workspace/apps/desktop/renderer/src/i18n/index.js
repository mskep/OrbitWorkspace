import { useMemo } from 'react';
import { useAppStore } from '../state/store';
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, translations } from './translations';

function resolvePath(obj, path) {
  return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj);
}

function interpolate(template, vars = {}) {
  if (typeof template !== 'string') return template;
  return template.replace(/\{(\w+)\}/g, (_m, key) => (vars[key] !== undefined ? String(vars[key]) : `{${key}}`));
}

export function getSafeLanguage(language) {
  if (typeof language !== 'string') return DEFAULT_LANGUAGE;

  const normalized = language.trim().toLowerCase().replace('_', '-');
  if (SUPPORTED_LANGUAGES.includes(normalized)) return normalized;

  if (normalized.startsWith('fr') || normalized === 'french' || normalized === 'francais' || normalized === 'français') {
    return 'fr';
  }

  if (normalized.startsWith('en') || normalized === 'english' || normalized === 'anglais') {
    return 'en';
  }

  return DEFAULT_LANGUAGE;
}

export function t(key, language = DEFAULT_LANGUAGE, vars = {}) {
  const lang = getSafeLanguage(language);
  const activeValue = resolvePath(translations[lang], key);
  const fallbackValue = resolvePath(translations[DEFAULT_LANGUAGE], key);
  const value = activeValue ?? fallbackValue ?? key;
  return interpolate(value, vars);
}

export function useI18n() {
  const language = useAppStore((state) => state.userSettings?.language || DEFAULT_LANGUAGE);
  const safeLanguage = getSafeLanguage(language);

  const translate = useMemo(() => {
    return (key, vars = {}) => t(key, safeLanguage, vars);
  }, [safeLanguage]);

  return { t: translate, language: safeLanguage };
}
