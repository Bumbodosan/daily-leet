import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import {
  clearSession,
  consumeMagicLinkToken,
  getAuthenticatedUser,
  requestMagicLink,
  requireUser,
} from './auth.js';
import { db, deleteEntry, getEntry, listEntries, upsertEntry } from './db.js';
import { getImageUploadLimits, listImagesForUser, storeUploadedImage } from './images.js';

const host = process.env.HOST ?? '0.0.0.0';
const port = Number(process.env.PORT ?? 3000);

const app = Fastify({
  logger: true,
});

await app.register(multipart, {
  limits: getImageUploadLimits(),
  throwFileSizeLimit: false,
});

app.get('/health', async () => {
  db.prepare('SELECT 1').get();

  return {
    ok: true,
  };
});

app.post('/auth/magic-link', async (request, reply) => {
  const result = await requestMagicLink(request.body?.email);

  if (!result.ok) {
    return reply.code(400).send({
      error: result.error,
    });
  }

  return {
    ok: true,
  };
});

app.get('/auth/callback', async (request, reply) => {
  const result = consumeMagicLinkToken(request.query.token, reply);

  if (!result.ok) {
    if (process.env.MAGIC_LINK_REDIRECT_URL) {
      const redirectUrl = new URL(process.env.MAGIC_LINK_REDIRECT_URL);
      redirectUrl.searchParams.set('error', result.error);
      return reply.redirect(redirectUrl.toString());
    }

    return reply.code(result.statusCode).send({
      error: result.error,
    });
  }

  if (process.env.MAGIC_LINK_REDIRECT_URL) {
    const redirectUrl = new URL(process.env.MAGIC_LINK_REDIRECT_URL);
    redirectUrl.searchParams.set('authenticated', '1');
    return reply.redirect(redirectUrl.toString());
  }

  return {
    user: result.user,
  };
});

app.get('/me', async (request, reply) => {
  const user = getAuthenticatedUser(request);

  if (!user) {
    return reply.code(401).send({
      error: 'Authentication required',
    });
  }

  return {
    user,
  };
});

app.post('/auth/logout', async (request, reply) => {
  clearSession(request, reply);

  return {
    ok: true,
  };
});

app.get('/images', { preHandler: requireUser }, async (request) => {
  return {
    images: listImagesForUser(request.user.id),
  };
});

app.post('/images', { preHandler: requireUser }, async (request, reply) => {
  if (!request.isMultipart()) {
    return reply.code(400).send({
      error: 'Expected multipart form data with one image file',
    });
  }

  const imagePart = await request.file();
  const result = await storeUploadedImage(request.user.id, imagePart);

  if (!result.ok) {
    return reply.code(result.statusCode).send({
      error: result.error,
    });
  }

  return reply.code(201).send({
    image: result.image,
  });
});

app.get('/entries', { preHandler: requireUser }, async () => {
  return {
    entries: listEntries(),
  };
});

app.get('/entries/:key', { preHandler: requireUser }, async (request, reply) => {
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

app.put('/entries/:key', { preHandler: requireUser }, async (request, reply) => {
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

app.delete('/entries/:key', { preHandler: requireUser }, async (request, reply) => {
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
