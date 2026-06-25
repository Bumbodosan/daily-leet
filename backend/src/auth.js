import crypto from 'node:crypto';

import {
  createMagicLink,
  createSession,
  createUserForEmail,
  deleteSession,
  findSessionByHash,
  findUserById,
  getMagicLinkByHash,
  markMagicLinkUsed,
} from './db.js';
import { sendMagicLinkEmail } from './mailer.js';

const SESSION_COOKIE_NAME = 'leet_session';
const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;
const SESSION_TTL_MS = 10 * 365 * 24 * 60 * 60 * 1000;

function createToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function isEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function parseCookies(cookieHeader) {
  if (!cookieHeader) {
    return {};
  }

  return Object.fromEntries(
    cookieHeader.split(';').map((cookie) => {
      const [name, ...valueParts] = cookie.trim().split('=');
      return [name, decodeURIComponent(valueParts.join('='))];
    })
  );
}

function shouldUseSecureCookie() {
  if (process.env.AUTH_COOKIE_SECURE) {
    return process.env.AUTH_COOKIE_SECURE === 'true';
  }

  return process.env.NODE_ENV === 'production';
}

function buildSessionCookie(token, maxAgeSeconds) {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ];

  if (shouldUseSecureCookie()) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

export function getSessionToken(request) {
  const cookies = parseCookies(request.headers.cookie);
  return cookies[SESSION_COOKIE_NAME];
}

export async function requestMagicLink(email) {
  if (!isEmail(email)) {
    return {
      ok: false,
      error: 'Expected JSON body with valid email field',
    };
  }

  const normalizedEmail = normalizeEmail(email);
  const user = createUserForEmail(normalizedEmail);
  const token = createToken();
  const expiresAt = Date.now() + MAGIC_LINK_TTL_MS;

  createMagicLink(user.id, hashToken(token), expiresAt);
  await sendMagicLinkEmail({ email: normalizedEmail, token, expiresAt });

  return {
    ok: true,
  };
}

export function consumeMagicLinkToken(token, reply) {
  if (!token) {
    return {
      ok: false,
      statusCode: 400,
      error: 'Missing magic link token',
    };
  }

  const magicLink = getMagicLinkByHash(hashToken(token));
  const now = Date.now();

  if (!magicLink || magicLink.used_at || magicLink.expires_at <= now) {
    return {
      ok: false,
      statusCode: 401,
      error: 'Magic link is invalid or expired',
    };
  }

  markMagicLinkUsed(magicLink.token_hash);

  const sessionToken = createToken();
  const sessionExpiresAt = now + SESSION_TTL_MS;
  createSession(magicLink.user_id, hashToken(sessionToken), sessionExpiresAt);

  reply.header('Set-Cookie', buildSessionCookie(sessionToken, SESSION_TTL_MS / 1000));

  return {
    ok: true,
    user: findUserById(magicLink.user_id),
  };
}

export function getAuthenticatedUser(request) {
  const sessionToken = getSessionToken(request);

  if (!sessionToken) {
    return null;
  }

  const session = findSessionByHash(hashToken(sessionToken));
  if (!session || session.expires_at <= Date.now()) {
    return null;
  }

  return findUserById(session.user_id);
}

export function clearSession(request, reply) {
  const sessionToken = getSessionToken(request);

  if (sessionToken) {
    deleteSession(hashToken(sessionToken));
  }

  reply.header('Set-Cookie', buildSessionCookie('', 0));
}

export async function requireUser(request, reply) {
  const user = getAuthenticatedUser(request);

  if (!user) {
    return reply.code(401).send({
      error: 'Authentication required',
    });
  }

  request.user = user;
}
