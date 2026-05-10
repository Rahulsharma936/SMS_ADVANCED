import { Response, NextFunction } from 'express';
import { TenantRequest } from './tenant.middleware';

export const rbacMiddleware = (allowedRoles: string[]) => {
  return (req: TenantRequest, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.role) {
      res.status(403).json({ error: 'Forbidden: Role information missing' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
      return;
    }

    next();
  };
};
