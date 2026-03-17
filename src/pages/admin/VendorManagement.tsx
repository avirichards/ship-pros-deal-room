import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Profile } from '../../lib/types';
import { useToast } from '../../components/ui/Toast';
import { Users, UserPlus, X, Mail, Phone, Building } from 'lucide-react';

export default function VendorManagement() {
  const { toast } = useToast();
  const [vendors, setVendors] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    fetchVendors();
  }, []);

  async function fetchVendors() {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'vendor')
      .order('created_at', { ascending: false });

    if (!error && data) setVendors(data as Profile[]);
    setLoading(false);
  }

  async function handleAddVendor(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      // Call the invite-vendor edge function
      const { data, error } = await supabase.functions.invoke('invite-vendor', {
        body: {
          email: email.trim(),
          full_name: fullName.trim(),
          company: company.trim(),
          phone: phone.trim(),
        },
      });

      if (error) throw error;

      toast('Vendor invited successfully!');
      setShowModal(false);
      setFullName('');
      setEmail('');
      setCompany('');
      setPhone('');
      fetchVendors();
    } catch (err: any) {
      toast(err.message || 'Failed to invite vendor', 'error');
    } finally {
      setSaving(false);
    }
  }

  const formatDate = (date: string) => new Date(date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Vendor Management</h1>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          <UserPlus className="w-4 h-4" />
          Add Vendor
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
        </div>
      ) : vendors.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No vendors yet</h3>
          <p className="text-sm text-gray-500 mb-6">Add your first vendor to get started</p>
          <button onClick={() => setShowModal(true)} className="btn-primary">
            <UserPlus className="w-4 h-4" />
            Add Vendor
          </button>
        </div>
      ) : (
        <div className="table-container">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Company</th>
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3">Phone</th>
                <th className="px-6 py-3">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {vendors.map(vendor => (
                <tr key={vendor.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{vendor.full_name || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{vendor.company || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{vendor.email}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{vendor.phone || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{formatDate(vendor.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Vendor Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-navy-950">Add New Vendor</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddVendor} className="space-y-4">
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
                    id="vendorCompany"
                    type="text"
                    value={company}
                    onChange={e => setCompany(e.target.value)}
                    className="input-field pl-9"
                    placeholder="Acme Shipping Inc."
                  />
                  <Building className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
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
                  {saving ? 'Inviting...' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
