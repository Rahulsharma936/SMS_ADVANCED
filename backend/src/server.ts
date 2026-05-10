import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';

// Phase 1 modules
import tenantRoutes from './modules/tenant/tenant.routes';
import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/user/user.routes';

// Phase 2 modules
import classRoutes from './modules/class/class.routes';
import subjectRoutes from './modules/subject/subject.routes';
import studentRoutes from './modules/student/student.routes';
import teacherRoutes from './modules/teacher/teacher.routes';
import mappingRoutes from './modules/mapping/mapping.routes';
import attendanceRoutes from './modules/attendance/attendance.routes';
import timetableRoutes from './modules/timetable/timetable.routes';

// Phase 4 modules
import syllabusRoutes from './modules/syllabus/syllabus.routes';
import curriculumRoutes from './modules/curriculum/curriculum.routes';
import calendarRoutes from './modules/calendar/calendar.routes';

// Phase 6 modules
import examRoutes, { gradeScaleRouter } from './modules/exam/exam.routes';

// Phase 7: Fee Management
import feeRoutes from './modules/fees/fees.routes';

// Phase 10: Communication System
import communicationRoutes from './modules/communication/communication.routes';

// Phase 11: Chat System
import chatRoutes from './modules/chat/chat.routes';
import { registerChatSocket } from './modules/chat/chat.socket';

dotenv.config();

const app  = express();
const port = process.env.PORT || 3001;

// ─── HTTP Server (wraps Express for Socket.IO) ───────────────────────────────
const httpServer = http.createServer(app);

// ─── Socket.IO Server ────────────────────────────────────────────────────────
const io = new SocketIOServer(httpServer, {
  cors: {
    origin:      process.env.FRONTEND_URL || 'http://localhost:3000',
    methods:     ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// Register /chat namespace with all event handlers
registerChatSocket(io);

// ─── Express Middleware ───────────────────────────────────────────────────────
app.use(cors({
  origin:      process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ─── Phase 1: Public routes ───────────────────────────────────────────────────
app.use('/api/tenants', tenantRoutes);
app.use('/api/auth', authRoutes);

// ─── Phase 1: Protected routes ───────────────────────────────────────────────
app.use('/api/users', userRoutes);

// ─── Phase 2: Academic routes ─────────────────────────────────────────────────
app.use('/api/classes', classRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/mappings', mappingRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/timetable', timetableRoutes);

// ─── Phase 4: Academic Management ────────────────────────────────────────────
app.use('/api/syllabus', syllabusRoutes);
app.use('/api/curriculum', curriculumRoutes);
app.use('/api/calendar', calendarRoutes);

// ─── Phase 6: Examination & Grades ───────────────────────────────────────────
app.use('/api/exams', examRoutes);
app.use('/api/grade-scales', gradeScaleRouter);

// ─── Phase 7: Fee Management ──────────────────────────────────────────────────
app.use('/api/fees', feeRoutes);

// ─── Phase 10: Communication System ──────────────────────────────────────────
app.use('/api/communication', communicationRoutes);

// ─── Phase 11: Chat System ────────────────────────────────────────────────────
app.use('/api/chat', chatRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'OK', message: 'SMS Backend Phase 1-11 running', socket: 'enabled' });
});

// ─── Start HTTP + WebSocket server ───────────────────────────────────────────
httpServer.listen(port, () => {
  console.log(`[server]: HTTP + Socket.IO running at http://localhost:${port}`);
  console.log(`[socket]: Chat namespace available at ws://localhost:${port}/chat`);
});
