import { Router } from 'express';
import {
  getConversations, getConversation, startConversation,
  getMessages, sendMessage,
  markMessageRead, markConversationRead, getUnreadCount,
} from './chat.controller';
import { tenantMiddleware } from '../../middlewares/tenant.middleware';
import { authMiddleware }   from '../../middlewares/auth.middleware';

const router = Router();
router.use(tenantMiddleware, authMiddleware);

// ─── Conversations ───────────────────────────────────────────────────────────
router.get('/',           getConversations);
router.post('/',          startConversation);
router.get('/unread',     getUnreadCount);
router.get('/:id',        getConversation);
router.patch('/:id/read', markConversationRead);

// ─── Messages ────────────────────────────────────────────────────────────────
router.get('/:conversationId/messages',   getMessages);
router.post('/messages',                  sendMessage);
router.patch('/messages/:id/read',        markMessageRead);

export default router;
