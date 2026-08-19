'use client';

import { LogOut, Menu, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { SessionUser, WorkspaceSummary } from '../../lib/session';
import { Brand } from '../brand';
import { AiProviderPanel } from './ai-provider-panel';
import {
  APP_NAVIGATION,
  sectionDescription,
  type AppSection,
} from './app-navigation';
import { AnalyticsPanel } from './analytics-panel';
import { BillingPanel } from './billing-panel';
import { ChannelsPanel } from './channels-panel';
import { InboxPanel } from './inbox-panel';
import { KnowledgeLibrary } from './knowledge-library';
import { TeamPanel } from './team-panel';

interface WorkspaceApplicationProps {
  activeSection: AppSection;
  onLogout: () => Promise<void>;
  onSectionChange: (section: AppSection) => void;
  onWorkspaceChange: (workspace: WorkspaceSummary) => void;
  user: SessionUser;
  workspace: WorkspaceSummary;
  workspaces: readonly WorkspaceSummary[];
}

export function WorkspaceApplication({
  activeSection,
  onLogout,
  onSectionChange,
  onWorkspaceChange,
  user,
  workspace,
  workspaces,
}: WorkspaceApplicationProps) {
  const [navigationOpen, setNavigationOpen] = useState(false);
  const openNavigationButton = useRef<HTMLButtonElement>(null);
  const closeNavigationButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!navigationOpen) return;
    closeNavigationButton.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setNavigationOpen(false);
      openNavigationButton.current?.focus();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [navigationOpen]);

  const canManageWorkspace =
    workspace.role === 'owner' || workspace.role === 'admin';

  return (
    <div className="app-frame">
      <a className="skip-link" href="#workspace-content">
        Skip to workspace content
      </a>
      <aside
        aria-label="Workspace navigation"
        className={`app-sidebar ${navigationOpen ? 'open' : ''}`}
      >
        <div className="sidebar-brand">
          <Brand />
          <button
            aria-label="Close navigation"
            onClick={() => {
              setNavigationOpen(false);
              openNavigationButton.current?.focus();
            }}
            ref={closeNavigationButton}
            type="button"
          >
            <X aria-hidden="true" size={20} />
          </button>
        </div>

        <label className="workspace-switcher">
          <span aria-hidden="true">
            {workspace.name.slice(0, 1).toUpperCase()}
          </span>
          <span>
            <span className="sr-only">Current workspace</span>
            <select
              aria-label="Current workspace"
              onChange={(event) => {
                const selectedWorkspace = workspaces.find(
                  (item) => item.id === event.target.value,
                );
                if (selectedWorkspace) onWorkspaceChange(selectedWorkspace);
              }}
              value={workspace.id}
            >
              {workspaces.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <small>{workspace.role}</small>
          </span>
        </label>

        <nav aria-label="Sections">
          {APP_NAVIGATION.map(({ icon: Icon, label }) => (
            <button
              aria-current={activeSection === label ? 'page' : undefined}
              className={activeSection === label ? 'active' : ''}
              key={label}
              onClick={() => {
                onSectionChange(label);
                setNavigationOpen(false);
              }}
              type="button"
            >
              <Icon aria-hidden="true" size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button onClick={() => void onLogout()} type="button">
            <LogOut aria-hidden="true" size={18} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {navigationOpen && (
        <button
          aria-label="Close navigation overlay"
          className="sidebar-overlay"
          onClick={() => {
            setNavigationOpen(false);
            openNavigationButton.current?.focus();
          }}
          type="button"
        />
      )}

      <main className="app-main" id="workspace-content" tabIndex={-1}>
        <header className="app-topbar">
          <button
            aria-expanded={navigationOpen}
            aria-label="Open navigation"
            className="menu-button"
            onClick={() => setNavigationOpen(true)}
            ref={openNavigationButton}
            type="button"
          >
            <Menu aria-hidden="true" size={21} />
          </button>
          <div className="workspace-context">
            <span>Workspace</span>
            <strong>{workspace.name}</strong>
          </div>
          <div className="user-summary">
            <span aria-hidden="true">
              {(user.displayName ?? user.email).slice(0, 1).toUpperCase()}
            </span>
            <div>
              <strong>{user.displayName ?? user.email.split('@')[0]}</strong>
              <small>{user.email}</small>
            </div>
          </div>
        </header>

        <div className="dashboard-content">
          <header className="dashboard-heading">
            <div>
              <h1>{activeSection}</h1>
              <p>{sectionDescription(activeSection)}</p>
            </div>
          </header>

          {activeSection === 'Inbox' ? (
            <InboxPanel
              canManage={workspace.role !== 'viewer'}
              workspaceId={workspace.id}
            />
          ) : activeSection === 'Knowledge' ? (
            <KnowledgeLibrary
              canManage={canManageWorkspace}
              workspaceId={workspace.id}
            />
          ) : activeSection === 'Channels' ? (
            <ChannelsPanel
              canManage={canManageWorkspace}
              canOperate={workspace.role !== 'viewer'}
              workspaceId={workspace.id}
            />
          ) : activeSection === 'Team' ? (
            <TeamPanel
              currentUserId={user.id}
              role={workspace.role}
              workspaceId={workspace.id}
            />
          ) : activeSection === 'Analytics' ? (
            <AnalyticsPanel
              canManage={canManageWorkspace}
              workspaceId={workspace.id}
            />
          ) : activeSection === 'AI provider' ? (
            <AiProviderPanel
              canManage={canManageWorkspace}
              workspaceId={workspace.id}
            />
          ) : activeSection === 'Billing' ? (
            <BillingPanel
              isOwner={workspace.role === 'owner'}
              workspaceId={workspace.id}
            />
          ) : null}
        </div>
      </main>
    </div>
  );
}
