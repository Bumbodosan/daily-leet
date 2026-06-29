import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import {
  clearSession,
  consumeMagicLinkToken,
  getAuthenticatedUser,
  requestMagicLink,
  requireUser,
} from './auth.js';
import {
  createFollow,
  db,
  deleteEntry,
  deleteImageReaction,
  findFollow,
  findUserByEmail,
  getImageReactionSummary,
  getImageRecordForViewer,
  getUserProfileForViewer,
  imageReactionEmojis,
  getEntry,
  listFeedImagesForUser,
  listEntries,
  listFriendRelationships,
  setImageReaction,
  upsertEntry,
} from './db.js';
import {
  createStoredImageReadStream,
  getImageUploadLimits,
  listImagesForUser,
  storeUploadedImage,
} from './images.js';

const host = process.env.HOST ?? '0.0.0.0';
const port = Number(process.env.PORT ?? 3000);

const app = Fastify({
  logger: true,
});

function getAllowedCorsOrigins() {
  if (process.env.CORS_ORIGIN) {
    return new Set(process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim()));
  }

  return new Set(['http://localhost:8081', 'http://127.0.0.1:8081']);
}

await app.register(cors, {
  credentials: true,
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    const allowedOrigins = getAllowedCorsOrigins();
    callback(null, allowedOrigins.has(origin));
  },
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
  const result = await requestMagicLink(request.body?.email, request.body?.redirectUrl);

  if (!result.ok) {
    return reply.code(400).send({
      error: result.error,
    });
  }

  return {
    ok: true,
  };
});

app.post('/auth/session', async (request, reply) => {
  const result = consumeMagicLinkToken(request.body?.token, reply);

  if (!result.ok) {
    return reply.code(result.statusCode).send({
      error: result.error,
    });
  }

  return {
    user: result.user,
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

app.get('/friends', { preHandler: requireUser }, async (request) => {
  return listFriendRelationships(request.user.id);
});

app.get('/feed', { preHandler: requireUser }, async (request) => {
  return {
    images: listFeedImagesForUser(request.user.id),
  };
});

app.get('/users/:userId', { preHandler: requireUser }, async (request, reply) => {
  const profile = getUserProfileForViewer(request.params.userId, request.user.id);

  if (!profile) {
    return reply.code(404).send({
      error: 'User not found',
    });
  }

  return profile;
});

app.post('/friends/requests', { preHandler: requireUser }, async (request, reply) => {
  const email = request.body?.email;

  if (typeof email !== 'string') {
    return reply.code(400).send({
      error: 'Expected JSON body with email field',
    });
  }

  const targetUser = findUserByEmail(email.trim().toLowerCase());
  if (!targetUser) {
    return reply.code(404).send({
      error: 'User not found',
    });
  }

  if (targetUser.id === request.user.id) {
    return reply.code(400).send({
      error: 'You cannot add yourself',
    });
  }

  createFollow(request.user.id, targetUser.id);
  const reciprocalFollow = findFollow(targetUser.id, request.user.id);

  return reply.code(reciprocalFollow ? 200 : 201).send({
    relationship: reciprocalFollow ? 'friends' : 'request_sent',
    user: targetUser,
    friends: listFriendRelationships(request.user.id),
  });
});

app.post('/friends/requests/:userId/accept', { preHandler: requireUser }, async (request, reply) => {
  const requesterFollow = findFollow(request.params.userId, request.user.id);

  if (!requesterFollow) {
    return reply.code(404).send({
      error: 'Friend request not found',
    });
  }

  createFollow(request.user.id, request.params.userId);

  return {
    relationship: 'friends',
    friends: listFriendRelationships(request.user.id),
  };
});

app.get('/images', { preHandler: requireUser }, async (request) => {
  return {
    images: listImagesForUser(request.user.id),
  };
});

app.get('/images/:imageId/file', { preHandler: requireUser }, async (request, reply) => {
  const image = getImageRecordForViewer(request.params.imageId, request.user.id);

  if (!image) {
    return reply.code(404).send({
      error: 'Image not found',
    });
  }

  reply.type(image.mime_type);
  return reply.send(createStoredImageReadStream(image));
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
    image: {
      ...result.image,
      reactions: getImageReactionSummary(result.image.id, request.user.id),
    },
  });
});

app.post('/images/:imageId/reaction', { preHandler: requireUser }, async (request, reply) => {
  const image = getImageRecordForViewer(request.params.imageId, request.user.id);

  if (!image) {
    return reply.code(404).send({
      error: 'Image not found',
    });
  }

  const emoji = request.body?.emoji;
  if (typeof emoji !== 'string' || !imageReactionEmojis.includes(emoji)) {
    return reply.code(400).send({
      error: 'Expected JSON body with supported emoji field',
    });
  }

  return {
    reactions: setImageReaction(image.id, request.user.id, emoji),
  };
});

app.delete('/images/:imageId/reaction', { preHandler: requireUser }, async (request, reply) => {
  const image = getImageRecordForViewer(request.params.imageId, request.user.id);

  if (!image) {
    return reply.code(404).send({
      error: 'Image not found',
    });
  }

  return {
    reactions: deleteImageReaction(image.id, request.user.id),
  };
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
