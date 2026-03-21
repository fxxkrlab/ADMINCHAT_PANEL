import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Shield, UserX, X, Check } from 'lucide-react';
import Header from '../components/layout/Header';
import { getAdmins, createAdmin, updateAdmin, deactivateAdmin, updateAdminPermissions, type AdminCreateData, type AdminUpdateData } from '../services/adminApi';
import type { Admin } from '../types';

// ---- Role badge ----
function RoleBadge({ role }: { role: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    super_admin: { label: 'SUPER ADMIN', color: 'text-accent', bg: 'bg-accent/10' },
    admin: { label: 'ADMIN', color: 'text-purple', bg: 'bg-purple/10' },
    agent: { label: 'AGENT', color: 'text-green', bg: 'bg-green/10' },
  };
  const s = map[role] || map.agent;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ${s.color} ${s.bg}`}>
      {s.label}
    </span>
  );
}

// ---- Permission keys ----
const PERMISSION_KEYS = [
  { key: 'manage_bots', label: 'Manage Bots' },
  { key: 'manage_faq', label: 'Manage FAQ' },
  { key: 'manage_users', label: 'Manage Users' },
  { key: 'manage_blacklist', label: 'Manage Blacklist' },
  { key: 'view_stats', label: 'View Statistics' },
  { key: 'send_messages', label: 'Send Messages' },
  { key: 'assign_conversations', label: 'Assign Conversations' },
  { key: 'manage_tags', label: 'Manage Tags & Groups' },
];

export default function AdminManage() {
  const queryClient = useQueryClient();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<Admin | null>(null);
  const [permissionsAdmin, setPermissionsAdmin] = useState<Admin | null>(null);
  const [permissionsState, setPermissionsState] = useState<Record<string, boolean>>({});

  // Create form state
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState('agent');

  // Edit form state
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editPassword, setEditPassword] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admins'],
    queryFn: getAdmins,
  });

  const createMutation = useMutation({
    mutationFn: (body: AdminCreateData) => createAdmin(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admins'] });
      setShowCreateForm(false);
      resetCreateForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: AdminUpdateData }) => updateAdmin(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admins'] });
      setEditingAdmin(null);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => deactivateAdmin(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admins'] }),
  });

  const permissionsMutation = useMutation({
    mutationFn: ({ id, permissions }: { id: number; permissions: Record<string, boolean> }) =>
      updateAdminPermissions(id, permissions),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admins'] });
      setPermissionsAdmin(null);
    },
  });

  const admins = data?.items || [];

  const resetCreateForm = () => {
    setFormUsername('');
    setFormPassword('');
    setFormDisplayName('');
    setFormEmail('');
    setFormRole('agent');
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      username: formUsername.trim(),
      password: formPassword,
      display_name: formDisplayName.trim() || undefined,
      email: formEmail.trim() || undefined,
      role: formRole,
    });
  };

  const startEdit = (admin: Admin) => {
    setEditingAdmin(admin);
    setEditDisplayName(admin.display_name || '');
    setEditEmail('');
    setEditRole(admin.role);
    setEditPassword('');
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdmin) return;
    const body: AdminUpdateData = {};
    if (editDisplayName.trim()) body.display_name = editDisplayName.trim();
    if (editEmail.trim()) body.email = editEmail.trim();
    if (editRole !== editingAdmin.role) body.role = editRole;
    if (editPassword) body.password = editPassword;
    updateMutation.mutate({ id: editingAdmin.id, body });
  };

  const openPermissions = (admin: Admin) => {
    setPermissionsAdmin(admin);
    // Initialize permissions state from admin data
    const perms: Record<string, boolean> = {};
    const existing = (admin as unknown as { permissions?: Record<string, boolean> }).permissions || {};
    PERMISSION_KEYS.forEach(({ key }) => {
      perms[key] = !!existing[key];
    });
    setPermissionsState(perms);
  };

  const togglePermission = (key: string) => {
    setPermissionsState((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="Admin Management" />
      <div className="flex-1 p-8 overflow-auto">
        <div className="flex items-center justify-between mb-8">
          <p className="text-text-secondary text-sm">
            Manage admin accounts and permissions &middot; {admins.length} admin{admins.length !== 1 ? 's' : ''}
          </p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-black text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" /> Add Admin
          </button>
        </div>

        {/* Admin table */}
        <div className="bg-bg-card border border-border-subtle rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider font-['JetBrains_Mono'] px-6 py-4">Username</th>
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider font-['JetBrains_Mono'] px-6 py-4">Display Name</th>
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider font-['JetBrains_Mono'] px-6 py-4">Role</th>
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider font-['JetBrains_Mono'] px-6 py-4">Status</th>
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider font-['JetBrains_Mono'] px-6 py-4">Created</th>
                <th className="text-right text-xs font-semibold text-text-muted uppercase tracking-wider font-['JetBrains_Mono'] px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center text-text-muted text-sm py-12">Loading admins...</td>
                </tr>
              ) : admins.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-text-muted text-sm py-12">No admin accounts found.</td>
                </tr>
              ) : (
                admins.map((admin) => (
                  <tr key={admin.id} className="border-b border-border-subtle/50 hover:bg-bg-elevated/30 transition-colors">
                    <td className="px-6 py-4.5">
                      <span className="text-sm text-text-primary font-medium font-mono">{admin.username}</span>
                    </td>
                    <td className="px-6 py-4.5">
                      <span className="text-sm text-text-secondary">{admin.display_name || '-'}</span>
                    </td>
                    <td className="px-6 py-4.5">
                      <RoleBadge role={admin.role} />
                    </td>
                    <td className="px-6 py-4.5">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${admin.is_active ? 'text-green' : 'text-text-muted'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${admin.is_active ? 'bg-green' : 'bg-text-muted'}`} />
                        {admin.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-6 py-4.5">
                      <span className="text-xs text-text-muted font-mono">
                        {new Date(admin.created_at).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-6 py-4.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => startEdit(admin)}
                          className="p-1.5 rounded hover:bg-bg-elevated transition-colors text-text-secondary hover:text-text-primary"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openPermissions(admin)}
                          className="p-1.5 rounded hover:bg-bg-elevated transition-colors text-text-secondary hover:text-accent"
                          title="Permissions"
                        >
                          <Shield className="w-3.5 h-3.5" />
                        </button>
                        {admin.is_active && (
                          <button
                            onClick={() => deactivateMutation.mutate(admin.id)}
                            disabled={deactivateMutation.isPending}
                            className="p-1.5 rounded hover:bg-red/10 transition-colors text-text-secondary hover:text-red"
                            title="Disable"
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Create Admin Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-[#0C0C0C] border border-border rounded-xl p-6 w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-semibold text-text-primary">Add New Admin</h3>
                <button onClick={() => { setShowCreateForm(false); resetCreateForm(); }} className="text-text-muted hover:text-text-primary">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs text-text-secondary mb-2">Username *</label>
                  <input
                    type="text"
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    className="w-full h-11 px-4 bg-bg-elevated border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent transition-colors"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-2">Password *</label>
                  <input
                    type="password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    className="w-full h-11 px-4 bg-bg-elevated border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent transition-colors"
                    required
                    minLength={6}
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-2">Display Name</label>
                  <input
                    type="text"
                    value={formDisplayName}
                    onChange={(e) => setFormDisplayName(e.target.value)}
                    className="w-full h-11 px-4 bg-bg-elevated border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-2">Email</label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full h-11 px-4 bg-bg-elevated border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-2">Role</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    className="w-full h-11 px-4 bg-bg-elevated border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent transition-colors"
                  >
                    <option value="agent">Agent</option>
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>
                <div className="flex justify-end gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => { setShowCreateForm(false); resetCreateForm(); }}
                    className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending}
                    className="px-4 py-2 bg-accent text-black text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50"
                  >
                    {createMutation.isPending ? 'Creating...' : 'Create Admin'}
                  </button>
                </div>
                {createMutation.isError && (
                  <p className="text-xs text-red">
                    Failed: {(createMutation.error as Error)?.message || 'Unknown error'}
                  </p>
                )}
              </form>
            </div>
          </div>
        )}

        {/* Edit Admin Modal */}
        {editingAdmin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-[#0C0C0C] border border-border rounded-xl p-6 w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-semibold text-text-primary">Edit Admin: {editingAdmin.username}</h3>
                <button onClick={() => setEditingAdmin(null)} className="text-text-muted hover:text-text-primary">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs text-text-secondary mb-2">Display Name</label>
                  <input
                    type="text"
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                    className="w-full h-11 px-4 bg-bg-elevated border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-2">Email</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="Leave blank to keep current"
                    className="w-full h-11 px-4 bg-bg-elevated border border-border rounded-lg text-sm text-text-primary placeholder:text-text-placeholder focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-2">Role</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className="w-full h-11 px-4 bg-bg-elevated border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent transition-colors"
                  >
                    <option value="agent">Agent</option>
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-text-secondary mb-2">New Password</label>
                  <input
                    type="password"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="Leave blank to keep current"
                    className="w-full h-11 px-4 bg-bg-elevated border border-border rounded-lg text-sm text-text-primary placeholder:text-text-placeholder focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
                <div className="flex justify-end gap-3 mt-2">
                  <button type="button" onClick={() => setEditingAdmin(null)} className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updateMutation.isPending}
                    className="px-4 py-2 bg-accent text-black text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50"
                  >
                    {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Permissions Editor Modal */}
        {permissionsAdmin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-[#0C0C0C] border border-border rounded-xl p-6 w-full max-w-md shadow-2xl">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-semibold text-text-primary">
                  Permissions: {permissionsAdmin.username}
                </h3>
                <button onClick={() => setPermissionsAdmin(null)} className="text-text-muted hover:text-text-primary">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-2">
                {PERMISSION_KEYS.map(({ key, label }) => (
                  <label
                    key={key}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-bg-elevated/50 cursor-pointer transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => togglePermission(key)}
                      className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                        permissionsState[key]
                          ? 'bg-accent border-accent'
                          : 'border-border bg-bg-elevated'
                      }`}
                    >
                      {permissionsState[key] && <Check className="w-3 h-3 text-black" />}
                    </button>
                    <span className="text-sm text-text-primary">{label}</span>
                  </label>
                ))}
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setPermissionsAdmin(null)}
                  className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (permissionsAdmin) {
                      permissionsMutation.mutate({
                        id: permissionsAdmin.id,
                        permissions: permissionsState,
                      });
                    }
                  }}
                  disabled={permissionsMutation.isPending}
                  className="px-4 py-2 bg-accent text-black text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50"
                >
                  {permissionsMutation.isPending ? 'Saving...' : 'Save Permissions'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
