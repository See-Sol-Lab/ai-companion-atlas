import { errorResponse, json, requireEnv } from '../_shared/comments.mjs';

export function onRequestGet({ env }) {
  try {
    return json({ turnstileSiteKey: requireEnv(env, 'TURNSTILE_SITE_KEY') }, 200, {
      'Cache-Control': 'public, max-age=300'
    });
  } catch (error) {
    return errorResponse(error);
  }
}
