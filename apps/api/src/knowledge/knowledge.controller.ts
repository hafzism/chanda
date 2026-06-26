import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CurrentSession, SessionGuard } from '../auth/session.guard';
import type { SessionRecord } from '../auth/auth.types';
import {
  WorkspaceRoleGuard,
  WorkspaceRoles,
} from '../workspaces/workspace-role.guard';
import { CreateArticleDto } from './dto/create-article.dto';
import { SearchKnowledgeDto } from './dto/search-knowledge.dto';
import { SetDocumentEnabledDto } from './dto/set-document-enabled.dto';
import { KnowledgeService } from './knowledge.service';

@Controller('v1/workspaces/:workspaceId/knowledge')
@UseGuards(SessionGuard, WorkspaceRoleGuard)
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get()
  @WorkspaceRoles('owner', 'admin', 'agent', 'viewer')
  list(@Param('workspaceId', ParseUUIDPipe) workspaceId: string) {
    return this.knowledgeService.list(workspaceId);
  }

  @Post('articles')
  @WorkspaceRoles('owner', 'admin')
  createArticle(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @CurrentSession() session: SessionRecord,
    @Body() input: CreateArticleDto,
  ) {
    return this.knowledgeService.createArticle(
      workspaceId,
      session.user.id,
      input,
    );
  }

  @Post('search')
  @WorkspaceRoles('owner', 'admin', 'agent', 'viewer')
  search(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() input: SearchKnowledgeDto,
  ) {
    return this.knowledgeService.search(workspaceId, input);
  }

  @Patch(':documentId/enabled')
  @HttpCode(HttpStatus.NO_CONTENT)
  @WorkspaceRoles('owner', 'admin')
  async setEnabled(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body() input: SetDocumentEnabledDto,
  ): Promise<void> {
    await this.knowledgeService.setEnabled(
      workspaceId,
      documentId,
      input.isEnabled,
    );
  }

  @Delete(':documentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @WorkspaceRoles('owner', 'admin')
  deleteDocument(
    @Param('workspaceId', new ParseUUIDPipe()) workspaceId: string,
    @Param('documentId', new ParseUUIDPipe()) documentId: string,
  ): Promise<void> {
    return this.knowledgeService.deleteDocument(workspaceId, documentId);
  }
}
