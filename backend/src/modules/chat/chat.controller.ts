import { Response } from 'express';
import { TenantRequest } from '../../middlewares/tenant.middleware';
import * as chatService from './chat.service';

const handle = (res: Response, err: any) => {
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error('[ChatController]', err);
  return res.status(500).json({ error: 'Internal Server Error' });
};

// ─── Conversations ────────────────────────────────────────────────────────────

export const getConversations = async (req: TenantRequest, res: Response) => {
  try {
    const data = await chatService.getMyConversations(req.tenantId!, req.user!.id);
    res.status(200).json({ conversations: data });
  } catch (err: any) { handle(res, err); }
};

export const getConversation = async (req: TenantRequest, res: Response) => {
  try {
    const conv = await chatService.getConversation(req.tenantId!, req.user!.id, req.params.id);
    res.status(200).json({ conversation: conv });
  } catch (err: any) { handle(res, err); }
};

export const startConversation = async (req: TenantRequest, res: Response) => {
  try {
    const { target_user_id } = req.body;
    if (!target_user_id) { res.status(400).json({ error: 'target_user_id is required' }); return; }
    const conv = await chatService.getOrCreateDirectConversation(
      req.tenantId!, req.user!.id, req.user!.role?.name ?? req.user!.role, target_user_id
    );
    res.status(201).json({ conversation: conv });
  } catch (err: any) { handle(res, err); }
};

// ─── Messages ────────────────────────────────────────────────────────────────

export const getMessages = async (req: TenantRequest, res: Response) => {
  try {
    const { cursor, limit } = req.query;
    const data = await chatService.getMessages(
      req.tenantId!, req.user!.id, req.params.conversationId,
      cursor as string, limit ? parseInt(limit as string) : undefined
    );
    res.status(200).json(data);
  } catch (err: any) { handle(res, err); }
};

export const sendMessage = async (req: TenantRequest, res: Response) => {
  try {
    const { conversation_id, content, message_type } = req.body;
    if (!conversation_id || !content) {
      res.status(400).json({ error: 'conversation_id and content are required' }); return;
    }
    const msg = await chatService.sendMessage(
      req.tenantId!, req.user!.id, conversation_id, content, message_type
    );
    res.status(201).json({ message: msg });
  } catch (err: any) { handle(res, err); }
};

export const markMessageRead = async (req: TenantRequest, res: Response) => {
  try {
    const result = await chatService.markMessageRead(req.tenantId!, req.user!.id, req.params.id);
    res.status(200).json({ read_status: 'read', ...result });
  } catch (err: any) { handle(res, err); }
};

export const markConversationRead = async (req: TenantRequest, res: Response) => {
  try {
    const result = await chatService.markConversationRead(req.tenantId!, req.user!.id, req.params.id);
    res.status(200).json(result);
  } catch (err: any) { handle(res, err); }
};

export const getUnreadCount = async (req: TenantRequest, res: Response) => {
  try {
    const data = await chatService.getUnreadCount(req.tenantId!, req.user!.id);
    res.status(200).json(data);
  } catch (err: any) { handle(res, err); }
};
