export const TIMEZONE = 'America/Bogota'; // UTC-5

// Slots disponibles por día de la semana (1=Lun ... 5=Vie)
export const WEEKLY_SLOTS: Record<number, string[]> = {
  1: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'],
  2: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'],
  3: ['09:00', '10:00', '11:00', '14:00', '15:00'],
  4: ['09:00', '10:00', '14:00', '15:00', '16:00'],
  5: ['09:00', '10:00', '11:00'],
};

/** Devuelve los próximos `daysAhead` días que tienen slots disponibles (ISO YYYY-MM-DD) */
export function getBookableDates(daysAhead = 28): string[] {
  const dates: string[] = [];
  const now = new Date();
  for (let i = 1; i <= daysAhead; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const dow = d.getDay(); // 0=Dom, 6=Sáb
    if (WEEKLY_SLOTS[dow]) {
      dates.push(d.toISOString().slice(0, 10));
    }
  }
  return dates;
}

/** Clave única para un slot: "2026-04-15_10:00" */
export function toSlotKey(date: string, time: string): string {
  return `${date}_${time}`;
}

/** Formatea fecha ISO a texto legible */
export function formatDate(iso: string, lang: 'es' | 'en'): string {
  const [year, month, day] = iso.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'es-CO', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}
