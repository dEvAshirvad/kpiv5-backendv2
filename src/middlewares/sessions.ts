import { auth } from '@/lib/auth';
import { Request, Response, NextFunction } from 'express';
import { fromNodeHeaders } from 'better-auth/node';

export default async function sessions(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  req.session = session?.session;
  req.user = session?.user;

  next();
}
