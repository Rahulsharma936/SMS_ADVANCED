import { Router } from 'express';
import {
  createFeeStructure, getFeeStructures, getFeeStructureById, updateFeeStructure,
  addFeeComponents, deleteFeeComponent,
  createFeeDiscount, getFeeDiscounts,
  assignFeeToStudent, getStudentFees,
  addInstallments, getInstallments,
  getFeeSummary,
} from './fees.controller';
import {
  createPayment, getPaymentsByStudent, getPaymentById,
  getPaymentAllocations, handleWebhook, verifyPayment, getReconciliation,
} from './payment.controller';
import {
  getAnalytics, getCollectionSummary, getPaymentMethodSummary,
  getDefaulters, getStudentLedger, getClassWiseRevenue,
  generateReceipt, getReceiptById,
  generateInvoice, getInvoicesByStudent,
  sendReminder, sendBulkReminders, getReminderLogs,
} from './reporting.controller';
import { tenantMiddleware } from '../../middlewares/tenant.middleware';
import { authMiddleware }   from '../../middlewares/auth.middleware';
import { rbacMiddleware }   from '../../middlewares/rbac.middleware';

const router = Router();
router.use(tenantMiddleware, authMiddleware);

// ─── Fee Structures ──────────────────────────────────────────────────────────
router.post('/structures',       rbacMiddleware(['Admin']),   createFeeStructure);
router.get('/structures',                                     getFeeStructures);
router.get('/structures/:id',                                 getFeeStructureById);
router.patch('/structures/:id',  rbacMiddleware(['Admin']),   updateFeeStructure);

// ─── Fee Components ──────────────────────────────────────────────────────────
router.post('/components',       rbacMiddleware(['Admin']),   addFeeComponents);
router.delete('/components/:id', rbacMiddleware(['Admin']),   deleteFeeComponent);

// ─── Discounts ───────────────────────────────────────────────────────────────
router.post('/discounts',        rbacMiddleware(['Admin']),   createFeeDiscount);
router.get('/discounts',                                      getFeeDiscounts);

// ─── Student Fee Assignment ───────────────────────────────────────────────────
router.post('/assign',           rbacMiddleware(['Admin']),   assignFeeToStudent);
router.get('/student/:studentId',                             getStudentFees);

// ─── Installments ────────────────────────────────────────────────────────────
router.post('/installments/:studentFeeId', rbacMiddleware(['Admin']), addInstallments);
router.get('/installments/:studentFeeId',                             getInstallments);

// ─── Summary ─────────────────────────────────────────────────────────────────
router.get('/summary',                                        getFeeSummary);

// ─── Payments ────────────────────────────────────────────────────────────────
router.post('/payments',                  rbacMiddleware(['Admin']),   createPayment);
router.get('/payments/reconcile',         rbacMiddleware(['Admin']),   getReconciliation);
router.post('/payments/webhook',                                        handleWebhook);
router.post('/payments/verify',           rbacMiddleware(['Admin']),   verifyPayment);
router.get('/payments/student/:studentId',                             getPaymentsByStudent);
router.get('/payments/:id',                                            getPaymentById);
router.get('/payments/:id/allocations',                                getPaymentAllocations);

// ─── Analytics & Reports ─────────────────────────────────────────────────────
router.get('/analytics',               rbacMiddleware(['Admin']),   getAnalytics);
router.get('/collection-summary',      rbacMiddleware(['Admin']),   getCollectionSummary);
router.get('/payment-method-summary',  rbacMiddleware(['Admin']),   getPaymentMethodSummary);
router.get('/defaulters',              rbacMiddleware(['Admin']),   getDefaulters);
router.get('/class-revenue',           rbacMiddleware(['Admin']),   getClassWiseRevenue);
router.get('/ledger/:studentId',                                    getStudentLedger);

// ─── Receipts ────────────────────────────────────────────────────────────────
router.post('/receipts/generate',      rbacMiddleware(['Admin']),   generateReceipt);
router.get('/receipts/:id',                                         getReceiptById);

// ─── Invoices ────────────────────────────────────────────────────────────────
router.post('/invoices/generate',      rbacMiddleware(['Admin']),   generateInvoice);
router.get('/invoices/student/:studentId',                          getInvoicesByStudent);

// ─── Reminders ───────────────────────────────────────────────────────────────
router.post('/reminders/send',         rbacMiddleware(['Admin']),   sendReminder);
router.post('/reminders/bulk',         rbacMiddleware(['Admin']),   sendBulkReminders);
router.get('/reminders/logs',          rbacMiddleware(['Admin']),   getReminderLogs);

export default router;
