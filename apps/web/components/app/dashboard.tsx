'use client';

import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { firebaseAuth } from '../../lib/firebase';
import { readLastWorkspaceId, saveLastWorkspaceId } from '../../lib/product';
import {
  listWorkspaces,
  readSession,
  revokeSession,
  type SessionUser,
  type WorkspaceSummary,
} from '../../lib/session';
import { Brand } from '../brand';
import { isAppSection, type AppSection } from './app-navigation';
import { WorkspaceApplication } from './workspace-application';

export function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser>();
  const [workspace, setWorkspace] = useState<WorkspaceSummary>();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [activeSection, setActiveSection] = useState<AppSection>('Inbox');
  const [error, setError] = useState<string>();

  useEffect(() => {
    const syncSectionFromUrl = () => {
      const requestedSection = new URLSearchParams(window.location.search).get(
        'section',
      );
      setActiveSection(
        isAppSection(requestedSection) ? requestedSection : 'Inbox',
      );
    };
    syncSectionFromUrl();
    window.addEventListener('popstate', syncSectionFromUrl);

    let active = true;
    void (async () => {
      try {
        const session = await readSession();
        if (!active) return;
        if (!session) {
          router.replace('/sign-in');
          return;
        }

        const availableWorkspaces = await listWorkspaces();
        if (!active) return;
        if (!availableWorkspaces[0]) {
          router.replace('/onboarding');
          return;
        }

        const preferredWorkspaceId = readLastWorkspaceId();
        const selectedWorkspace =
          availableWorkspaces.find(
            (item) => item.id === preferredWorkspaceId,
          ) ?? availableWorkspaces[0];
        setUser(session.user);
        setWorkspaces(availableWorkspaces);
        setWorkspace(selectedWorkspace);
      } catch (caught: unknown) {
        if (!active) return;
        setError(
          caught instanceof Error
            ? caught.message
            : 'Unable to load the workspace.',
        );
      }
    })();

    return () => {
      active = false;
      window.removeEventListener('popstate', syncSectionFromUrl);
    };
  }, [router]);

  async function logout() {
    await Promise.allSettled([revokeSession(), signOut(firebaseAuth())]);
    router.replace('/sign-in');
    router.refresh();
  }

  function changeSection(section: AppSection) {
    setActiveSection(section);
    const url = new URL(window.location.href);
    if (section === 'Inbox') url.searchParams.delete('section');
    else url.searchParams.set('section', section);
    window.history.pushState(null, '', url);
  }

  function changeWorkspace(nextWorkspace: WorkspaceSummary) {
    saveLastWorkspaceId(nextWorkspace.id);
    setWorkspace(nextWorkspace);
  }

  if (error) {
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
  }

  if (!user || !workspace) {
    return (
      <main className="route-loader" aria-live="polite">
        <span className="brand-mark" aria-hidden="true" />
        <p>Opening Chanda AI…</p>
      </main>
    );
  }

  return (
    <WorkspaceApplication
      activeSection={activeSection}
      onLogout={logout}
      onSectionChange={changeSection}
      onWorkspaceChange={changeWorkspace}
      user={user}
      workspace={workspace}
      workspaces={workspaces}
    />
  );
}
