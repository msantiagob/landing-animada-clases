/**
 * Lógica de los formularios que corre en el navegador, separada de los
 * componentes para poder probarla sin DOM.
 *
 * Contexto: con el ClientRouter de Astro un `<script>` de módulo se ejecuta UNA
 * vez por documento. Tras una navegación suave, el formulario de la página
 * nueva es un DOM recién insertado que nadie enlazó: se enviaba como un GET
 * nativo y el lead se perdía sin ningún error visible. Los componentes se
 * inicializan en `astro:page-load` y usan `markBound` para no enlazar dos veces.
 */

/** Elemento mínimo que admite la marca; `HTMLElement.dataset` lo cumple. */
export interface BindableElement {
  dataset: Record<string, string | undefined>;
}

/**
 * Marca el elemento como inicializado (`data-bound="true"`). Devuelve `false`
 * si ya lo estaba, para que `astro:page-load` pueda ejecutarse varias veces
 * sobre el mismo DOM sin duplicar listeners ni envíos.
 */
export const markBound = (element: BindableElement): boolean => {
  if (element.dataset.bound === 'true') return false;

  element.dataset.bound = 'true';
  return true;
};

export interface PostJsonMessages {
  /** El servidor respondió, pero rechazó el envío sin dar un motivo legible. */
  rejected: string;
  /** No hubo respuesta: sin red, conexión caída, bloqueo del navegador. */
  network: string;
}

export type PostJsonResult = { ok: true; data: Record<string, unknown> } | { ok: false; error: string };

/**
 * POST de un JSON a la API del sitio.
 *
 * Decide por `success` del cuerpo y no por `response.ok`: el backend explica
 * el motivo en el cuerpo también con 400, 409 y 429, y cortar por el estado
 * HTTP lo escondería tras un mensaje genérico. Nunca lanza: devuelve el mensaje
 * que hay que mostrarle a la persona.
 */
export async function postJson(
  url: string,
  body: unknown,
  messages: PostJsonMessages,
  fetchImpl: typeof fetch = fetch
): Promise<PostJsonResult> {
  let response: Response;

  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, error: messages.network };
  }

  const result: { success?: unknown; error?: unknown } | null = await response.json().catch(() => null);

  if (result?.success) return { ok: true, data: result as Record<string, unknown> };

  const reason = typeof result?.error === 'string' ? result.error.trim() : '';
  return { ok: false, error: reason || messages.rejected };
}

export interface LeadFormValues {
  name: string;
  email: string;
  phone: string;
  message: string;
  interest: string;
  /** Honeypot: lo completa un bot, nunca una persona. */
  website: string;
}

/** Cuerpo que espera `POST /api/contact`. Lo opcional vacío viaja como null. */
export const buildLeadPayload = (values: LeadFormValues, sourcePage: string) => ({
  name: values.name.trim(),
  email: values.email.trim(),
  phone: values.phone.trim() || null,
  message: values.message.trim(),
  interest: values.interest.trim() || null,
  website: values.website.trim(),
  sourcePage,
});

export const LEAD_FORM_MESSAGES: PostJsonMessages = {
  rejected: 'No pudimos enviar la consulta. Prueba de nuevo en un momento.',
  network: 'Hubo un problema de conexión. Revisa tu red e inténtalo otra vez.',
};
