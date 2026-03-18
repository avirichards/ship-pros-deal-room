import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Opportunity, OpportunityStatus, STATUSES } from '../../lib/types';
import { useToast } from '../../components/ui/Toast';
import { Plus, FileText, Users, Clock, Upload, Trash2, ChevronDown, X, Bell } from 'lucide-react';

const statusBadgeClass: Record<OpportunityStatus, string> = {
  'Open': 'badge-open',
  'Quoted': 'badge-quoted',
  'Closed/Won': 'badge-won',
  'Closed/Lost': 'badge-lost',
};

export default function AdminDashboard() {
  const [opportunities, setOpportunities] = useState<(Opportunity & { file_count: number; interest_count: number; submission_count: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'All' | OpportunityStatus>('All');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [notifyVendorsList, setNotifyVendorsList] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVendors, setSelectedVendors] = useState<Set<string>>(new Set());
  const [sendingNotification, setSendingNotification] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchOpportunities();
  }, []);

  useEffect(() => {
    if (showNotifyModal && notifyVendorsList.length === 0) {
      supabase.from('profiles').select('id, email, full_name, company').eq('role', 'vendor').then(({ data }) => {
        if (data) setNotifyVendorsList(data);
      });
    }
  }, [showNotifyModal, notifyVendorsList.length]);

  async function fetchOpportunities() {
    const { data, error } = await supabase
      .from('opportunities')
      .select(`
        *,
        opportunity_files(count),
        vendor_interest(count),
        vendor_submissions(vendor_id)
      `)
      .order('created_at', { ascending: false });

    if (!error && data) {
      const mapped = data.map((opp: any) => ({
        ...opp,
        file_count: opp.opportunity_files?.[0]?.count ?? 0,
        interest_count: opp.vendor_interest?.[0]?.count ?? 0,
        submission_count: new Set((opp.vendor_submissions || []).map((s: any) => s.vendor_id)).size,
      }));
      setOpportunities(mapped);
    }
    setLoading(false);
  }

  const filtered = filter === 'All'
    ? opportunities
    : opportunities.filter(o => o.status === filter);

  const allFilteredSelected = filtered.length > 0 && filtered.every(o => selected.has(o.id));

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(o => o.id)));
    }
  };

  const clearSelection = () => setSelected(new Set());

  const filteredVendors = notifyVendorsList.filter(v => 
    (v.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (v.company || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (v.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleVendorSelection = (vendorId: string) => {
    const newSet = new Set(selectedVendors);
    if (newSet.has(vendorId)) newSet.delete(vendorId);
    else newSet.add(vendorId);
    setSelectedVendors(newSet);
  };

  const selectAllVendors = () => {
    const filteredIds = filteredVendors.map(v => v.id);
    const allFilteredSelected = filteredIds.every(id => selectedVendors.has(id)) && filteredIds.length > 0;
    
    if (allFilteredSelected) {
      const newSet = new Set(selectedVendors);
      filteredIds.forEach(id => newSet.delete(id));
      setSelectedVendors(newSet);
    } else {
      const newSet = new Set(selectedVendors);
      filteredIds.forEach(id => newSet.add(id));
      setSelectedVendors(newSet);
    }
  };

  async function handleBulkNotifyVendors() {
    if (selectedVendors.size === 0 || selected.size === 0) return;
    setSendingNotification(true);
    try {
      const vendorIds = Array.from(selectedVendors);
      const oppsToNotify = Array.from(selected);
      for (const oppId of oppsToNotify) {
        await supabase.functions.invoke('notify-vendors', {
          body: { opportunity_id: oppId, vendor_ids: vendorIds }
        });
      }
      toast(`Notifications sent to ${vendorIds.length} vendor(s) for ${oppsToNotify.length} opportunit${oppsToNotify.length === 1 ? 'y' : 'ies'}`);
      setShowNotifyModal(false);
      setSelectedVendors(new Set());
      clearSelection();
    } catch (err) {
      toast('Failed to send some notifications', 'error');
    } finally {
      setSendingNotification(false);
    }
  }

  const handleBulkStatusChange = async (newStatus: OpportunityStatus) => {
    setBulkProcessing(true);
    setShowStatusMenu(false);
    try {
      const ids = Array.from(selected);
      const { error } = await supabase
        .from('opportunities')
        .update({ status: newStatus })
        .in('id', ids);
      if (error) throw error;
      toast(`${ids.length} opportunit${ids.length === 1 ? 'y' : 'ies'} updated to ${newStatus}`);
      clearSelection();
      await fetchOpportunities();
    } catch (err: any) {
      toast('Failed to update status', 'error');
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleBulkDelete = async () => {
    setBulkProcessing(true);
    setShowDeleteConfirm(false);
    try {
      const ids = Array.from(selected);
      // Delete related data first
      for (const id of ids) {
        await supabase.from('vendor_submissions').delete().eq('opportunity_id', id);
        await supabase.from('vendor_interest').delete().eq('opportunity_id', id);
        await supabase.from('vendor_views').delete().eq('opportunity_id', id);
        // Delete files from storage
        const { data: files } = await supabase.from('opportunity_files').select('file_path').eq('opportunity_id', id);
        if (files && files.length > 0) {
          await supabase.storage.from('opportunity-files').remove(files.map(f => f.file_path));
        }
        await supabase.from('opportunity_files').delete().eq('opportunity_id', id);
      }
      const { error } = await supabase.from('opportunities').delete().in('id', ids);
      if (error) throw error;
      toast(`${ids.length} opportunit${ids.length === 1 ? 'y' : 'ies'} deleted`);
      clearSelection();
      await fetchOpportunities();
    } catch (err: any) {
      toast('Failed to delete opportunities', 'error');
    } finally {
      setBulkProcessing(false);
    }
  };

  const formatDate = (date: string) => new Date(date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });

  const getDeadlineDisplay = (deadline: string | null) => {
    if (!deadline) return null;
    const now = new Date();
    const dl = new Date(deadline);
    const diff = Math.ceil((dl.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return <span className="text-red-600 text-xs font-medium">Expired</span>;
    if (diff <= 3) return <span className="text-amber-600 text-xs font-medium">{diff}d left</span>;
    return <span className="text-gray-500 text-xs">{formatDate(deadline)}</span>;
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Opportunities</h1>
        <Link to="/admin/opportunities/new" className="btn-primary" data-tour="new-opportunity-btn">
          <Plus className="w-4 h-4" />
          New Opportunity
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit" data-tour="filter-tabs">
        {['All', ...STATUSES].map(status => (
          <button
            key={status}
            onClick={() => { setFilter(status as any); clearSelection(); }}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              filter === status
                ? 'bg-white text-navy-950 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Bulk Action Bar */}
      {selected.size > 0 && (
        <div className="mb-4 flex items-center gap-3 bg-navy-950 text-white px-4 py-3 rounded-lg shadow-lg animate-in">
          <span className="text-sm font-medium">
            {selected.size} selected
          </span>
          <button
            onClick={clearSelection}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="w-px h-5 bg-gray-600 mx-1" />

          {/* Change Status dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowStatusMenu(!showStatusMenu)}
              disabled={bulkProcessing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-white/10 hover:bg-white/20 rounded-md transition-colors"
            >
              Change Status
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {showStatusMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowStatusMenu(false)} />
                <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-20 min-w-[140px]">
                  {STATUSES.map(s => (
                    <button
                      key={s}
                      onClick={() => handleBulkStatusChange(s)}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors flex items-center gap-2"
                    >
                      <span className={statusBadgeClass[s]}>{s}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Notify Vendors button */}
          <button
            onClick={() => setShowNotifyModal(true)}
            disabled={bulkProcessing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 rounded-md transition-colors"
          >
            <Bell className="w-3.5 h-3.5" />
            Notify Vendors
          </button>

          {/* Delete button */}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={bulkProcessing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-md transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>

          {bulkProcessing && (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2" />
          )}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete {selected.size} Opportunit{selected.size === 1 ? 'y' : 'ies'}?</h3>
            <p className="text-sm text-gray-600 mb-6">
              This will permanently delete the selected opportunities and all associated files, submissions, and vendor data. This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="btn-secondary px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4 inline mr-1" />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notify Vendors Modal */}
      {showNotifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !sendingNotification && setShowNotifyModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 p-6 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-teal-50 rounded-lg">
                  <Bell className="w-5 h-5 text-teal-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Notify Vendors</h3>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-4">Select the vendors you want to notify about the {selected.size} selected opportunit{selected.size === 1 ? 'y' : 'ies'}.</p>
            
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search by name, company, or email..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="input-field w-full text-sm"
              />
            </div>
            
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filteredVendors.length > 0 && filteredVendors.every(v => selectedVendors.has(v.id))}
                  onChange={selectAllVendors}
                  className="w-4 h-4 rounded border-gray-300 text-teal-500 focus:ring-teal-500"
                />
                Select All ({filteredVendors.length})
              </label>
              <span className="text-sm text-gray-500">{selectedVendors.size} total selected</span>
            </div>
            
            <div className="flex-1 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100 mb-6 min-h-[200px]">
              {filteredVendors.map(v => (
                <label key={v.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={selectedVendors.has(v.id)}
                    onChange={() => toggleVendorSelection(v.id)}
                    className="w-4 h-4 rounded border-gray-300 text-teal-500 focus:ring-teal-500"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{v.full_name || 'Unknown'}</p>
                    <p className="text-xs text-gray-500 truncate">{v.company ? `${v.company} · ${v.email}` : v.email}</p>
                  </div>
                </label>
              ))}
              {notifyVendorsList.length === 0 && (
                <div className="p-8 text-center text-gray-500 text-sm flex flex-col items-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500 mb-4"></div>
                  Loading vendors...
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-auto">
              <button 
                onClick={() => setShowNotifyModal(false)} 
                disabled={sendingNotification}
                className="btn-secondary px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button 
                onClick={handleBulkNotifyVendors}
                disabled={sendingNotification || selectedVendors.size === 0}
                className="btn-primary px-4 py-2 text-sm"
              >
                {sendingNotification ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 inline-block"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <Bell className="w-4 h-4 mr-1.5 inline" />
                    Send Notification
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No opportunities yet</h3>
          <p className="text-sm text-gray-500 mb-6">Create your first opportunity to get started</p>
          <Link to="/admin/opportunities/new" className="btn-primary">
            <Plus className="w-4 h-4" />
            Create Opportunity
          </Link>
        </div>
      ) : (
        <div className="table-container">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="px-3 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-gray-300 text-teal-500 focus:ring-teal-500 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3">Opportunity</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Deadline</th>
                <th className="px-4 py-3">Volume</th>
                <th className="px-4 py-3">Files</th>
                <th className="px-4 py-3">Interested</th>
                <th className="px-4 py-3">Submissions</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map(opp => (
                <tr 
                  key={opp.id} 
                  className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                    selected.has(opp.id) ? 'bg-teal-50/50' : ''
                  }`}
                >
                  <td className="px-3 py-4" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(opp.id)}
                      onChange={() => toggleSelect(opp.id)}
                      className="w-4 h-4 rounded border-gray-300 text-teal-500 focus:ring-teal-500 cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-4" onClick={() => navigate(`/admin/opportunities/${opp.id}`)}>
                    <div className="text-sm font-medium text-navy-950">
                      {opp.name}
                    </div>
                    {opp.company_name && (
                      <div className="text-xs text-gray-500 mt-0.5 font-medium">
                        {opp.company_name}
                      </div>
                    )}
                    <div className="flex gap-1.5 mt-1 flex-wrap">
                      {opp.carriers.map(c => (
                        <span key={c} className="badge-carrier">{c}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-4" onClick={() => navigate(`/admin/opportunities/${opp.id}`)}>
                    <span className={statusBadgeClass[opp.status]}>{opp.status}</span>
                  </td>
                  <td className="px-4 py-4" onClick={() => navigate(`/admin/opportunities/${opp.id}`)}>
                    <div className="flex items-center gap-1.5">
                      {opp.deadline && <Clock className="w-3.5 h-3.5 text-gray-400" />}
                      {getDeadlineDisplay(opp.deadline)}
                      {!opp.deadline && <span className="text-gray-400 text-xs">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600" onClick={() => navigate(`/admin/opportunities/${opp.id}`)}>{opp.annual_volume || '—'}</td>
                  <td className="px-4 py-4" onClick={() => navigate(`/admin/opportunities/${opp.id}`)}>
                    <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                      <FileText className="w-3.5 h-3.5" />
                      {opp.file_count}
                    </span>
                  </td>
                  <td className="px-4 py-4" onClick={() => navigate(`/admin/opportunities/${opp.id}`)}>
                    <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                      <Users className="w-3.5 h-3.5" />
                      {opp.interest_count}
                    </span>
                  </td>
                  <td className="px-4 py-4" onClick={() => navigate(`/admin/opportunities/${opp.id}`)}>
                    <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                      <Upload className="w-3.5 h-3.5" />
                      {opp.submission_count}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-500" onClick={() => navigate(`/admin/opportunities/${opp.id}`)}>{formatDate(opp.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
