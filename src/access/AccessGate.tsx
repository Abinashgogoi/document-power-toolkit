import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Ban, Check, Clock3, LoaderCircle, LockKeyhole, LogIn, LogOut, RefreshCw,
  ShieldCheck, UserPlus, XCircle,
} from 'lucide-react';
import { getCloudIdentity, onAuthChange, signIn, signOut, signUp } from '../backend/supabase/auth';
import { supabase } from '../backend/supabase/client';
import { supabaseConfigured } from '../backend/supabase/config';
import type { AccountRole, AccountStatus, ProfileRow } from '../backend/supabase/database.types';
import { getLocalProfile, saveLocalProfile } from '../lib/history';
import { errorMessage } from '../lib/verification';
import './access-gate.css';

type AuthMode = 'signin' | 'signup';

interface IdentityState {
  userId: string | null;
  email: string;
  profile: ProfileRow | null;
}

const EMPTY_IDENTITY: IdentityState = { userId: null, email: '', profile: null };

const e2eBypass = import.meta.env.VITE_E2E_BYPASS === '1'
  && typeof window !== 'undefined'
  && (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost');

export default function AccessGate({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<IdentityState>(EMPTY_IDENTITY);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [adminOpen, setAdminOpen] = useState(false);
  const refreshIdentity = useCallback(async () => {
    if (!supabaseConfigured) {
      setIdentity(EMPTY_IDENTITY);
      setLoading(false);
      return;
    }

    try {
      const next = await getCloudIdentity();
      const nextIdentity: IdentityState = {
        userId: next.user?.id ?? null,
        email: next.user?.email ?? '',
        profile: next.profile,
      };
      setIdentity(nextIdentity);

      if (next.profile?.status === 'approved') {
        const local = await getLocalProfile();
        const desiredName = next.profile.display_name.trim() || 'User';
        const desiredEmail = next.profile.email ?? next.user?.email ?? '';
        if (local.name !== desiredName || local.email !== desiredEmail) {
          await saveLocalProfile({ ...local, name: desiredName, email: desiredEmail });
        }
      }
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshIdentity();
    const stop = onAuthChange(() => void refreshIdentity());
    return stop;
  }, [refreshIdentity]);

  useEffect(() => {
    const client = supabase;
    if (!client || !identity.userId) return;
    const channel = client
      .channel(`access-gate:${identity.userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${identity.userId}` },
        () => void refreshIdentity(),
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [identity.userId, refreshIdentity]);

  const isAdmin = identity.profile?.status === 'approved'
    && (identity.profile.role === 'admin' || identity.profile.role === 'super_admin');

  async function handleSignOut() {
    setBusy(true);
    setError('');
    try {
      await signOut();
      setIdentity(EMPTY_IDENTITY);
      setAdminOpen(false);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  if (e2eBypass) return <>{children}</>;

  if (!supabaseConfigured) {
    return (
      <GateShell>
        <StatusCard
          icon={<XCircle size={28} />}
          title="Authentication service unavailable"
          text="Document Toolkit is not configured with its production authentication backend. Tool access is blocked for safety."
          tone="danger"
        />
      </GateShell>
    );
  }

  if (loading) {
    return (
      <GateShell>
        <StatusCard
          icon={<LoaderCircle className="gate-spin" size={28} />}
          title="Checking access"
          text="Verifying your account and approval status…"
          tone="neutral"
        />
      </GateShell>
    );
  }

  if (!identity.userId) {
    return (
      <GateShell>
        <AuthCard
          mode={authMode}
          busy={busy}
          error={error}
          message={message}
          onModeChange={(next) => {
            setAuthMode(next);
            setError('');
            setMessage('');
          }}
          onSubmit={async ({ displayName, email, password }) => {
            setBusy(true);
            setError('');
            setMessage('');
            try {
              if (authMode === 'signin') {
                await signIn(email, password);
                await refreshIdentity();
              } else {
                const cleanName = displayName.trim();
                if (cleanName.length < 2) throw new Error('Enter your display name.');
                if (password.length < 8) throw new Error('Password must contain at least 8 characters.');
                const result = await signUp(email.trim(), password, cleanName);
                if (result.session) {
                  await refreshIdentity();
                } else {
                  setAuthMode('signin');
                  setMessage('Account created. If email confirmation is enabled, confirm your email first, then sign in. Access stays pending until an administrator approves it.');
                }
              }
            } catch (caught) {
              setError(errorMessage(caught));
            } finally {
              setBusy(false);
            }
          }}
        />
      </GateShell>
    );
  }

  if (!identity.profile) {
    return (
      <GateShell>
        <StatusCard
          icon={<Clock3 size={28} />}
          title="Account profile is being prepared"
          text="Your authentication account exists, but its access profile is not available yet. Refresh in a moment."
          tone="warning"
          actions={
            <>
              <button className="gate-secondary" onClick={() => void refreshIdentity()}><RefreshCw size={16} /> Refresh</button>
              <button className="gate-secondary" onClick={() => void handleSignOut()}><LogOut size={16} /> Sign out</button>
            </>
          }
        />
      </GateShell>
    );
  }

  if (identity.profile.status !== 'approved') {
    const copy = {
      pending: {
        icon: <Clock3 size={28} />,
        title: 'Approval pending',
        text: 'Your account has been created successfully. An administrator must approve it before the workspace and document tools become available.',
        tone: 'warning' as const,
      },
      rejected: {
        icon: <XCircle size={28} />,
        title: 'Access request rejected',
        text: identity.profile.rejection_reason
          ? `Administrator note: ${identity.profile.rejection_reason}`
          : 'This account is not approved to use Document Toolkit.',
        tone: 'danger' as const,
      },
      disabled: {
        icon: <Ban size={28} />,
        title: 'Account disabled',
        text: 'Access has been disabled by an administrator. The workspace and document tools are locked.',
        tone: 'danger' as const,
      },
    }[identity.profile.status];

    return (
      <GateShell>
        <StatusCard
          icon={copy.icon}
          title={copy.title}
          text={copy.text}
          tone={copy.tone}
          meta={
            <>
              <span>{identity.profile.display_name}</span>
              <span>{identity.profile.email ?? identity.email}</span>
              <span>Status: {identity.profile.status}</span>
            </>
          }
          actions={
            <>
              <button className="gate-secondary" onClick={() => void refreshIdentity()}><RefreshCw size={16} /> Refresh status</button>
              <button className="gate-secondary" onClick={() => void handleSignOut()}><LogOut size={16} /> Sign out</button>
            </>
          }
        />
      </GateShell>
    );
  }

  return (
    <>
      {children}
      {isAdmin && (
        <>
          <button className="admin-launcher" onClick={() => setAdminOpen(true)}>
            <ShieldCheck size={18} />
            Admin controls
          </button>
          {adminOpen && <AdminPanel actor={identity.profile} onClose={() => setAdminOpen(false)} />}
        </>
      )}
    </>
  );
}

function GateShell({ children }: { children: ReactNode }) {
  return (
    <main className="access-gate">
      <div className="access-brand">
        <div className="access-brand-mark"><LockKeyhole size={24} /></div>
        <div>
          <strong>Document Toolkit</strong>
          <span>Secure document workspace</span>
        </div>
      </div>
      {children}
      <p className="access-footnote">The public web address is shared, but workspace access is account-specific and approval-controlled.</p>
    </main>
  );
}

function AuthCard({
  mode, busy, error, message, onModeChange, onSubmit,
}: {
  mode: AuthMode;
  busy: boolean;
  error: string;
  message: string;
  onModeChange: (mode: AuthMode) => void;
  onSubmit: (values: { displayName: string; email: string; password: string }) => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    void onSubmit({ displayName, email, password });
  }

  return (
    <section className="auth-card">
      <div className="auth-tabs">
        <button className={mode === 'signin' ? 'active' : ''} onClick={() => onModeChange('signin')} type="button">
          <LogIn size={16} /> Sign in
        </button>
        <button className={mode === 'signup' ? 'active' : ''} onClick={() => onModeChange('signup')} type="button">
          <UserPlus size={16} /> Create account
        </button>
      </div>

      <div className="auth-heading">
        <span className="auth-eyebrow">{mode === 'signin' ? 'Approved users' : 'New access request'}</span>
        <h1>{mode === 'signin' ? 'Sign in to continue' : 'Create your account'}</h1>
        <p>
          {mode === 'signin'
            ? 'Only approved accounts can open the workspace and document tools.'
            : 'New accounts start in pending status. An administrator must approve access before any tool can be used.'}
        </p>
      </div>

      <form className="auth-form" onSubmit={submit}>
        {mode === 'signup' && (
          <label>
            Display name
            <input required autoComplete="name" minLength={2} value={displayName}
              onChange={(event) => setDisplayName(event.target.value)} placeholder="Your name" />
          </label>
        )}
        <label>
          Email
          <input required type="email" autoComplete="email" value={email}
            onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" />
        </label>
        <label>
          Password
          <input required type="password" minLength={8}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            value={password} onChange={(event) => setPassword(event.target.value)}
            placeholder="Minimum 8 characters" />
        </label>

        {message && <div className="gate-message success">{message}</div>}
        {error && <div className="gate-message error">{error}</div>}

        <button className="gate-primary" disabled={busy} type="submit">
          {busy ? <LoaderCircle className="gate-spin" size={17} /> : mode === 'signin' ? <LogIn size={17} /> : <UserPlus size={17} />}
          {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
      </form>
    </section>
  );
}

function StatusCard({
  icon, title, text, tone, meta, actions,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  tone: 'neutral' | 'warning' | 'danger';
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className={`status-card ${tone}`}>
      <div className="status-icon">{icon}</div>
      <h1>{title}</h1>
      <p>{text}</p>
      {meta && <div className="status-meta">{meta}</div>}
      {actions && <div className="status-actions">{actions}</div>}
    </section>
  );
}

function AdminPanel({ actor, onClose }: { actor: ProfileRow; onClose: () => void }) {
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [drafts, setDrafts] = useState<Record<string, { status: AccountStatus; role: AccountRole; reason: string }>>({});

  const refresh = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError('');
    try {
      const { data, error: queryError } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (queryError) throw queryError;
      const rows = data ?? [];
      setProfiles(rows);
      setDrafts((current) => {
        const next = { ...current };
        for (const profile of rows) {
          if (!next[profile.id]) {
            next[profile.id] = {
              status: profile.status,
              role: profile.role,
              reason: profile.rejection_reason ?? '',
            };
          }
        }
        return next;
      });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const client = supabase;
    if (!client) return;
    const channel = client.channel('admin-profile-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => void refresh())
      .subscribe();
    return () => { void client.removeChannel(channel); };
  }, [refresh]);

  const counts = useMemo(() => ({
    pending: profiles.filter((profile) => profile.status === 'pending').length,
    approved: profiles.filter((profile) => profile.status === 'approved').length,
    blocked: profiles.filter((profile) => profile.status === 'rejected' || profile.status === 'disabled').length,
  }), [profiles]);

  async function save(profile: ProfileRow) {
    if (!supabase) return;
    const draft = drafts[profile.id];
    if (!draft) return;

    setSavingId(profile.id);
    setError('');
    try {
      const { error: rpcError } = await supabase.rpc('admin_set_account_control', {
        target_id: profile.id,
        new_status: draft.status,
        new_role: draft.role,
        new_rejection_reason: draft.status === 'rejected' ? draft.reason : null,
      });
      if (rpcError) throw rpcError;
      await refresh();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="admin-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.currentTarget === event.target) onClose();
    }}>
      <section className="admin-panel" role="dialog" aria-modal="true" aria-label="Admin controls">
        <header className="admin-header">
          <div>
            <span className="auth-eyebrow">Administration</span>
            <h2>Access control</h2>
            <p>Approve new accounts, reject requests, disable access, and manage roles.</p>
          </div>
          <button className="admin-close" onClick={onClose} aria-label="Close admin controls">×</button>
        </header>

        <div className="admin-stats">
          <div><strong>{counts.pending}</strong><span>Pending</span></div>
          <div><strong>{counts.approved}</strong><span>Approved</span></div>
          <div><strong>{counts.blocked}</strong><span>Blocked</span></div>
        </div>

        <div className="admin-toolbar">
          <span>Signed in as <strong>{actor.display_name}</strong> · {actor.role}</span>
          <button className="gate-secondary" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw className={loading ? 'gate-spin' : ''} size={15} /> Refresh
          </button>
        </div>

        {error && <div className="gate-message error admin-error">{error}</div>}

        <div className="account-list">
          {loading && profiles.length === 0 ? (
            <div className="admin-empty"><LoaderCircle className="gate-spin" size={20} /> Loading accounts…</div>
          ) : profiles.length === 0 ? (
            <div className="admin-empty">No accounts yet.</div>
          ) : profiles.map((profile) => {
            const draft = drafts[profile.id] ?? {
              status: profile.status, role: profile.role, reason: profile.rejection_reason ?? '',
            };
            const isSelf = profile.id === actor.id;
            const protectedFromAdmin = actor.role !== 'super_admin' && profile.role === 'super_admin';
            const roleEditable = actor.role === 'super_admin' && !isSelf;
            const statusEditable = !isSelf && !protectedFromAdmin;

            return (
              <article className="account-row" key={profile.id}>
                <div className="account-identity">
                  <div className="account-avatar">{initials(profile.display_name)}</div>
                  <div>
                    <strong>{profile.display_name || 'Unnamed user'}</strong>
                    <span>{profile.email ?? 'Email unavailable'}</span>
                    <small>Created {new Date(profile.created_at).toLocaleString()}</small>
                  </div>
                </div>

                <div className="account-controls">
                  <label>
                    Status
                    <select value={draft.status} disabled={!statusEditable}
                      onChange={(event) => setDrafts((current) => ({
                        ...current, [profile.id]: { ...draft, status: event.target.value as AccountStatus },
                      }))}>
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                      <option value="disabled">Disabled</option>
                    </select>
                  </label>

                  <label>
                    Role
                    <select value={draft.role} disabled={!roleEditable}
                      onChange={(event) => setDrafts((current) => ({
                        ...current, [profile.id]: { ...draft, role: event.target.value as AccountRole },
                      }))}>
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                      <option value="super_admin">Super admin</option>
                    </select>
                  </label>

                  {draft.status === 'rejected' && (
                    <label className="reason-field">
                      Rejection reason
                      <input value={draft.reason} disabled={!statusEditable}
                        onChange={(event) => setDrafts((current) => ({
                          ...current, [profile.id]: { ...draft, reason: event.target.value },
                        }))}
                        placeholder="Optional note shown to the user" />
                    </label>
                  )}

                  <button className="gate-primary admin-save"
                    disabled={!statusEditable || savingId === profile.id}
                    onClick={() => void save(profile)}>
                    {savingId === profile.id ? <LoaderCircle className="gate-spin" size={16} /> : <Check size={16} />}
                    Save access
                  </button>
                </div>

                {(isSelf || protectedFromAdmin) && (
                  <div className="account-protected">
                    <ShieldCheck size={14} />
                    {isSelf ? 'Your own admin status and role are protected.' : 'Only a super admin can modify this account.'}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'U';
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('');
}
