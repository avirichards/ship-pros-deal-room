import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Profile, UserRole } from '../../lib/types';
import { useToast } from '../../components/ui/Toast';
import { Users, UserPlus, X, Mail, Phone, Building, Edit2, Trash2, Send, Shield, Bell, BellOff, ChevronDown, ChevronRight } from 'lucide-react';

export default function VendorManagement() {
  const { toast } = useToast();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Profile | null>(null);
  const [vendorToDelete, setVendorToDelete] = useState<Profile | null>(null);
  const [vendorToResend, setVendorToResend] = useState<Profile | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [collapsedCompanies, setCollapsedCompanies] = useState<Set<string>>(new Set());

  // Form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('vendor');
  const [showCompanySuggestions, setShowCompanySuggestions] = useState(false);
  const companyInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) setUsers(data as Profile[]);
    setLoading(false);
  }

  // Get unique company names for autocomplete
  const existingCompanies = useMemo(() => {
    const companies = users
      .map(u => u.company)
      .filter((c): c is string => !!c && c.trim() !== '');
    return [...new Set(companies)].sort();
  }, [users]);

  // Filter suggestions based on input
  const companySuggestions = useMemo(() => {
    if (!company.trim()) return existingCompanies;
    return existingCompanies.filter(c =>
      c.toLowerCase().includes(company.toLowerCase())
    );
  }, [company, existingCompanies]);

  // Group users by company
  const groupedUsers = useMemo(() => {
    const groups: { company: string; users: Profile[] }[] = [];
    const companyMap = new Map<string, Profile[]>();

    for (const user of users) {
      const companyName = user.company?.trim() || 'No Company';
      if (!companyMap.has(companyName)) {
        companyMap.set(companyName, []);
      }
      companyMap.get(companyName)!.push(user);
    }

    // Sort: named companies first alphabetically, "No Company" last
    const sortedKeys = [...companyMap.keys()].sort((a, b) => {
      if (a === 'No Company') return 1;
      if (b === 'No Company') return -1;
      return a.localeCompare(b);
    });

    for (const key of sortedKeys) {
      groups.push({ company: key, users: companyMap.get(key)! });
    }

    return groups;
  }, [users]);

  const toggleCompanyCollapse = (company: string) => {
    setCollapsedCompanies(prev => {
      const next = new Set(prev);
      if (next.has(company)) next.delete(company);
      else next.add(company);
      return next;
    });
  };

  const openEditModal = (vendor: Profile) => {
    setEditingVendor(vendor);
    setFullName(vendor.full_name || '');
    setEmail(vendor.email || '');
    setCompany(vendor.company || '');
    setPhone(vendor.phone || '');
    setRole(vendor.role);
    setShowModal(true);
  };

  const openAddModal = () => {
    setEditingVendor(null);
    setFullName('');
    setEmail('');
    setCompany('');
    setPhone('');
    setRole('vendor');
    setShowModal(true);
  };

  async function handleSaveVendor(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      if (editingVendor) {
        const { data, error } = await supabase.functions.invoke('manage-vendor', {
          body: {
            action: 'update',
            vendor_id: editingVendor.id,
            email: email.trim(),
            full_name: fullName.trim(),
            company: company.trim(),
            phone: phone.trim(),
            role: role,
          },
        });
        if (error) throw error;
        toast('User updated successfully!');
      } else {
        const { data, error } = await supabase.functions.invoke('invite-vendor', {
          body: {
            email: email.trim(),
            full_name: fullName.trim(),
            company: company.trim(),
            phone: phone.trim(),
            role: role,
          },
        });
        if (error) throw error;
        toast('User invited successfully!');
      }

      setShowModal(false);
      fetchUsers();
    } catch (err: any) {
      toast(err.message || 'Failed to save user', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeleteVendor() {
    if (!vendorToDelete) return;
    
    setActionLoading(`delete-${vendorToDelete.id}`);
    try {
      const { error } = await supabase.functions.invoke('manage-vendor', {
        body: { action: 'delete', vendor_id: vendorToDelete.id },
      });
      if (error) throw error;
      toast('User deleted successfully');
      setUsers(prev => prev.filter(v => v.id !== vendorToDelete.id));
      setVendorToDelete(null);
    } catch (err: any) {
      toast(err.message || 'Failed to delete user', 'error');
    } finally {
      setActionLoading(null);
    }
  }

  async function confirmResendInvite() {
    if (!vendorToResend) return;

    setActionLoading(`resend-${vendorToResend.id}`);
    try {
      const { error } = await supabase.functions.invoke('manage-vendor', {
        body: { action: 'resend-invite', vendor_id: vendorToResend.id },
      });
      if (error) throw error;
      toast(`Invite resent to ${vendorToResend.email}`);
      setVendorToResend(null);
    } catch (err: any) {
      toast(err.message || 'Failed to resend invite', 'error');
    } finally {
      setActionLoading(null);
    }
  }

  const formatDate = (date: string) => new Date(date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });

  async function toggleNotifications(user: Profile) {
    const newValue = !user.receive_submission_notifications;
    const { error } = await supabase
      .from('profiles')
      .update({ receive_submission_notifications: newValue })
      .eq('id', user.id);
    if (error) {
      toast('Failed to update notification settings', 'error');
      return;
    }
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, receive_submission_notifications: newValue } : u));
    toast(newValue ? `${user.full_name || user.email} will now receive submission notifications` : `${user.full_name || user.email} will no longer receive submission notifications`);
  }

  const renderUserRow = (user: Profile) => (
    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
      <td className="px-6 py-3.5 text-sm font-medium text-gray-900">{user.full_name || '—'}</td>
      <td className="px-6 py-3.5 text-sm text-gray-600">
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${
          user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
        }`}>
          {user.role}
        </span>
      </td>
      <td className="px-6 py-3.5 text-sm text-gray-600">
        {user.role === 'admin' ? (
          <button
            onClick={() => toggleNotifications(user)}
            className={`p-1.5 rounded transition-colors ${
              user.receive_submission_notifications
                ? 'text-teal-600 bg-teal-50 hover:bg-teal-100'
                : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'
            }`}
            title={user.receive_submission_notifications ? 'Receiving submission notifications (click to disable)' : 'Not receiving submission notifications (click to enable)'}
          >
            {user.receive_submission_notifications ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
          </button>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </td>
      <td className="px-6 py-3.5 text-sm text-gray-600">{user.email}</td>
      <td className="px-6 py-3.5 text-sm text-gray-600">{user.phone || '—'}</td>
      <td className="px-6 py-3.5 text-sm text-gray-500">{formatDate(user.created_at)}</td>
      <td className="px-6 py-3.5 text-sm text-right font-medium">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => setVendorToResend(user)}
            disabled={actionLoading === `resend-${user.id}`}
            className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded transition-colors disabled:opacity-50"
            title="Resend Invite"
          >
            <Send className="w-4 h-4" />
          </button>
          <button
            onClick={() => openEditModal(user)}
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title="Edit User"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setVendorToDelete(user)}
            disabled={actionLoading === `delete-${user.id}`}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
            title="Delete User"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">User Management</h1>
        <button onClick={openAddModal} className="btn-primary">
          <UserPlus className="w-4 h-4" />
          Add User
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No users yet</h3>
          <p className="text-sm text-gray-500 mb-6">Add your first user to get started</p>
          <button onClick={openAddModal} className="btn-primary">
            <UserPlus className="w-4 h-4" />
            Add User
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedUsers.map(group => (
            <div key={group.company} className="table-container overflow-hidden">
              {/* Company group header */}
              <button
                onClick={() => toggleCompanyCollapse(group.company)}
                className="w-full flex items-center gap-3 px-6 py-3 bg-gray-50 hover:bg-gray-100 transition-colors border-b border-gray-200"
              >
                {collapsedCompanies.has(group.company) ? (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
                <Building className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-semibold text-navy-950">{group.company}</span>
                <span className="text-xs text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full">
                  {group.users.length} {group.users.length === 1 ? 'user' : 'users'}
                </span>
              </button>

              {/* Users table - collapsible */}
              {!collapsedCompanies.has(group.company) && (
                <table className="w-full">
                  <thead>
                    <tr className="table-header">
                      <th className="px-6 py-2.5 text-xs">Name</th>
                      <th className="px-6 py-2.5 text-xs">Role</th>
                      <th className="px-6 py-2.5 text-xs">Notifications</th>
                      <th className="px-6 py-2.5 text-xs">Email</th>
                      <th className="px-6 py-2.5 text-xs">Phone</th>
                      <th className="px-6 py-2.5 text-xs">Joined</th>
                      <th className="px-6 py-2.5 text-xs text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {group.users.map(renderUserRow)}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Resend Invite Modal */}
      {vendorToResend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setVendorToResend(null)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h2 className="text-xl font-bold text-navy-950 mb-2 flex items-center gap-2">
              <Send className="w-5 h-5 text-teal-600" />
              Resend Invite
            </h2>
            <p className="text-gray-600 mb-6">
              Are you sure you want to resend the invite to <span className="font-medium text-navy-950">{vendorToResend.email}</span>?
              <br /><br />
              This will generate a new temporary password and email it to them.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setVendorToResend(null)} className="btn-secondary">
                Cancel
              </button>
              <button 
                onClick={confirmResendInvite} 
                disabled={!!actionLoading}
                className="btn-primary"
              >
                {actionLoading === `resend-${vendorToResend.id}` ? 'Sending...' : 'Yes, Resend Invite'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Modal */}
      {vendorToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setVendorToDelete(null)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h2 className="text-xl font-bold text-red-600 mb-2 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              Delete User
            </h2>
            <p className="text-gray-600 mb-6">
              Are you sure you want to completely delete <span className="font-medium text-navy-950">{vendorToDelete.full_name || vendorToDelete.email}</span>?
              <br /><br />
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setVendorToDelete(null)} className="btn-secondary">
                Cancel
              </button>
              <button 
                onClick={confirmDeleteVendor} 
                disabled={!!actionLoading}
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading === `delete-${vendorToDelete.id}` ? 'Deleting...' : 'Yes, Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit User Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-navy-950">
                {editingVendor ? 'Edit User' : 'Add New User'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveVendor} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="vendorName" className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="vendorName"
                      type="text"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      className="input-field pl-9"
                      placeholder="John Doe"
                      required
                    />
                    <Users className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div>
                  <label htmlFor="userRole" className="block text-sm font-medium text-gray-700 mb-1">
                    Account Role
                  </label>
                  <div className="relative">
                    <select
                      id="userRole"
                      value={role}
                      onChange={e => setRole(e.target.value as UserRole)}
                      className="input-field pl-9 appearance-none"
                    >
                      <option value="vendor">Vendor</option>
                      <option value="admin">Admin</option>
                    </select>
                    <Shield className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="vendorEmail" className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="vendorEmail"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="input-field pl-9"
                    placeholder="john@company.com"
                    required
                  />
                  <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div>
                <label htmlFor="vendorCompany" className="block text-sm font-medium text-gray-700 mb-1">
                  Company
                </label>
                <div className="relative">
                  <input
                    ref={companyInputRef}
                    id="vendorCompany"
                    type="text"
                    value={company}
                    onChange={e => {
                      setCompany(e.target.value);
                      setShowCompanySuggestions(true);
                    }}
                    onFocus={() => setShowCompanySuggestions(true)}
                    onBlur={() => {
                      // Delay to allow click on suggestion
                      setTimeout(() => setShowCompanySuggestions(false), 200);
                    }}
                    className="input-field pl-9"
                    placeholder="Acme Shipping Inc."
                    autoComplete="off"
                  />
                  <Building className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />

                  {/* Company autocomplete dropdown */}
                  {showCompanySuggestions && companySuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
                      {companySuggestions.map(c => (
                        <button
                          key={c}
                          type="button"
                          onMouseDown={e => {
                            e.preventDefault();
                            setCompany(c);
                            setShowCompanySuggestions(false);
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 transition-colors flex items-center gap-2"
                        >
                          <Building className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-gray-700">{c}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="vendorPhone" className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <div className="relative">
                  <input
                    id="vendorPhone"
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="input-field pl-9"
                    placeholder="(555) 123-4567"
                  />
                  <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? 'Saving...' : editingVendor ? 'Save Changes' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
