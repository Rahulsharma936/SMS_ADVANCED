import { Response } from 'express';
import { TenantRequest } from '../../middlewares/tenant.middleware';
import * as feesService from './fees.service';

const handle = (res: Response, err: any) => {
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error('[FeeController]', err);
  return res.status(500).json({ error: 'Internal Server Error' });
};

// ─── Fee Structures ──────────────────────────────────────────────────────────

export const createFeeStructure = async (req: TenantRequest, res: Response) => {
  try {
    const { name, academic_year, class_id, currency, is_active } = req.body;
    if (!name || !academic_year) {
      res.status(400).json({ error: 'name and academic_year are required' }); return;
    }
    const structure = await feesService.createFeeStructure(req.tenantId!, {
      name, academic_year, class_id, currency, is_active,
    });
    res.status(201).json({ message: 'Fee structure created', structure });
  } catch (err: any) { handle(res, err); }
};

export const getFeeStructures = async (req: TenantRequest, res: Response) => {
  try {
    const { academic_year, class_id } = req.query;
    const structures = await feesService.getFeeStructures(
      req.tenantId!,
      academic_year as string | undefined,
      class_id      as string | undefined
    );
    res.status(200).json({ structures });
  } catch (err: any) { handle(res, err); }
};

export const getFeeStructureById = async (req: TenantRequest, res: Response) => {
  try {
    const structure = await feesService.getFeeStructureById(req.tenantId!, req.params.id);
    res.status(200).json({ structure });
  } catch (err: any) { handle(res, err); }
};

export const updateFeeStructure = async (req: TenantRequest, res: Response) => {
  try {
    const structure = await feesService.updateFeeStructure(req.tenantId!, req.params.id, req.body);
    res.status(200).json({ message: 'Fee structure updated', structure });
  } catch (err: any) { handle(res, err); }
};

// ─── Fee Components ──────────────────────────────────────────────────────────

export const addFeeComponents = async (req: TenantRequest, res: Response) => {
  try {
    const { fee_structure_id, components } = req.body;
    if (!fee_structure_id || !Array.isArray(components) || components.length === 0) {
      res.status(400).json({ error: 'fee_structure_id and components[] are required' }); return;
    }
    const result = await feesService.addFeeComponents(req.tenantId!, fee_structure_id, components);
    res.status(201).json({ message: 'Components added', components: result });
  } catch (err: any) { handle(res, err); }
};

export const deleteFeeComponent = async (req: TenantRequest, res: Response) => {
  try {
    await feesService.deleteFeeComponent(req.tenantId!, req.params.id);
    res.status(200).json({ message: 'Component deleted' });
  } catch (err: any) { handle(res, err); }
};

// ─── Discounts ───────────────────────────────────────────────────────────────

export const createFeeDiscount = async (req: TenantRequest, res: Response) => {
  try {
    const { name, type, value, is_active } = req.body;
    if (!name || !type || value == null) {
      res.status(400).json({ error: 'name, type, and value are required' }); return;
    }
    const discount = await feesService.createFeeDiscount(req.tenantId!, { name, type, value, is_active });
    res.status(201).json({ message: 'Discount created', discount });
  } catch (err: any) { handle(res, err); }
};

export const getFeeDiscounts = async (req: TenantRequest, res: Response) => {
  try {
    const discounts = await feesService.getFeeDiscounts(req.tenantId!);
    res.status(200).json({ discounts });
  } catch (err: any) { handle(res, err); }
};

// ─── Student Fee Assignment ───────────────────────────────────────────────────

export const assignFeeToStudent = async (req: TenantRequest, res: Response) => {
  try {
    const { student_id, fee_structure_id, discount_ids, installments } = req.body;
    if (!student_id || !fee_structure_id) {
      res.status(400).json({ error: 'student_id and fee_structure_id are required' }); return;
    }
    const studentFee = await feesService.assignFeeToStudent(req.tenantId!, {
      student_id, fee_structure_id, discount_ids, installments,
    });
    res.status(201).json({ message: 'Fee assigned to student', studentFee });
  } catch (err: any) { handle(res, err); }
};

export const getStudentFees = async (req: TenantRequest, res: Response) => {
  try {
    const data = await feesService.getStudentFees(req.tenantId!, req.params.studentId);
    res.status(200).json(data);
  } catch (err: any) { handle(res, err); }
};

// ─── Installments ────────────────────────────────────────────────────────────

export const addInstallments = async (req: TenantRequest, res: Response) => {
  try {
    const { installments } = req.body;
    if (!Array.isArray(installments) || installments.length === 0) {
      res.status(400).json({ error: 'installments[] is required' }); return;
    }
    const result = await feesService.addInstallments(
      req.tenantId!, req.params.studentFeeId, installments,
    );
    res.status(201).json({ message: 'Installments added', count: result.count });
  } catch (err: any) { handle(res, err); }
};

export const getInstallments = async (req: TenantRequest, res: Response) => {
  try {
    const data = await feesService.getInstallments(req.tenantId!, req.params.studentFeeId);
    res.status(200).json(data);
  } catch (err: any) { handle(res, err); }
};

// ─── Summary ─────────────────────────────────────────────────────────────────

export const getFeeSummary = async (req: TenantRequest, res: Response) => {
  try {
    const { academic_year } = req.query;
    const summary = await feesService.getFeeSummary(req.tenantId!, academic_year as string);
    res.status(200).json({ summary });
  } catch (err: any) { handle(res, err); }
};
