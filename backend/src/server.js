import Fastify from 'fastify';

import { db, deleteEntry, getEntry, listEntries, upsertEntry } from './db.js';

const host = process.env.HOST ?? '0.0.0.0';
const port = Number(process.env.PORT ?? 3000);

const app = Fastify({
  logger: true,
});

app.get('/health', async () => {
  db.prepare('SELECT 1').get();

  return {
    ok: true,
  };
});

app.get('/entries', async () => {
  return {
    entries: listEntries(),
  };
});

app.get('/entries/:key', async (request, reply) => {
  const entry = getEntry(request.params.key);

  if (!entry) {
    return reply.code(404).send({
      error: 'Entry not found',
    });
  }

  return {
    entry,
  };
});

app.put('/entries/:key', async (request, reply) => {
  const value = request.body?.value;

  if (typeof value !== 'string') {
    return reply.code(400).send({
      error: 'Expected JSON body with string field: value',
    });
  }

  upsertEntry(request.params.key, value);

  return reply.code(201).send({
    entry: getEntry(request.params.key),
  });
});

app.delete('/entries/:key', async (request, reply) => {
  const result = deleteEntry(request.params.key);

  if (result.changes === 0) {
    return reply.code(404).send({
      error: 'Entry not found',
    });
  }

  return reply.code(204).send();
});

try {
  await app.listen({ host, port });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
