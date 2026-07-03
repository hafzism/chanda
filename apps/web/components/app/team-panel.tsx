'use client';

import {
  Check,
  Copy,
  Link2,
  LoaderCircle,
  MailPlus,
  RefreshCw,
  Trash2,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';

import {
  createInvitation,
  listTeam,
  removeMember,
  revokeInvitation,
  updateMemberRole,
  type TeamOverview,
  type WorkspaceRole,
} from '../../lib/team';

interface TeamPanelProps {
  currentUserId: string;
  role: WorkspaceRole;
  workspaceId: string;
}

const roleDescription: Record<WorkspaceRole, string> = {
  admin: 'Manages knowledge, channels, invitations, and support work.',
  agent: 'Handles tickets, replies, notes, and AI-assisted drafts.',
  owner: 'Controls the workspace and all team permissions.',
  viewer: 'Can inspect workspace data without making changes.',
};

export function TeamPanel({
  currentUserId,
  role,
  workspaceId,
}: TeamPanelProps) {
  const [team, setTeam] = useState<TeamOverview>();
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] =
    useState<Exclude<WorkspaceRole, 'owner'>>('agent');
  const [inviteLink, setInviteLink] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [busyKey, setBusyKey] = useState<string>();
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState<string>();
  const canManage = role === 'owner' || role === 'admin';

  async function load() {
    setError(undefined);
    try {
      setTeam(await listTeam(workspaceId));
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : 'Unable to load the team.',
      );
    }
  }

  useEffect(() => {
    setTeam(undefined);
    setInviteLink(undefined);
    void load();
  }, [workspaceId]);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyKey('invite');
    setError(undefined);
    setSuccess(undefined);
    try {
      const invitation = await createInvitation(workspaceId, {
        email: email.trim(),
        role: inviteRole,
      });
      setInviteLink(`${window.location.origin}/invite/${invitation.token}`);
      setEmail('');
      setSuccess(
        'Invitation created. Copy the private link and send it to the invitee.',
      );
      await load();
    } catch (caught: unknown) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to create the invitation.',
      );
    } finally {
      setBusyKey(undefined);
    }
  }

  async function copyLink() {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError(
        'Clipboard access is unavailable. Select and copy the link manually.',
      );
    }
  }

  async function mutate(
    key: string,
    action: () => Promise<void>,
    message: string,
  ) {
    setBusyKey(key);
    setError(undefined);
    setSuccess(undefined);
    try {
      await action();
      setSuccess(message);
      await load();
    } catch (caught: unknown) {
      setError(
        caught instanceof Error ? caught.message : 'Unable to update the team.',
      );
    } finally {
      setBusyKey(undefined);
    }
  }

  if (!team && !error) {
    return (
      <div className="team-state" role="status">
        <LoaderCircle className="spin" size={24} />
        <p>Loading workspace members…</p>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="team-state error-state">
        <UsersRound size={28} />
        <h2>We couldn’t load the team.</h2>
        <p>{error}</p>
        <button
          className="button secondary-button"
          onClick={() => void load()}
          type="button"
        >
          <RefreshCw size={16} /> Try again
        </button>
      </div>
    );
  }

  return (
    <div className="team-panel">
      {canManage && (
        <section className="team-invite-card">
          <div className="team-section-heading">
            <span>
              <MailPlus size={19} />
            </span>
            <div>
              <h2>Invite a teammate</h2>
              <p>
                Create a seven-day, one-time link for a verified email address.
              </p>
            </div>
          </div>
          <form onSubmit={(event) => void invite(event)}>
            <label>
              Work email
              <input
                autoComplete="email"
                disabled={busyKey === 'invite'}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="teammate@company.com"
                required
                type="email"
                value={email}
              />
            </label>
            <label>
              Role
              <select
                disabled={busyKey === 'invite'}
                onChange={(event) =>
                  setInviteRole(
                    event.target.value as Exclude<WorkspaceRole, 'owner'>,
                  )
                }
                value={inviteRole}
              >
                {role === 'owner' && <option value="admin">Admin</option>}
                <option value="agent">Agent</option>
                <option value="viewer">Viewer</option>
              </select>
            </label>
            <button
              className="button primary-button"
              disabled={busyKey === 'invite'}
              type="submit"
            >
              {busyKey === 'invite' ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <Link2 size={16} />
              )}
              Create invite link
            </button>
          </form>
          {inviteLink && (
            <div className="invite-link-result">
              <div>
                <strong>Copy this link now</strong>
                <small>
                  For security, Suppline cannot show the raw token again after
                  this page reloads.
                </small>
              </div>
              <input
                aria-label="Invitation link"
                onFocus={(event) => event.currentTarget.select()}
                readOnly
                value={inviteLink}
              />
              <button
                className="button secondary-button"
                onClick={() => void copyLink()}
                type="button"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Copied' : 'Copy link'}
              </button>
            </div>
          )}
        </section>
      )}

      {(error || success) && (
        <p
          className={`team-message ${error ? 'error' : 'success'}`}
          role="status"
        >
          {error ?? success}
        </p>
      )}

      <section className="team-list-card">
        <div className="team-section-heading">
          <span>
            <UsersRound size={19} />
          </span>
          <div>
            <h2>Members</h2>
            <p>
              {team.members.length}{' '}
              {team.members.length === 1 ? 'person' : 'people'} in this
              workspace
            </p>
          </div>
        </div>
        <div className="team-member-list">
          {team.members.map((member) => {
            const canRemove =
              canManage &&
              member.role !== 'owner' &&
              member.userId !== currentUserId &&
              !(role === 'admin' && member.role === 'admin');
            return (
              <article key={member.userId}>
                <span className="member-avatar">
                  <UserRound size={18} />
                </span>
                <div className="member-copy">
                  <strong>
                    {member.displayName ?? member.email.split('@')[0]}
                  </strong>
                  <small>
                    {member.email}
                    {member.userId === currentUserId ? ' · You' : ''}
                  </small>
                  <p>{roleDescription[member.role]}</p>
                </div>
                <div className="member-actions">
                  {role === 'owner' && member.role !== 'owner' ? (
                    <select
                      aria-label={`Role for ${member.email}`}
                      disabled={busyKey === member.userId}
                      onChange={(event) =>
                        void mutate(
                          member.userId,
                          () =>
                            updateMemberRole(
                              workspaceId,
                              member.userId,
                              event.target.value as Exclude<
                                WorkspaceRole,
                                'owner'
                              >,
                            ).then(() => undefined),
                          `${member.email} is now ${event.target.value}.`,
                        )
                      }
                      value={member.role}
                    >
                      <option value="admin">Admin</option>
                      <option value="agent">Agent</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  ) : (
                    <span className={`role-chip ${member.role}`}>
                      {member.role}
                    </span>
                  )}
                  {canRemove && (
                    <button
                      aria-label={`Remove ${member.email}`}
                      disabled={busyKey === member.userId}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Remove ${member.email} from this workspace?`,
                          )
                        ) {
                          void mutate(
                            member.userId,
                            () => removeMember(workspaceId, member.userId),
                            `${member.email} was removed.`,
                          );
                        }
                      }}
                      type="button"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {canManage && team.invitations.length > 0 && (
        <section className="team-list-card">
          <div className="team-section-heading">
            <span>
              <MailPlus size={19} />
            </span>
            <div>
              <h2>Pending invitations</h2>
              <p>Unaccepted links expire automatically after seven days.</p>
            </div>
          </div>
          <div className="pending-invite-list">
            {team.invitations.map((invitation) => {
              const canRevoke = role === 'owner' || invitation.role !== 'admin';
              return (
                <article key={invitation.id}>
                  <div>
                    <strong>{invitation.email}</strong>
                    <small>
                      {invitation.role} · Expires{' '}
                      {new Date(invitation.expiresAt).toLocaleDateString()}
                    </small>
                  </div>
                  {canRevoke && (
                    <button
                      className="button text-button"
                      disabled={busyKey === invitation.id}
                      onClick={() =>
                        void mutate(
                          invitation.id,
                          () => revokeInvitation(workspaceId, invitation.id),
                          `Invitation for ${invitation.email} was revoked.`,
                        )
                      }
                      type="button"
                    >
                      Revoke
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
