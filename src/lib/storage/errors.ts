/**
 * El almacenamiento no está disponible: Netlify Blobs no está configurado en
 * el entorno o la llamada falló.
 *
 * Es un error aparte de los demás a propósito. Un lead que no se pudo guardar
 * NO puede degradarse en silencio (por ejemplo, guardándolo en memoria, donde
 * se perdería en el próximo arranque): los endpoints lo traducen a un 503 y lo
 * registran, para que la persona reintente y el fallo se vea en los logs.
 */
export class StorageUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'StorageUnavailableError';
  }
}
