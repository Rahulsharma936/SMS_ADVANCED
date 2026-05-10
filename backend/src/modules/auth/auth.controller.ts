import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../../prisma/client';
import { generateToken } from '../../utils/jwt.utils';

export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, roleName, tenant_id } = req.body;

    if (!email || !password || !roleName || !tenant_id) {
       res.status(400).json({ error: 'Missing required fields' });
       return;
    }

    // Verify tenant
    const tenant = await prisma.tenant.findUnique({ where: { id: tenant_id } });
    if (!tenant) {
       res.status(404).json({ error: 'Tenant not found' });
       return;
    }

    // Upsert the specific role for this tenant just in case it doesn't exist
    // In a real app, you might want to seed roles when the tenant is created.
    let role = await prisma.role.findFirst({
      where: { name: roleName, tenant_id }
    });

    if (!role) {
      role = await prisma.role.create({
        data: { name: roleName, tenant_id }
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        tenant_id,
        role_id: role.id
      }
    });

    const token = generateToken({
      id: user.id,
      email: user.email,
      tenant_id: user.tenant_id,
      role: role.name
    });

    res.status(201).json({ message: 'User registered successfully', token });
  } catch (error: any) {
    console.error('Register error:', error);
    if (error.code === 'P2002') {
       res.status(400).json({ error: 'Email already exists for this tenant' });
       return;
    }
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password, tenant_id } = req.body;

    if (!email || !password || !tenant_id) {
      res.status(400).json({ error: 'Email, password, and tenant_id are required' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: {
        tenant_id_email: {
          tenant_id,
          email
        }
      },
      include: {
        role: true
      }
    });

    if (!user) {
       res.status(401).json({ error: 'Invalid credentials or tenant' });
       return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
       res.status(401).json({ error: 'Invalid credentials or tenant' });
       return;
    }

    const token = generateToken({
      id: user.id,
      email: user.email,
      tenant_id: user.tenant_id,
      role: user.role.name
    });

    res.status(200).json({ message: 'Login successful', token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
