import { errorResponse, json } from '../../../_shared/comments.mjs';
import { requireCommunityUser } from '../../../_shared/community-auth.mjs';

export async function onRequestGet(context) {
  try { return json({ user: await requireCommunityUser(context.request, context.env) }); }
  catch (error) { return errorResponse(error); }
}
