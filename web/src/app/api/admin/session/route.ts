import { cookies } from 'next/headers';
import { COOKIE_NAME, verifySession } from '@/lib/admin-auth';

export async function GET() {
  const session = verifySession((await cookies()).get(COOKIE_NAME)?.value);
  return Response.json(session ? { authenticated: true, email: session.email } : { authenticated: false }, { status: session ? 200 : 401 });
}
