import { Router } from 'express';
import { createTenant } from './tenant.controller';

const router = Router();

// /api/tenants
router.post('/', createTenant);

export default router;
