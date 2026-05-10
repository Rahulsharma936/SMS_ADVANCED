import { Response } from 'express';
import { prisma } from '../../prisma/client';
import { TenantRequest } from '../../middlewares/tenant.middleware';

export const getMe = async (req: TenantRequest, res: Response) => {
  try {
    const userId = req.user.id;
    const tenantId = req.tenantId;

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        email: true,
        status: true,
        createdAt: true,
        role: {
          select: {
            name: true
          }
        }
      }
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.status(200).json({ user, tenant_id: tenantId });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
