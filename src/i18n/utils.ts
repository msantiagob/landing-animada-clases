import { ui, defaultLang } from './ui';

export type Lang = keyof typeof ui;

export function getLangFromUrl(url: URL): Lang {
  const segments = url.pathname.split('/').filter(Boolean);
  if (segments[0] === 'en') return 'en';
  return defaultLang;
}

export function useTranslations(lang: Lang = defaultLang) {
  return function t(key: keyof typeof ui[typeof defaultLang]) {
    return (ui[lang] as Record<string, string>)[key] || (ui[defaultLang] as Record<string, string>)[key];
  };
}
