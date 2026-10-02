import { beforeEach, expect, it } from 'vitest';
import { MemoryBackend } from '~/lib/storage/memory';

/** El almacén clave-valor en memoria, directamente: lo que el resto del store da por sentado. */
export const memoryBackendSection = () => {
  let backend: MemoryBackend;

  beforeEach(() => {
    backend = new MemoryBackend();
  });

  it('get devuelve null si la clave no existe y no confunde un valor falso con una clave ausente', async () => {
    await backend.set('vacio', {});
    await backend.set('cero', 0);
    await backend.set('falso', false);

    expect(await backend.get('no-existe')).toBeNull();
    expect(await backend.get('vacio')).toEqual({});
    expect(await backend.get('cero')).toBe(0);
    expect(await backend.get('falso')).toBe(false);
  });

  it('guarda una copia: lo que se escribe y lo que se lee no comparten referencia', async () => {
    const original = { lista: [1, 2], anidado: { valor: 'a' } };
    await backend.set('clave', original);

    original.lista.push(3);
    const leido = (await backend.get<typeof original>('clave'))!;
    leido.anidado.valor = 'alterado';

    expect(await backend.get('clave')).toEqual({ lista: [1, 2], anidado: { valor: 'a' } });
  });

  it('se comporta como JSON: los undefined desaparecen', async () => {
    await backend.set('clave', { presente: 1, ausente: undefined });

    expect(await backend.get('clave')).toEqual({ presente: 1 });
  });

  it('set reemplaza el valor anterior', async () => {
    await backend.set('clave', { version: 1 });
    await backend.set('clave', { version: 2 });

    expect(await backend.get('clave')).toEqual({ version: 2 });
  });

  it('setIfAbsent escribe solo si la clave no existe', async () => {
    await backend.setIfAbsent('clave', 'primero');
    await backend.setIfAbsent('clave', 'segundo');

    expect(await backend.get('clave')).toBe('primero');
  });

  it('setIfAbsent es atómico: con dos intentos a la vez gana el primero y el segundo no pisa nada', async () => {
    await Promise.all([backend.setIfAbsent('clave', 'primero'), backend.setIfAbsent('clave', 'segundo')]);

    expect(await backend.get('clave')).toBe('primero');
  });

  it('setIfAbsent tampoco pisa un valor que se escribió con set', async () => {
    await backend.set('clave', 'existente');
    await backend.setIfAbsent('clave', 'nuevo');

    expect(await backend.get('clave')).toBe('existente');
  });

  it('delete quita la clave, y no falla si no existe', async () => {
    await backend.set('clave', 1);

    await backend.delete('clave');
    await expect(backend.delete('clave')).resolves.toBeUndefined();

    expect(await backend.get('clave')).toBeNull();
  });

  it('keys devuelve solo las claves con ese prefijo, ordenadas', async () => {
    for (const key of ['a/3', 'a/1', 'ab/9', 'b/2', 'a/2']) await backend.set(key, 1);

    expect(await backend.keys('a/')).toEqual(['a/1', 'a/2', 'a/3']);
    expect(await backend.keys('')).toHaveLength(5);
    expect(await backend.keys('z/')).toEqual([]);
  });
};
