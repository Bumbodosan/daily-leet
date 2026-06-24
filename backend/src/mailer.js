const RESEND_EMAIL_URL = 'https://api.resend.com/emails';

function getPublicBackendUrl() {
  return process.env.PUBLIC_BACKEND_URL ?? 'http://localhost:3000';
}

function buildMagicLink(token) {
  const url = new URL('/auth/callback', getPublicBackendUrl());
  url.searchParams.set('token', token);

  return url.toString();
}

function isDevMailer() {
  return process.env.NODE_ENV !== 'production' || !process.env.RESEND_API_KEY;
}

export async function sendMagicLinkEmail({ email, token, expiresAt }) {
  const magicLink = buildMagicLink(token);

  if (isDevMailer()) {
    console.log(
      JSON.stringify(
        {
          type: 'magic-link-email',
          to: email,
          magicLink,
          expiresAt: new Date(expiresAt).toISOString(),
        },
        null,
        2
      )
    );
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
      text: `Sign in with this link:\n\n${magicLink}\n\nThis link expires in 15 minutes.`,
      html: `<p>Sign in with this link:</p><p><a href="${magicLink}">${magicLink}</a></p><p>This link expires in 15 minutes.</p>`,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend email failed with ${response.status}: ${body}`);
  }
}
