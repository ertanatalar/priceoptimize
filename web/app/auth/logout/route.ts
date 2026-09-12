import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const url = new URL(request.url);
  (await cookies()).delete('po_session');
  const returnTo = process.env.PUBLIC_BASE_URL?.replace(/\/$/, '') || url.origin;
  if (!process.env.AUTH0_DOMAIN || !process.env.AUTH0_CLIENT_ID) {
    return Response.redirect(new URL('/signout-with-chatgpt?return_to=/', url.origin));
  }
  const logout = new URL(`https://${process.env.AUTH0_DOMAIN}/v2/logout`);
  logout.searchParams.set('client_id', process.env.AUTH0_CLIENT_ID);
  logout.searchParams.set('returnTo', returnTo);
  return Response.redirect(logout);
}
