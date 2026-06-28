'use client';

import {
  BarChart3,
  BookOpen,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  Settings,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Brand } from '../brand';
import { KnowledgeLibrary } from './knowledge-library';
import { firebaseAuth } from '../../lib/firebase';
import {
  listWorkspaces,
  readSupplineSession,
  revokeSupplineSession,
  type SessionUser,
  type WorkspaceSummary,
} from '../../lib/session';

const navItems = [
  { icon: LayoutDashboard, label: 'Overview' },
  { icon: Inbox, label: 'Inbox', badge: '0' },
  { icon: BookOpen, label: 'Knowledge' },
  { icon: Users, label: 'Team' },
  { icon: BarChart3, label: 'Analytics' },
];

export function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser>();
  const [workspace, setWorkspace] = useState<WorkspaceSummary>();
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('Overview');
  const [error, setError] = useState<string>();

  useEffect(() => {
    void (async () => {
      try {
        const session = await readSupplineSession();
        if (!session) {
          router.replace('/sign-in');
          return;
        }
        const workspaces = await listWorkspaces();
        if (!workspaces[0]) {
          router.replace('/onboarding');
          return;
        }
        setUser(session.user);
        setWorkspace(workspaces[0]);
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
        <div className="workspace-switcher">
          <span>{workspace.name.slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>{workspace.name}</strong>
            <small>{workspace.role}</small>
          </div>
        </div>
        <nav aria-label="Workspace navigation">
          {navItems.map(({ badge, icon: Icon, label }) => (
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
              {badge && <b>{badge}</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            className={activeSection === 'Settings' ? 'active' : ''}
            onClick={() => {
              setActiveSection('Settings');
              setMenuOpen(false);
            }}
            type="button"
          >
            <Settings size={18} />
            <span>Settings</span>
          </button>
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
              <h1>
                {activeSection === 'Overview'
                  ? `Good evening, ${user.displayName?.split(' ')[0] ?? 'there'}.`
                  : activeSection}
              </h1>
              <p>
                {activeSection === 'Overview'
                  ? 'Here’s the shape of your support operation today.'
                  : `Everything related to ${activeSection.toLowerCase()} in ${workspace.name}.`}
              </p>
            </div>
            {activeSection === 'Overview' && (
              <span className="date-chip">Today</span>
            )}
          </div>
          {activeSection === 'Overview' ? (
            <>
              <div className="metric-grid">
                <article>
                  <div>
                    <span>Open conversations</span>
                    <Inbox size={18} />
                  </div>
                  <strong>0</strong>
                  <p>Your queue is clear</p>
                </article>
                <article>
                  <div>
                    <span>AI-assisted replies</span>
                    <Sparkles size={18} />
                  </div>
                  <strong>0</strong>
                  <p>Starts after knowledge is added</p>
                </article>
                <article>
                  <div>
                    <span>Median response</span>
                    <MessageSquareText size={18} />
                  </div>
                  <strong>—</strong>
                  <p>No resolved conversations yet</p>
                </article>
              </div>
              <section className="setup-panel">
                <div className="setup-copy">
                  <span className="setup-kicker">Workspace setup</span>
                  <h2>Build the foundation for grounded support.</h2>
                  <p>
                    Suppline needs approved company knowledge before it can
                    prepare reliable answers.
                  </p>
                  <div className="setup-progress">
                    <span>
                      <b style={{ width: '33%' }} />
                    </span>
                    <small>1 of 3 complete</small>
                  </div>
                </div>
                <ol>
                  <li className="complete">
                    <span>1</span>
                    <div>
                      <strong>Create your workspace</strong>
                      <p>{workspace.name} is ready.</p>
                    </div>
                    <b>Done</b>
                  </li>
                  <li>
                    <span>2</span>
                    <div>
                      <strong>Add company knowledge</strong>
                      <p>Upload policies, help articles, or product notes.</p>
                    </div>
                  </li>
                  <li>
                    <span>3</span>
                    <div>
                      <strong>Connect your first channel</strong>
                      <p>Start with the web support widget.</p>
                    </div>
                  </li>
                </ol>
              </section>
              <section className="empty-activity">
                <span>
                  <BarChart3 size={22} />
                </span>
                <div>
                  <h2>Activity will appear here</h2>
                  <p>
                    Conversation volume, response time, and automation outcomes
                    begin tracking when your first channel is connected.
                  </p>
                </div>
              </section>
            </>
          ) : activeSection === 'Knowledge' ? (
            <KnowledgeLibrary
              canManage={
                workspace.role === 'owner' || workspace.role === 'admin'
              }
              workspaceId={workspace.id}
            />
          ) : (
            <SectionEmptyState
              section={activeSection}
              workspaceName={workspace.name}
            />
          )}
        </div>
      </section>
    </main>
  );
}

function SectionEmptyState({
  section,
  workspaceName,
}: {
  section: string;
  workspaceName: string;
}) {
  const content: Record<
    string,
    { body: string; icon: typeof Inbox; title: string }
  > = {
    Analytics: {
      body: 'Conversation volume, response times, and automation outcomes will appear after your team begins supporting customers.',
      icon: BarChart3,
      title: 'Not enough activity yet',
    },
    Inbox: {
      body: 'New customer conversations will arrive here once a support channel is connected.',
      icon: Inbox,
      title: 'Your inbox is clear',
    },
    Knowledge: {
      body: 'Approved policies, help articles, and product notes will become the evidence behind every grounded draft.',
      icon: BookOpen,
      title: 'Your knowledge library is empty',
    },
    Settings: {
      body: `${workspaceName} is active. Workspace identity, security, and channel preferences are managed here.`,
      icon: Settings,
      title: 'Workspace settings',
    },
    Team: {
      body: 'Invite and role management will appear here as your support team grows.',
      icon: Users,
      title: 'You are the first teammate',
    },
  };
  const selected = content[section] ?? {
    body: 'New customer conversations will arrive here once a support channel is connected.',
    icon: Inbox,
    title: 'Your inbox is clear',
  };
  const Icon = selected.icon;
  return (
    <section className="section-empty">
      <span>
        <Icon size={26} />
      </span>
      <h2>{selected.title}</h2>
      <p>{selected.body}</p>
    </section>
  );
}
