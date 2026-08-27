import { getCommunityUser } from '../_shared/community-auth.mjs';

export async function onRequest(context) {
  const pathname = new URL(context.request.url).pathname;
  if (pathname.startsWith('/community/login/')) return context.next();
  const user = await getCommunityUser(context.request, context.env);
  if (!user) {
    const login = new URL('/community/login/', context.request.url);
    login.searchParams.set('next', pathname + new URL(context.request.url).search);
    return Response.redirect(login, 302);
  }
  return context.next();
}
