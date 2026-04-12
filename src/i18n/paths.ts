import type { Lang } from "./utils";

export function getHomePath(lang: Lang) {
  return lang === "en" ? "/en" : "/";
}

export function getServicesPath(lang: Lang) {
  return lang === "en" ? "/en/services" : "/servicios";
}
