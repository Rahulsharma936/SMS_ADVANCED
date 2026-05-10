import { Response } from 'express';
import { TenantRequest } from '../../middlewares/tenant.middleware';
import * as attendanceService from './attendance.service';

// ─── POST /attendance/mark ───
export const markAttendance = async (req: TenantRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const { class_id, section_id, date, period, records } = req.body;

    if (!class_id || !section_id || !date || !records || !Array.isArray(records)) {
      res.status(400).json({ error: 'class_id, section_id, date, and records array are required' });
      return;
    }

    // Resolve teacher ID if user is a teacher
    let markedById: string | undefined;
    if (req.user?.role === 'Teacher') {
      const { prisma } = require('../../prisma/client');
      const teacher = await prisma.teacher.findFirst({ where: { user_id: req.user.id, tenant_id: tenantId } });
      markedById = teacher?.id;
    }

    const result = await attendanceService.markAttendance({
      tenant_id: tenantId, class_id, section_id, date,
      period: period ?? null, marked_by_id: markedById, records,
    });

    res.status(200).json({ message: 'Attendance marked successfully', ...result });
  } catch (error: any) {
    if (error.status) { res.status(error.status).json({ error: error.message }); return; }
    console.error('Mark attendance error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ─── GET /attendance/class ───
export const getClassAttendance = async (req: TenantRequest, res: Response) => {
  try {
    const { class_id, section_id, date, period } = req.query;
    if (!class_id || !section_id || !date) {
      res.status(400).json({ error: 'class_id, section_id, and date are required' });
      return;
    }
    const sessions = await attendanceService.getClassAttendance(
      req.tenantId!, class_id as string, section_id as string, date as string, period as string
    );
    res.status(200).json({ sessions });
  } catch (error) {
    console.error('Get class attendance error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ─── GET /attendance/student/:id ───
export const getStudentAttendance = async (req: TenantRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { from_date, to_date } = req.query;
    const data = await attendanceService.getStudentAttendance(
      req.tenantId!, id, from_date as string, to_date as string
    );
    res.status(200).json(data);
  } catch (error) {
    console.error('Get student attendance error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ─── GET /attendance/report/class ───
export const getClassReport = async (req: TenantRequest, res: Response) => {
  try {
    const { class_id, section_id, from_date, to_date } = req.query;
    if (!class_id || !section_id || !from_date || !to_date) {
      res.status(400).json({ error: 'class_id, section_id, from_date, to_date are required' });
      return;
    }
    const report = await attendanceService.getClassReport(
      req.tenantId!, class_id as string, section_id as string, from_date as string, to_date as string
    );
    res.status(200).json(report);
  } catch (error) {
    console.error('Get class report error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ─── GET /attendance/absentees ───
export const getAbsenteeList = async (req: TenantRequest, res: Response) => {
  try {
    const { date, class_id } = req.query;
    if (!date) { res.status(400).json({ error: 'date is required' }); return; }
    const absentees = await attendanceService.getAbsenteeList(req.tenantId!, date as string, class_id as string);
    res.status(200).json({ absentees });
  } catch (error) {
    console.error('Get absentee list error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ─── POST /attendance/leave/apply ───
export const applyLeave = async (req: TenantRequest, res: Response) => {
  try {
    const { student_id, from_date, to_date, reason } = req.body;
    if (!student_id || !from_date || !to_date || !reason) {
      res.status(400).json({ error: 'student_id, from_date, to_date, and reason are required' });
      return;
    }
    const leave = await attendanceService.applyLeave(req.tenantId!, student_id, from_date, to_date, reason);
    res.status(201).json({ message: 'Leave application submitted', leave });
  } catch (error: any) {
    if (error.status) { res.status(error.status).json({ error: error.message }); return; }
    console.error('Apply leave error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ─── PATCH /attendance/leave/:id ───
export const updateLeaveStatus = async (req: TenantRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status || !['approved', 'rejected'].includes(status)) {
      res.status(400).json({ error: 'status must be "approved" or "rejected"' });
      return;
    }

    // Resolve approver teacher ID
    let approvedById: string | undefined;
    const { prisma } = require('../../prisma/client');
    const teacher = await prisma.teacher.findFirst({ where: { user_id: req.user.id, tenant_id: req.tenantId } });
    approvedById = teacher?.id;

    const leave = await attendanceService.updateLeaveStatus(req.tenantId!, id, status, approvedById);
    res.status(200).json({ message: `Leave ${status}`, leave });
  } catch (error: any) {
    if (error.status) { res.status(error.status).json({ error: error.message }); return; }
    console.error('Update leave error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ─── GET /attendance/leave ───
export const getLeaves = async (req: TenantRequest, res: Response) => {
  try {
    const { status, student_id, class_id } = req.query;
    const leaves = await attendanceService.getLeaves(req.tenantId!, {
      status: status as string, student_id: student_id as string, class_id: class_id as string,
    });
    res.status(200).json({ leaves });
  } catch (error) {
    console.error('Get leaves error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ─── POST /attendance/biometric-sync ───
export const biometricSync = async (req: TenantRequest, res: Response) => {
  try {
    const { logs } = req.body;
    if (!logs || !Array.isArray(logs)) {
      res.status(400).json({ error: 'logs array is required' });
      return;
    }
    const result = await attendanceService.syncBiometricLogs(req.tenantId!, logs);
    res.status(200).json({ message: 'Biometric sync complete', ...result });
  } catch (error) {
    console.error('Biometric sync error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
