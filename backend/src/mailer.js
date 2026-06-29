const RESEND_EMAIL_URL = 'https://api.resend.com/emails';

function getPublicBackendUrl() {
  return process.env.PUBLIC_BACKEND_URL ?? 'http://localhost:3000';
}

function getComparableUrlOrigin(url) {
  if (url.protocol === 'http:' || url.protocol === 'https:') {
    return url.origin;
  }

  return `${url.protocol}//${url.host}`;
}

function getAllowedRedirectOrigins() {
  const configuredOrigins = process.env.MAGIC_LINK_ALLOWED_REDIRECT_ORIGINS
    ? process.env.MAGIC_LINK_ALLOWED_REDIRECT_ORIGINS.split(',').map((origin) => origin.trim())
    : [];
  const appRedirectOrigin = getComparableUrlOrigin(
    new URL(process.env.MAGIC_LINK_APP_REDIRECT_URL ?? 'leet://auth/callback')
  );

  if (process.env.NODE_ENV === 'production') {
    return [...configuredOrigins, appRedirectOrigin];
  }

  return [
    ...configuredOrigins,
    appRedirectOrigin,
    'http://localhost:8081',
    'http://127.0.0.1:8081',
    'exp://localhost:8081',
    'exp://127.0.0.1:8081',
  ];
}

export function isAllowedMagicLinkRedirectUrl(redirectUrl) {
  if (redirectUrl === undefined || redirectUrl === null || redirectUrl === '') {
    return true;
  }

  if (typeof redirectUrl !== 'string') {
    return false;
  }

  try {
    const url = new URL(redirectUrl);
    const origin = getComparableUrlOrigin(url);
    return getAllowedRedirectOrigins().includes(origin);
  } catch {
    return false;
  }
}

function buildSignInLink(token, redirectUrl) {
  const url = new URL(redirectUrl || '/auth/callback', getPublicBackendUrl());
  url.searchParams.set('token', token);

  return url.toString();
}

function isDevMailer() {
  return process.env.NODE_ENV !== 'production' || !process.env.RESEND_API_KEY;
}

function getSimulatorCommand(signInLink) {
  const protocol = new URL(signInLink).protocol;

  if (protocol !== 'exp:' && protocol !== 'leet:') {
    return '';
  }

  return `\n\niOS simulator:\nxcrun simctl openurl booted '${signInLink}'`;
}

export async function sendMagicLinkEmail({ email, token, expiresAt, redirectUrl }) {
  const signInLink = buildSignInLink(token, redirectUrl);

  if (isDevMailer()) {
    console.log(`
[magic-link-email]
to: ${email}
expiresAt: ${new Date(expiresAt).toISOString()}

sign-in link:
${signInLink}${getSimulatorCommand(signInLink)}
`);
    return;
  }

  if (!process.env.RESEND_FROM_EMAIL) {
    throw new Error('RESEND_FROM_EMAIL is required when NODE_ENV=production');
  }

  const response = await fetch(RESEND_EMAIL_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL,
      to: email,
      subject: 'Your sign-in link',
      text: `Sign in with this link:\n\n${signInLink}\n\nThis link expires in 15 minutes.`,
      html: `<p>Sign in with this link:</p><p><a href="${signInLink}">${signInLink}</a></p><p>This link expires in 15 minutes.</p>`,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend email failed with ${response.status}: ${body}`);
  }
}
