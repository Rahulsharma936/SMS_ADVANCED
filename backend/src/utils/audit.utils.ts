import { prisma } from '../prisma/client';

export const createAuditLog = async (
  tenantId: string,
  userId: string,
  action: string,
  entity: string,
  entityId: string,
  changes?: any,
) => {
  try {
    await prisma.auditLog.create({
      data: {
        tenant_id: tenantId,
        user_id: userId,
        action,
        entity,
        entity_id: entityId,
        changes: changes || null,
      },
    });
  } catch (error) {
    // Audit logging should never block the main operation
    console.error('Audit log error:', error);
  }
};
