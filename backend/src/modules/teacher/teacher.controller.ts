import { Response } from 'express';
import { TenantRequest } from '../../middlewares/tenant.middleware';
import * as teacherService from './teacher.service';

// ─── POST /teachers ───

export const createTeacher = async (req: TenantRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const {
      employee_id, firstName, lastName, email, password,
      phone, joining_date, qualification, experience_years,
      specialization, designation,
    } = req.body;

    if (!employee_id || !firstName || !lastName || !email) {
      res.status(400).json({ error: 'employee_id, firstName, lastName, and email are required' });
      return;
    }

    const teacher = await teacherService.createTeacher({
      tenant_id: tenantId,
      employee_id, firstName, lastName, email, password,
      phone, joining_date, qualification, experience_years,
      specialization, designation,
    });

    res.status(201).json({ message: 'Teacher created successfully', teacher });
  } catch (error: any) {
    if (error.status) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'Employee ID already exists for this tenant' });
      return;
    }
    console.error('Create teacher error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ─── GET /teachers ───

export const getTeachers = async (req: TenantRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const { status, search, designation } = req.query;

    const teachers = await teacherService.getTeachers(tenantId, {
      status: status as string,
      search: search as string,
      designation: designation as string,
    });

    res.status(200).json({ teachers });
  } catch (error) {
    console.error('Get teachers error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ─── GET /teachers/:id ───

export const getTeacherById = async (req: TenantRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;

    // RBAC: Teacher role can only access own profile
    if (req.user?.role === 'Teacher') {
      const ownTeacher = await teacherService.getTeacherById(tenantId, id);
      if (!ownTeacher || ownTeacher.user_id !== req.user.id) {
        res.status(403).json({ error: 'You can only view your own profile' });
        return;
      }
    }

    const teacher = await teacherService.getTeacherById(tenantId, id);

    if (!teacher) {
      res.status(404).json({ error: 'Teacher not found' });
      return;
    }

    res.status(200).json({ teacher });
  } catch (error) {
    console.error('Get teacher by ID error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ─── PATCH /teachers/:id ───

export const updateTeacher = async (req: TenantRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;

    const teacher = await teacherService.updateTeacher(tenantId, id, req.body);

    res.status(200).json({ message: 'Teacher updated successfully', teacher });
  } catch (error: any) {
    if (error.status) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    console.error('Update teacher error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ─── POST /teachers/assign-class ───

export const assignClassTeacher = async (req: TenantRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const { teacher_id, class_id, section_id } = req.body;

    if (!teacher_id || !class_id || !section_id) {
      res.status(400).json({ error: 'teacher_id, class_id, and section_id are required' });
      return;
    }

    const result = await teacherService.assignClassTeacher({
      tenant_id: tenantId,
      teacher_id,
      class_id,
      section_id,
    });

    res.status(200).json({ message: 'Class teacher assigned', section: result });
  } catch (error: any) {
    if (error.status) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    console.error('Assign class teacher error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ─── POST /teachers/assign-subject ───

export const assignSubjectToTeacher = async (req: TenantRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const { teacher_id, subject_id } = req.body;

    if (!teacher_id || !subject_id) {
      res.status(400).json({ error: 'teacher_id and subject_id are required' });
      return;
    }

    const mapping = await teacherService.assignSubjectToTeacher(tenantId, teacher_id, subject_id);

    res.status(201).json({ message: 'Subject assigned to teacher', mapping });
  } catch (error: any) {
    if (error.status) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'Teacher already assigned to this subject' });
      return;
    }
    console.error('Assign subject to teacher error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ─── GET /teachers/:id/workload ───

export const getTeacherWorkload = async (req: TenantRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;

    // RBAC: Teacher role can only access own workload
    if (req.user?.role === 'Teacher') {
      const profile = await teacherService.getTeacherById(tenantId, id);
      if (!profile || profile.user_id !== req.user.id) {
        res.status(403).json({ error: 'You can only view your own workload' });
        return;
      }
    }

    const workload = await teacherService.getTeacherWorkload(tenantId, id);

    res.status(200).json(workload);
  } catch (error: any) {
    if (error.status) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    console.error('Get teacher workload error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
