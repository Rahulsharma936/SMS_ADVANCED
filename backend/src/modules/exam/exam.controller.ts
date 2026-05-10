import { Response } from 'express';
import { TenantRequest } from '../../middlewares/tenant.middleware';
import * as examService from './exam.service';

const handle = (res: Response, err: any) => {
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error(err);
  return res.status(500).json({ error: 'Internal Server Error' });
};

// ─── POST /exams ───
export const createExam = async (req: TenantRequest, res: Response) => {
  try {
    const { name, academic_year, start_date, end_date, status } = req.body;
    if (!name || !academic_year) { res.status(400).json({ error: 'name and academic_year are required' }); return; }
    const exam = await examService.createExam(req.tenantId!, { name, academic_year, start_date, end_date, status });
    res.status(201).json({ message: 'Exam created', exam });
  } catch (err: any) { handle(res, err); }
};

// ─── GET /exams ───
export const getExams = async (req: TenantRequest, res: Response) => {
  try {
    const exams = await examService.getExams(req.tenantId!, req.query.status as string);
    res.status(200).json({ exams });
  } catch (err: any) { handle(res, err); }
};

// ─── GET /exams/:id ───
export const getExamById = async (req: TenantRequest, res: Response) => {
  try {
    const exam = await examService.getExamById(req.tenantId!, req.params.id);
    res.status(200).json({ exam });
  } catch (err: any) { handle(res, err); }
};

// ─── PATCH /exams/:id ───
export const updateExam = async (req: TenantRequest, res: Response) => {
  try {
    const exam = await examService.updateExam(req.tenantId!, req.params.id, req.body);
    res.status(200).json({ message: 'Exam updated', exam });
  } catch (err: any) { handle(res, err); }
};

// ─── POST /exams/:id/subjects ───
export const addExamSubjects = async (req: TenantRequest, res: Response) => {
  try {
    const { subjects } = req.body;
    if (!subjects || !Array.isArray(subjects) || subjects.length === 0) {
      res.status(400).json({ error: 'subjects array is required' }); return;
    }
    const result = await examService.addExamSubjects(req.tenantId!, req.params.id, subjects);
    res.status(200).json({ message: 'Subjects configured', examSubjects: result });
  } catch (err: any) { handle(res, err); }
};

// ─── POST /exams/:id/register ───
export const registerStudents = async (req: TenantRequest, res: Response) => {
  try {
    const { class_id, section_id } = req.body;
    if (!class_id || !section_id) { res.status(400).json({ error: 'class_id and section_id are required' }); return; }
    const result = await examService.registerStudentsForExam(req.tenantId!, req.params.id, class_id, section_id);
    res.status(200).json({ message: 'Students registered', ...result });
  } catch (err: any) { handle(res, err); }
};

// ─── POST /exams/:id/marks ───
export const bulkEnterMarks = async (req: TenantRequest, res: Response) => {
  try {
    const { entries } = req.body;
    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      res.status(400).json({ error: 'entries array is required' }); return;
    }
    const result = await examService.bulkEnterMarks(req.tenantId!, req.params.id, entries);
    res.status(200).json({ message: 'Marks saved', ...result });
  } catch (err: any) { handle(res, err); }
};

// ─── GET /exams/:id/marks/student/:studentId ───
export const getStudentMarks = async (req: TenantRequest, res: Response) => {
  try {
    const data = await examService.getStudentMarks(req.tenantId!, req.params.studentId, req.params.id);
    res.status(200).json({ data });
  } catch (err: any) { handle(res, err); }
};

// ─── POST /exams/:id/results/calculate ───
export const calculateResults = async (req: TenantRequest, res: Response) => {
  try {
    const { class_id, section_id } = req.body;
    if (!class_id || !section_id) { res.status(400).json({ error: 'class_id and section_id are required' }); return; }
    const result = await examService.calculateResults(req.tenantId!, req.params.id, class_id, section_id);
    res.status(200).json({ message: 'Results calculated', ...result });
  } catch (err: any) { handle(res, err); }
};

// ─── GET /exams/:id/results ───
export const getClassResults = async (req: TenantRequest, res: Response) => {
  try {
    const { class_id, section_id } = req.query;
    if (!class_id) { res.status(400).json({ error: 'class_id is required' }); return; }
    const results = await examService.getClassResults(req.tenantId!, req.params.id, class_id as string, section_id as string);
    res.status(200).json({ results });
  } catch (err: any) { handle(res, err); }
};

// ─── GET /exams/:id/results/student/:studentId ───
export const getStudentResult = async (req: TenantRequest, res: Response) => {
  try {
    const data = await examService.getStudentResult(req.tenantId!, req.params.studentId, req.params.id);
    res.status(200).json({ data });
  } catch (err: any) { handle(res, err); }
};

// ─── POST /exams/:id/report-card/:studentId ───
export const generateReportCard = async (req: TenantRequest, res: Response) => {
  try {
    const data = await examService.generateReportCard(req.tenantId!, req.params.studentId, req.params.id);
    res.status(200).json({ message: 'Report card generated', ...data });
  } catch (err: any) { handle(res, err); }
};

// ─── GET /grade-scales ───
export const getGradeScales = async (req: TenantRequest, res: Response) => {
  try {
    const scales = await examService.getGradeScales(req.tenantId!);
    res.status(200).json({ scales });
  } catch (err: any) { handle(res, err); }
};

// ─── POST /grade-scales ───
export const upsertGradeScales = async (req: TenantRequest, res: Response) => {
  try {
    const { scales } = req.body;
    if (!scales || !Array.isArray(scales) || scales.length === 0) {
      res.status(400).json({ error: 'scales array is required' }); return;
    }
    const result = await examService.upsertGradeScales(req.tenantId!, scales);
    res.status(200).json({ message: 'Grade scales saved', scales: result });
  } catch (err: any) { handle(res, err); }
};
