import { Request, Response } from 'express';
import { prisma } from '../../prisma/client';

export const createTenant = async (req: Request, res: Response) => {
  try {
    const { name, domain } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Tenant name is required' });
      return;
    }

    const tenant = await prisma.tenant.create({
      data: {
        name,
        domain
      }
    });

    res.status(201).json({ message: 'Tenant created successfully', tenant });
  } catch (error) {
    console.error('Create tenant error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
