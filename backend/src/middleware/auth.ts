import { Request, Response, NextFunction } from 'express';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || 'us-east-1_WucFi2sNK';
const COGNITO_CLIENT_ID    = process.env.COGNITO_CLIENT_ID    || '3i724l9g6bb4qffde95n7u5sgm';

// Verifier caches the JWKS automatically; CJS-compatible (unlike jwks-rsa v4)
const verifier = CognitoJwtVerifier.create({
  userPoolId: COGNITO_USER_POOL_ID,
  tokenUse: 'id',           // we send the ID token (carries email)
  clientId: COGNITO_CLIENT_ID,
});

export interface AuthUser {
  sub: string;
  email: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

async function verifyToken(token: string): Promise<AuthUser> {
  const payload = await verifier.verify(token);
  const sub   = payload.sub;
  const email = (payload.email as string | undefined) ?? '';
  if (!sub) throw new Error('Token missing sub');
  return { sub, email };
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  try {
    req.user = await verifyToken(token);
    next();
  } catch (err: any) {
    res.status(401).json({ error: 'Invalid or expired token', details: err?.message });
  }
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = extractToken(req);
  if (!token) { next(); return; }
  try {
    req.user = await verifyToken(token);
  } catch {
    // Invalid token on optional-auth route — continue as anonymous
  }
  next();
}
