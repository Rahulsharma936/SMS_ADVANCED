import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma/client';

export interface TenantRequest extends Request {
  tenantId?: string;
  user?: any; // To be populated by auth middleware
}

// ── P2A: Lightweight in-memory tenant cache (TTL 5 min) ──
// Avoids a DB query on every single API request for the same tenant ID.
const tenantCache = new Map<string, { exists: boolean; expiresAt: number }>();
const TENANT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCachedTenant(tenantId: string): boolean | null {
  const entry = tenantCache.get(tenantId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    tenantCache.delete(tenantId);
    return null;
  }
  return entry.exists;
}

function setCachedTenant(tenantId: string, exists: boolean): void {
  // Prevent unbounded cache growth (max 500 tenants — more than enough)
  if (tenantCache.size > 500) {
    const firstKey = tenantCache.keys().next().value;
    if (firstKey) tenantCache.delete(firstKey);
  }
  tenantCache.set(tenantId, { exists, expiresAt: Date.now() + TENANT_CACHE_TTL_MS });
}

export const tenantMiddleware = async (req: TenantRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.headers['x-tenant-id'] as string;

    if (!tenantId) {
       res.status(400).json({ error: 'x-tenant-id header is required' });
       return;
    }

    // Check cache first
    const cached = getCachedTenant(tenantId);
    if (cached === true) {
      req.tenantId = tenantId;
      next();
      return;
    }
    if (cached === false) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    // Cache miss — query DB
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    if (!tenant) {
      setCachedTenant(tenantId, false);
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    setCachedTenant(tenantId, true);
    req.tenantId = tenantId;
    next();
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error enforcing tenant context' });
  }
};
