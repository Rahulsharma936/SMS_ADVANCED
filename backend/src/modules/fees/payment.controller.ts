import { Response } from 'express';
import { TenantRequest } from '../../middlewares/tenant.middleware';
import * as paymentService from './payment.service';

const handle = (res: Response, err: any) => {
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error('[PaymentController]', err);
  return res.status(500).json({ error: 'Internal Server Error' });
};

// ─── POST /fees/payments ──────────────────────────────────────────────────────

export const createPayment = async (req: TenantRequest, res: Response) => {
  try {
    const { student_fee_id, payment_method, amount_paid, allocations,
            payment_date, transaction_id, gateway_reference, remarks } = req.body;

    if (!student_fee_id || !payment_method || amount_paid == null || !allocations) {
      res.status(400).json({ error: 'student_fee_id, payment_method, amount_paid, and allocations[] are required' });
      return;
    }

    const payment = await paymentService.createPayment(
      req.tenantId!,
      req.user!.id,
      { student_fee_id, payment_method, amount_paid: Number(amount_paid),
        allocations, payment_date, transaction_id, gateway_reference, remarks }
    );
    res.status(201).json({ message: 'Payment recorded', payment });
  } catch (err: any) { handle(res, err); }
};

// ─── GET /fees/payments/student/:studentId ────────────────────────────────────

export const getPaymentsByStudent = async (req: TenantRequest, res: Response) => {
  try {
    const data = await paymentService.getPaymentsByStudent(req.tenantId!, req.params.studentId);
    res.status(200).json(data);
  } catch (err: any) { handle(res, err); }
};

// ─── GET /fees/payments/:id ───────────────────────────────────────────────────

export const getPaymentById = async (req: TenantRequest, res: Response) => {
  try {
    const payment = await paymentService.getPaymentById(req.tenantId!, req.params.id);
    res.status(200).json({ payment });
  } catch (err: any) { handle(res, err); }
};

// ─── GET /fees/payments/:id/allocations ──────────────────────────────────────

export const getPaymentAllocations = async (req: TenantRequest, res: Response) => {
  try {
    const allocations = await paymentService.getPaymentAllocations(req.tenantId!, req.params.id);
    res.status(200).json({ allocations });
  } catch (err: any) { handle(res, err); }
};

// ─── POST /fees/payments/webhook ─────────────────────────────────────────────

export const handleWebhook = async (req: TenantRequest, res: Response) => {
  try {
    const { transaction_id, gateway_reference, status, amount } = req.body;
    if (!transaction_id || !status || amount == null) {
      res.status(400).json({ error: 'transaction_id, status, and amount are required' }); return;
    }
    if (!['success', 'failed', 'refunded'].includes(status)) {
      res.status(400).json({ error: 'status must be success, failed, or refunded' }); return;
    }
    const result = await paymentService.handleWebhook(req.tenantId!, {
      transaction_id, gateway_reference, status, amount: Number(amount),
    });
    res.status(200).json({ message: 'Webhook processed', payment: result });
  } catch (err: any) { handle(res, err); }
};

// ─── POST /fees/payments/verify ──────────────────────────────────────────────

export const verifyPayment = async (req: TenantRequest, res: Response) => {
  try {
    const { payment_id } = req.body;
    if (!payment_id) { res.status(400).json({ error: 'payment_id is required' }); return; }
    const result = await paymentService.verifyPayment(req.tenantId!, payment_id);
    res.status(200).json({ verification: result });
  } catch (err: any) { handle(res, err); }
};

// ─── GET /fees/payments/reconcile ────────────────────────────────────────────

export const getReconciliation = async (req: TenantRequest, res: Response) => {
  try {
    const data = await paymentService.getReconciliation(req.tenantId!);
    res.status(200).json(data);
  } catch (err: any) { handle(res, err); }
};
