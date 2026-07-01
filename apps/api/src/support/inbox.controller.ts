import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import type { SessionRecord } from '../auth/auth.types';
import { CurrentSession, SessionGuard } from '../auth/session.guard';
import {
  WorkspaceRoleGuard,
  WorkspaceRoles,
} from '../workspaces/workspace-role.guard';
import { AiDraftService } from './ai-draft.service';
import { CreateInboxNoteDto } from './dto/create-inbox-note.dto';
import { CreateInboxReplyDto } from './dto/create-inbox-reply.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { SupportService } from './support.service';

@Controller('v1/workspaces/:workspaceId/inbox')
@UseGuards(SessionGuard, WorkspaceRoleGuard)
@WorkspaceRoles('owner', 'admin', 'agent', 'viewer')
export class InboxController {
  constructor(
    private readonly support: SupportService,
    private readonly aiDrafts: AiDraftService,
  ) {}

  @Get()
  list(@Param('workspaceId', ParseUUIDPipe) workspaceId: string) {
    return this.support.listInbox(workspaceId);
  }

  @Get(':conversationId')
  getConversation(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
  ) {
    return this.support.getInboxConversation(workspaceId, conversationId);
  }

  @Patch(':conversationId/ticket')
  @WorkspaceRoles('owner', 'admin', 'agent')
  updateTicket(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body() input: UpdateTicketDto,
  ) {
    return this.support.updateTicket(workspaceId, conversationId, input);
  }

  @Post(':conversationId/notes')
  @WorkspaceRoles('owner', 'admin', 'agent')
  addNote(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @CurrentSession() session: SessionRecord,
    @Body() input: CreateInboxNoteDto,
  ) {
    return this.support.addInboxNote(
      workspaceId,
      conversationId,
      session.user.id,
      input.body,
    );
  }

  @Post(':conversationId/replies')
  @WorkspaceRoles('owner', 'admin', 'agent')
  reply(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @CurrentSession() session: SessionRecord,
    @Body() input: CreateInboxReplyDto,
  ) {
    return this.support.sendInboxReply(
      workspaceId,
      conversationId,
      session.user.id,
      input.body,
      input.draftId,
    );
  }

  @Post(':conversationId/ai-draft')
  @WorkspaceRoles('owner', 'admin', 'agent')
  generateAiDraft(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @CurrentSession() session: SessionRecord,
  ) {
    return this.aiDrafts.generate(workspaceId, conversationId, session.user.id);
  }
}
