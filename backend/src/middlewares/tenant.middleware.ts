import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma/client';

export interface TenantRequest extends Request {
  tenantId?: string;
  user?: any; // To be populated by auth middleware
}

export const tenantMiddleware = async (req: TenantRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;

    if (!tenantId) {
       res.status(400).json({ error: 'x-tenant-id header is required' });
       return;
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    if (!tenant) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    req.tenantId = tenantId;
    next();
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error enforcing tenant context' });
  }
};
