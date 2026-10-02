import { describe } from 'vitest';
import { BlobsBackend, createBlobsStore } from '~/lib/storage/blobs';
import { MemoryBackend, createMemoryStore } from '~/lib/storage/memory';
import { blobsErrorsSection } from './storage/blobs-errors';
import { blobsProtocolSection } from './storage/blobs-protocol';
import { blobsWireSection } from './storage/blobs-wire';
import { appointmentsSection } from './storage/contract.appointments';
import { cleanupSection, type CleanupTarget } from './storage/contract.cleanup';
import { contactsSection } from './storage/contract.contacts';
import { statusSection } from './storage/contract.status';
import { FakeBlobsStore } from './storage/fake-blobs';
import { FakeBlobsServer } from './storage/fake-blobs-http';
import type { ContractTarget } from './storage/helpers';
import { memoryBackendSection } from './storage/memory-backend';

/**
 * Una sola batería de tests de contrato para las implementaciones de
 * `LeadStore`. Si los endpoints pueden cambiar de almacenamiento sin enterarse,
 * es porque todas se comportan igual; esto lo comprueba.
 */
const targets: ContractTarget[] = [
  {
    label: 'memoria',
    backend: 'memory',
    scope: 'process',
    create: ({ seed: _seed, ...options } = {}) => createMemoryStore(options),
  },
  {
    label: 'Netlify Blobs (almacén falso con la API de @netlify/blobs)',
    backend: 'netlify-blobs',
    scope: 'site',
    create: ({ seed, ...options } = {}) =>
      createBlobsStore(new FakeBlobsStore({ seed }), { scope: 'site', ...options }),
  },
  {
    label: 'Netlify Blobs (cliente real de @netlify/blobs contra un servidor HTTP falso)',
    backend: 'netlify-blobs',
    scope: 'site',
    create: ({ seed, ...options } = {}) =>
      // Páginas de 5 claves: cada listado de más de 5 registros recorre varias páginas.
      createBlobsStore(new FakeBlobsServer({ seed, pageSize: 5 }).client(), { scope: 'site', ...options }),
  },
];

describe.each(targets)('LeadStore sobre $label', (target) => {
  contactsSection(target);
  appointmentsSection(target);
  statusSection(target);
});

describe('Netlify Blobs: errores del almacenamiento', blobsErrorsSection);

describe('Netlify Blobs: cómo le habla blobs.ts al cliente', blobsProtocolSection);

describe('Netlify Blobs: el cliente real contra un servidor HTTP falso', blobsWireSection);

describe('MemoryBackend', memoryBackendSection);

const cleanupTargets: CleanupTarget[] = [
  { label: 'memoria', backend: 'memory', scope: 'process', createInner: () => new MemoryBackend() },
  {
    label: 'Netlify Blobs (almacén falso)',
    backend: 'netlify-blobs',
    scope: 'site',
    createInner: () => new BlobsBackend(new FakeBlobsStore()),
  },
  {
    label: 'Netlify Blobs (cliente real)',
    backend: 'netlify-blobs',
    scope: 'site',
    createInner: () => new BlobsBackend(new FakeBlobsServer().client()),
  },
];

describe.each(cleanupTargets)('Limpieza de una reserva fallida sobre $label', (target) => {
  cleanupSection(target);
});
