import { Request, Response, NextFunction } from 'express';
import jwt, { JwtHeader, SigningKeyCallback } from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

const COGNITO_REGION = process.env.COGNITO_REGION || 'us-east-1';
const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || 'us-east-1_WucFi2sNK';

const issuer = `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}`;
const jwksUri = `${issuer}/.well-known/jwks.json`;

const client = jwksClient({
  jwksUri,
  cache: true,
  cacheMaxAge: 600_000, // 10 minutes
  rateLimit: true,
  jwksRequestsPerMinute: 10,
});

function getKey(header: JwtHeader, callback: SigningKeyCallback) {
  if (!header.kid) return callback(new Error('Missing kid header'));
  client.getSigningKey(header.kid, (err, key) => {
    if (err || !key) return callback(err ?? new Error('Signing key not found'));
    callback(null, key.getPublicKey());
  });
}

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

function verifyToken(token: string): Promise<AuthUser> {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getKey,
      {
        issuer,
        algorithms: ['RS256'],
      },
      (err, decoded) => {
        if (err || !decoded || typeof decoded === 'string') {
          return reject(err ?? new Error('Invalid token'));
        }
        const payload = decoded as jwt.JwtPayload;
        const sub = payload.sub;
        const email = (payload.email as string | undefined) ?? (payload['cognito:username'] as string | undefined) ?? '';
        if (!sub) return reject(new Error('Token missing sub'));
        // Both Access and ID tokens are accepted here — ID tokens carry email.
        resolve({ sub, email });
      },
    );
  });
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

export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) return next();
  try {
    req.user = await verifyToken(token);
  } catch {
    // Invalid token on an optional-auth route: fall through as anonymous
  }
  next();
}
