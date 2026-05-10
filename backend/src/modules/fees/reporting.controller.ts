import { Response } from 'express';
import { TenantRequest } from '../../middlewares/tenant.middleware';
import * as reportingService from './reporting.service';
import * as receiptService   from './receipt.service';
import * as reminderService  from './reminder.service';

const handle = (res: Response, err: any) => {
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error('[ReportingController]', err);
  return res.status(500).json({ error: 'Internal Server Error' });
};

// ─── Analytics ───────────────────────────────────────────────────────────────

export const getAnalytics = async (req: TenantRequest, res: Response) => {
  try {
    const { from, to } = req.query;
    const data = await reportingService.getCollectionAnalytics(req.tenantId!, from as string, to as string);
    res.status(200).json({ analytics: data });
  } catch (err: any) { handle(res, err); }
};

export const getCollectionSummary = async (req: TenantRequest, res: Response) => {
  try {
    const data = await reportingService.getCollectionSummary(req.tenantId!, req.query.academic_year as string);
    res.status(200).json({ summary: data });
  } catch (err: any) { handle(res, err); }
};

export const getPaymentMethodSummary = async (req: TenantRequest, res: Response) => {
  try {
    const data = await reportingService.getPaymentMethodSummary(req.tenantId!);
    res.status(200).json({ payment_methods: data });
  } catch (err: any) { handle(res, err); }
};

export const getDefaulters = async (req: TenantRequest, res: Response) => {
  try {
    const { class_id, section_id } = req.query;
    const data = await reportingService.getDefaulters(req.tenantId!, class_id as string, section_id as string);
    res.status(200).json(data);
  } catch (err: any) { handle(res, err); }
};

export const getStudentLedger = async (req: TenantRequest, res: Response) => {
  try {
    const data = await reportingService.getStudentLedger(req.tenantId!, req.params.studentId);
    res.status(200).json(data);
  } catch (err: any) { handle(res, err); }
};

export const getClassWiseRevenue = async (req: TenantRequest, res: Response) => {
  try {
    const data = await reportingService.getClassWiseRevenue(req.tenantId!);
    res.status(200).json({ class_revenue: data });
  } catch (err: any) { handle(res, err); }
};

// ─── Receipts ────────────────────────────────────────────────────────────────

export const generateReceipt = async (req: TenantRequest, res: Response) => {
  try {
    const { payment_id } = req.body;
    if (!payment_id) { res.status(400).json({ error: 'payment_id is required' }); return; }
    const receipt = await receiptService.generateReceipt(req.tenantId!, req.user!.id, payment_id);
    res.status(201).json({ message: 'Receipt generated', receipt });
  } catch (err: any) { handle(res, err); }
};

export const getReceiptById = async (req: TenantRequest, res: Response) => {
  try {
    const receipt = await receiptService.getReceiptById(req.tenantId!, req.params.id);
    res.status(200).json({ receipt });
  } catch (err: any) { handle(res, err); }
};

// ─── Invoices ────────────────────────────────────────────────────────────────

export const generateInvoice = async (req: TenantRequest, res: Response) => {
  try {
    const { student_fee_id } = req.body;
    if (!student_fee_id) { res.status(400).json({ error: 'student_fee_id is required' }); return; }
    const invoice = await receiptService.generateInvoice(req.tenantId!, student_fee_id);
    res.status(201).json({ message: 'Invoice generated', invoice });
  } catch (err: any) { handle(res, err); }
};

export const getInvoicesByStudent = async (req: TenantRequest, res: Response) => {
  try {
    const invoices = await receiptService.getInvoicesByStudent(req.tenantId!, req.params.studentId);
    res.status(200).json({ invoices });
  } catch (err: any) { handle(res, err); }
};

// ─── Reminders ───────────────────────────────────────────────────────────────

export const sendReminder = async (req: TenantRequest, res: Response) => {
  try {
    const { student_id, installment_id, type, message } = req.body;
    if (!student_id || !installment_id || !type) {
      res.status(400).json({ error: 'student_id, installment_id, and type are required' }); return;
    }
    const result = await reminderService.sendReminder(req.tenantId!, student_id, installment_id, type, message);
    res.status(200).json({ status: 'Reminder sent', reminder_log: result.log, reminder_message: result.message });
  } catch (err: any) { handle(res, err); }
};

export const sendBulkReminders = async (req: TenantRequest, res: Response) => {
  try {
    const { type, class_id } = req.body;
    if (!type) { res.status(400).json({ error: 'type is required' }); return; }
    const result = await reminderService.sendBulkReminders(req.tenantId!, type, class_id);
    res.status(200).json({ message: 'Bulk reminders processed', ...result });
  } catch (err: any) { handle(res, err); }
};

export const getReminderLogs = async (req: TenantRequest, res: Response) => {
  try {
    const { student_id, type } = req.query;
    const logs = await reminderService.getReminderLogs(req.tenantId!, student_id as string, type as string);
    res.status(200).json({ logs });
  } catch (err: any) { handle(res, err); }
};
