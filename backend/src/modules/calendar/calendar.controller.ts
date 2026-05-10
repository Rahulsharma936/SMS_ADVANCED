import { Response } from 'express';
import { prisma } from '../../prisma/client';
import { TenantRequest } from '../../middlewares/tenant.middleware';

// ─── Create Event ───

export const createEvent = async (req: TenantRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const { title, description, type, start_date, end_date, class_id } = req.body;

    if (!title || !type || !start_date || !end_date) {
      res.status(400).json({ error: 'title, type, start_date, and end_date are required' });
      return;
    }

    const validTypes = ['holiday', 'exam', 'event', 'meeting'];
    if (!validTypes.includes(type)) {
      res.status(400).json({ error: `type must be one of: ${validTypes.join(', ')}` });
      return;
    }

    const event = await prisma.academicEvent.create({
      data: {
        tenant_id: tenantId,
        title,
        description: description || null,
        type,
        start_date: new Date(start_date),
        end_date: new Date(end_date),
        class_id: class_id || null,
      },
      include: { class: { select: { name: true } } },
    });

    res.status(201).json({ message: 'Event created', event });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ─── Get Events ───

export const getEvents = async (req: TenantRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const { type, class_id, month, year } = req.query;

    const where: any = { tenant_id: tenantId };
    if (type) where.type = type;

    // Show school-wide events + class-specific events
    if (class_id) {
      where.OR = [{ class_id: null }, { class_id: class_id }];
    }

    // Filter by month/year
    if (month && year) {
      const m = parseInt(month as string) - 1;
      const y = parseInt(year as string);
      const start = new Date(y, m, 1);
      const end = new Date(y, m + 1, 0, 23, 59, 59);
      where.start_date = { lte: end };
      where.end_date = { gte: start };
    }

    const events = await prisma.academicEvent.findMany({
      where,
      include: { class: { select: { name: true } } },
      orderBy: { start_date: 'asc' },
    });

    res.status(200).json({ events });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ─── Update Event ───

export const updateEvent = async (req: TenantRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const existing = await prisma.academicEvent.findFirst({ where: { id: req.params.id, tenant_id: tenantId } });
    if (!existing) { res.status(404).json({ error: 'Event not found' }); return; }

    const data: any = {};
    ['title', 'description', 'type', 'class_id'].forEach((f) => { if (req.body[f] !== undefined) data[f] = req.body[f]; });
    if (req.body.start_date) data.start_date = new Date(req.body.start_date);
    if (req.body.end_date) data.end_date = new Date(req.body.end_date);

    const updated = await prisma.academicEvent.update({ where: { id: req.params.id }, data });
    res.status(200).json({ message: 'Event updated', event: updated });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ─── Delete Event ───

export const deleteEvent = async (req: TenantRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const existing = await prisma.academicEvent.findFirst({ where: { id: req.params.id, tenant_id: tenantId } });
    if (!existing) { res.status(404).json({ error: 'Event not found' }); return; }

    await prisma.academicEvent.delete({ where: { id: req.params.id } });
    res.status(200).json({ message: 'Event deleted' });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
