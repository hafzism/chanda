'use client';

import {
  BookOpen,
  ChartNoAxesColumnIncreasing,
  CreditCard,
  Globe2,
  Inbox,
  LogOut,
  Menu,
  UsersRound,
  X,
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Brand } from '../brand';
import { AnalyticsPanel } from './analytics-panel';
import { BillingPanel } from './billing-panel';
import { ChannelsPanel } from './channels-panel';
import { InboxPanel } from './inbox-panel';
import { KnowledgeLibrary } from './knowledge-library';
import { TeamPanel } from './team-panel';
import { firebaseAuth } from '../../lib/firebase';
import {
  listWorkspaces,
  readSupplineSession,
  revokeSupplineSession,
  type SessionUser,
  type WorkspaceSummary,
} from '../../lib/session';

const navItems = [
  { icon: Inbox, label: 'Inbox' },
  { icon: BookOpen, label: 'Knowledge' },
  { icon: Globe2, label: 'Channels' },
  { icon: UsersRound, label: 'Team' },
  { icon: ChartNoAxesColumnIncreasing, label: 'Analytics' },
  { icon: CreditCard, label: 'Billing' },
];

export function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser>();
  const [workspace, setWorkspace] = useState<WorkspaceSummary>();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('Inbox');
  const [error, setError] = useState<string>();

  useEffect(() => {
    const requestedSection = new URLSearchParams(window.location.search).get(
      'section',
    );
    if (navItems.some(({ label }) => label === requestedSection)) {
      setActiveSection(requestedSection ?? 'Inbox');
    }
    void (async () => {
      try {
        const session = await readSupplineSession();
        if (!session) {
          router.replace('/sign-in');
          return;
        }
        const availableWorkspaces = await listWorkspaces();
        if (!availableWorkspaces[0]) {
          router.replace('/onboarding');
          return;
        }
        const preferredWorkspaceId = window.localStorage.getItem(
          'suppline:last-workspace-id',
        );
        const selectedWorkspace =
          availableWorkspaces.find(
            (item) => item.id === preferredWorkspaceId,
          ) ?? availableWorkspaces[0];
        setUser(session.user);
        setWorkspaces(availableWorkspaces);
        setWorkspace(selectedWorkspace);
      } catch (caught: unknown) {
        setError(
          caught instanceof Error
            ? caught.message
            : 'Unable to load the workspace.',
        );
      }
    })();
  }, [router]);

  async function logout() {
    await Promise.allSettled([
      revokeSupplineSession(),
      signOut(firebaseAuth()),
    ]);
    router.replace('/sign-in');
    router.refresh();
  }

  if (error)
    return (
      <main className="route-error">
        <Brand />
        <h1>We couldn’t open your workspace.</h1>
        <p>{error}</p>
        <button
          className="button primary-button"
          onClick={() => window.location.reload()}
          type="button"
        >
          Try again
        </button>
      </main>
    );
  if (!user || !workspace)
    return (
      <main className="route-loader">
        <span className="brand-mark" />
        <p>Opening Suppline AI…</p>
      </main>
    );

  return (
    <main className="app-frame">
      <aside className={`app-sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <Brand />
          <button
            aria-label="Close navigation"
            onClick={() => setMenuOpen(false)}
            type="button"
          >
            <X size={20} />
          </button>
        </div>
        <label className="workspace-switcher">
          <span>{workspace.name.slice(0, 1).toUpperCase()}</span>
          <div>
            <select
              aria-label="Current workspace"
              onChange={(event) => {
                const selected = workspaces.find(
                  (item) => item.id === event.target.value,
                );
                if (!selected) return;
                window.localStorage.setItem(
                  'suppline:last-workspace-id',
                  selected.id,
                );
                setWorkspace(selected);
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
          </div>
        </label>
        <nav aria-label="Workspace navigation">
          {navItems.map(({ icon: Icon, label }) => (
            <button
              className={activeSection === label ? 'active' : ''}
              key={label}
              onClick={() => {
                setActiveSection(label);
                setMenuOpen(false);
              }}
              type="button"
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button onClick={() => void logout()} type="button">
            <LogOut size={18} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>
      {menuOpen && (
        <button
          aria-label="Close navigation overlay"
          className="sidebar-overlay"
          onClick={() => setMenuOpen(false)}
          type="button"
        />
      )}

      <section className="app-main">
        <header className="app-topbar">
          <button
            aria-label="Open navigation"
            className="menu-button"
            onClick={() => setMenuOpen(true)}
            type="button"
          >
            <Menu size={21} />
          </button>
          <div>
            <span className="topbar-label">Workspace</span>
            <strong>{workspace.name}</strong>
          </div>
          <div className="user-menu">
            <span>
              {(user.displayName ?? user.email).slice(0, 1).toUpperCase()}
            </span>
            <div>
              <strong>{user.displayName ?? user.email.split('@')[0]}</strong>
              <small>{user.email}</small>
            </div>
          </div>
        </header>
        <div className="dashboard-content">
          <div className="dashboard-heading">
            <div>
              <p className="eyebrow">{activeSection}</p>
              <h1>{activeSection}</h1>
              <p>
                {activeSection === 'Inbox'
                  ? `Review customer conversations and ticket history for ${workspace.name}.`
                  : activeSection === 'Knowledge'
                    ? `Manage the approved evidence Suppline can use for ${workspace.name}.`
                    : activeSection === 'Channels'
                      ? `Control which websites can send support messages to ${workspace.name}.`
                      : activeSection === 'Team'
                        ? `Manage who can access ${workspace.name} and what each role can do.`
                        : activeSection === 'Billing'
                          ? `Review the plan and Stripe subscription for ${workspace.name}.`
                          : `Review ticket operations and human-controlled AI draft outcomes for ${workspace.name}.`}
              </p>
            </div>
          </div>
          {activeSection === 'Inbox' ? (
            <InboxPanel
              canManage={workspace.role !== 'viewer'}
              workspaceId={workspace.id}
            />
          ) : activeSection === 'Knowledge' ? (
            <KnowledgeLibrary
              canManage={
                workspace.role === 'owner' || workspace.role === 'admin'
              }
              workspaceId={workspace.id}
            />
          ) : activeSection === 'Channels' ? (
            <ChannelsPanel
              canManage={
                workspace.role === 'owner' || workspace.role === 'admin'
              }
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
              canManage={
                workspace.role === 'owner' || workspace.role === 'admin'
              }
              workspaceId={workspace.id}
            />
          ) : activeSection === 'Billing' ? (
            <BillingPanel
              isOwner={workspace.role === 'owner'}
              workspaceId={workspace.id}
            />
          ) : null}
        </div>
      </section>
    </main>
  );
}
