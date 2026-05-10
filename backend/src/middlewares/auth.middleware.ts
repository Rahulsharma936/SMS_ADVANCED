import { Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.utils';
import { TenantRequest } from './tenant.middleware';

export const authMiddleware = (req: TenantRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized: No token provided' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token) as any;

    if (!decoded || !decoded.id || !decoded.tenant_id) {
       res.status(401).json({ error: 'Unauthorized: Invalid token payload' });
       return;
    }

    // Ensure the token's tenant matches the requested tenant context
    if (decoded.tenant_id !== req.tenantId) {
       res.status(403).json({ error: 'Forbidden: Cross-tenant access denied' });
       return;
    }

    req.user = decoded; // Contains id, email, tenant_id, role
    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
};
