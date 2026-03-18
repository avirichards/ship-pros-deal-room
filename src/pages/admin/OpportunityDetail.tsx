import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Opportunity, OpportunityFile, VendorInterest, VendorView, OpportunityStatus, STATUSES, VendorSubmission } from '../../lib/types';
import { useToast } from '../../components/ui/Toast';
import {
  ArrowLeft, Download, FileText, Users, Eye, Trash2,
  Calendar, Package, Truck, Clock, Save, Globe, Table2, Upload, Bell
} from 'lucide-react';
import { DataPreviewModal } from '../../components/ui/DataPreviewModal';
import { formatSpend, formatVolume } from '../../lib/format';

const statusBadgeClass: Record<OpportunityStatus, string> = {
  'Open': 'badge-open', 'Quoted': 'badge-quoted',
  'Closed/Won': 'badge-won', 'Closed/Lost': 'badge-lost',
};

export default function AdminOpportunityDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [opp, setOpp] = useState<Opportunity | null>(null);
  const [files, setFiles] = useState<OpportunityFile[]>([]);
  const [submissions, setSubmissions] = useState<VendorSubmission[]>([]);
  const [interests, setInterests] = useState<VendorInterest[]>([]);
  const [views, setViews] = useState<VendorView[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'interested' | 'viewed' | 'submissions'>('submissions');
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [notifyVendorsList, setNotifyVendorsList] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVendors, setSelectedVendors] = useState<Set<string>>(new Set());
  const [sendingNotification, setSendingNotification] = useState(false);
  const [previewFile, setPreviewFile] = useState<OpportunityFile | null>(null);

  useEffect(() => {
    if (id) fetchAll();
  }, [id]);

  async function fetchAll() {
    const [oppRes, filesRes, interestRes, viewsRes, submissionsRes] = await Promise.all([
      supabase.from('opportunities').select('*').eq('id', id).single(),
      supabase.from('opportunity_files').select('*').eq('opportunity_id', id),
      supabase.from('vendor_interest').select('*, profiles(*)').eq('opportunity_id', id).order('created_at', { ascending: false }),
      supabase.from('vendor_views').select('*, profiles(*)').eq('opportunity_id', id).order('viewed_at', { ascending: false }),
      supabase.from('vendor_submissions').select('*, profiles(*)').eq('opportunity_id', id).order('created_at', { ascending: false }),
    ]);
    if (oppRes.data) setOpp(oppRes.data as Opportunity);
    if (filesRes.data) setFiles(filesRes.data as OpportunityFile[]);
    if (submissionsRes.data) setSubmissions(submissionsRes.data as VendorSubmission[]);
    if (interestRes.data) {
      setInterests(interestRes.data as VendorInterest[]);
      const notes: Record<string, string> = {};
      interestRes.data.forEach((i: any) => { notes[i.id] = i.admin_notes || ''; });
      setEditingNotes(notes);
    }
    if (viewsRes.data) setViews(viewsRes.data as VendorView[]);
    setLoading(false);
  }

  async function handleDownload(file: OpportunityFile | VendorSubmission) {
    const { data, error } = await supabase.storage
      .from('opportunity-files')
      .download(file.file_path);
    if (error) { toast('Download failed', 'error'); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.file_name;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleStatusChange(newStatus: OpportunityStatus) {
    const { error } = await supabase
      .from('opportunities')
      .update({ status: newStatus })
      .eq('id', id);
    if (error) { toast('Failed to update status', 'error'); return; }
    setOpp(prev => prev ? { ...prev, status: newStatus } : null);
    toast('Status updated');
  }

  async function handleSaveNotes(interestId: string) {
    const { error } = await supabase
      .from('vendor_interest')
      .update({ admin_notes: editingNotes[interestId] })
      .eq('id', interestId);
    if (error) { toast('Failed to save notes', 'error'); return; }
    toast('Notes saved');
  }

  async function handleDelete() {
    setShowDeleteConfirm(false);
    setDeleting(true);
    // Delete storage files first
    for (const file of files) {
      await supabase.storage.from('opportunity-files').remove([file.file_path]);
    }
    // Delete submission files
    for (const sub of submissions) {
      await supabase.storage.from('opportunity-files').remove([sub.file_path]);
    }
    const { error } = await supabase.from('opportunities').delete().eq('id', id);
    if (error) { toast('Failed to delete', 'error'); setDeleting(false); return; }
    toast('Opportunity deleted');
    navigate('/admin');
  }

  useEffect(() => {
    if (showNotifyModal && notifyVendorsList.length === 0) {
      supabase.from('profiles').select('id, email, full_name, company').eq('role', 'vendor').then(({ data }) => {
        if (data) setNotifyVendorsList(data);
      });
    }
  }, [showNotifyModal, notifyVendorsList.length]);

  async function handleNotifyVendors() {
    if (selectedVendors.size === 0) return;
    setSendingNotification(true);
    try {
      const vendorIds = Array.from(selectedVendors);
      await supabase.functions.invoke('notify-vendors', {
        body: { opportunity_id: id, vendor_ids: vendorIds }
      });
      toast(`Notification sent to ${vendorIds.length} vendor(s)`);
      setShowNotifyModal(false);
      setSelectedVendors(new Set());
    } catch (err) {
      toast('Failed to send notifications', 'error');
    } finally {
      setSendingNotification(false);
    }
  }

  const toggleVendorSelection = (vendorId: string) => {
    const newSet = new Set(selectedVendors);
    if (newSet.has(vendorId)) newSet.delete(vendorId);
    else newSet.add(vendorId);
    setSelectedVendors(newSet);
  };

  const filteredVendors = notifyVendorsList.filter(v => 
    (v.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (v.company || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (v.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  const formatDate = (date: string) => new Date(date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getDeadlineUrgency = () => {
    if (!opp?.deadline) return null;
    const diff = Math.ceil((new Date(opp.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { text: 'Expired', color: 'text-red-600 bg-red-50' };
    if (diff <= 3) return { text: `${diff} days left`, color: 'text-amber-600 bg-amber-50' };
    if (diff <= 7) return { text: `${diff} days left`, color: 'text-blue-600 bg-blue-50' };
    return { text: formatDate(opp.deadline), color: 'text-gray-600 bg-gray-50' };
  };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div></div>;
  if (!opp) return <div className="text-center py-12 text-gray-500">Opportunity not found</div>;

  const deadlineInfo = getDeadlineUrgency();

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admin')} className="btn-ghost p-2">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="page-title">{opp.name}</h1>
            {opp.company_name && (
              <p className="text-sm text-gray-500 font-medium mt-0.5 mb-1">{opp.company_name}</p>
            )}
            <div className="flex items-center gap-2 mt-1">
              <span className={statusBadgeClass[opp.status]}>{opp.status}</span>
              <span className="text-sm text-gray-500">Created {formatDate(opp.created_at)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowNotifyModal(true)} className="btn-primary px-3 py-2 text-sm">
            <Bell className="w-4 h-4 mr-1.5 inline" />
            Notify Vendors
          </button>
          <select
            value={opp.status}
            onChange={e => handleStatusChange(e.target.value as OpportunityStatus)}
            className="input-field w-auto"
          >
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={() => navigate(`/admin/opportunities/${opp.id}/edit`)} className="btn-secondary px-3 py-2 text-sm text-gray-700">
            Edit
          </button>
          <button onClick={() => setShowDeleteConfirm(true)} disabled={deleting} className="btn-danger">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Opportunity</h3>
            <p className="text-sm text-gray-600 mb-6">Are you sure you want to delete this opportunity? All associated files and submissions will be permanently removed. This cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="btn-secondary px-4 py-2 text-sm">
                Cancel
              </button>
              <button onClick={handleDelete} className="btn-danger px-4 py-2 text-sm">
                <Trash2 className="w-4 h-4" />
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
            <p className="text-sm text-gray-600 mb-4">Select the vendors you want to notify about this opportunity.</p>
            
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
                onClick={handleNotifyVendors}
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Metadata + Files */}
        <div className="lg:col-span-7 space-y-6">
          {/* Metadata Card */}
          <div className="card p-6">
            <h2 className="section-title">Details</h2>
            {opp.description && (
              <p className="text-sm text-gray-600 mb-4">{opp.description}</p>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-start gap-2">
                <Package className="w-4 h-4 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">Carriers</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {opp.carriers.map(c => <span key={c} className="badge-carrier">{c}</span>)}
                    {opp.carriers.length === 0 && <span className="text-sm text-gray-400">—</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Truck className="w-4 h-4 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">Fulfillment</p>
                  <p className="text-sm text-gray-900">{opp.fulfillment_type}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Globe className="w-4 h-4 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">Shipping Region</p>
                  <p className="text-sm text-gray-900">{Array.isArray(opp.shipping_scope) ? opp.shipping_scope.join(', ') : opp.shipping_scope}</p>
                </div>
              </div>
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">Annual Spend (est)</p>
                    <p className="text-sm text-gray-900">{formatSpend(opp.annual_volume)}</p>
                  </div>
                </div>
                {opp.annual_parcel_volume && (
                  <div className="flex items-start gap-2">
                    <Package className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-500">Annual Parcel Volume (est)</p>
                      <p className="text-sm text-gray-900">{formatVolume(opp.annual_parcel_volume)}</p>
                    </div>
                  </div>
                )}
              {deadlineInfo && (
                <div className="flex items-start gap-2">
                  <Calendar className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">Deadline</p>
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${deadlineInfo.color}`}>
                      {deadlineInfo.text}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Files Card */}
          <div className="card p-6">
            <h2 className="section-title">
              <span className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-400" />
                Attachments ({files.length})
              </span>
            </h2>
            {files.length === 0 ? (
              <p className="text-sm text-gray-400">No files attached</p>
            ) : (
              <div className="space-y-2">
                {files.map(file => (
                  <div key={file.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-md">
                    <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700 truncate">{file.file_name}</p>
                      <p className="text-xs text-gray-400 font-mono">{formatFileSize(file.file_size)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {file.file_name.toLowerCase().endsWith('.csv') && (
                        <button onClick={() => setPreviewFile(file)} className="btn-secondary text-sm py-1.5 px-3">
                          <Table2 className="w-4 h-4" />
                          <span className="hidden sm:inline">Preview</span>
                        </button>
                      )}
                      <button onClick={() => handleDownload(file)} className="btn-secondary text-sm py-1.5 px-3">
                        <Download className="w-4 h-4" />
                        <span className="hidden sm:inline">Download</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Vendor Engagement */}
        <div className="lg:col-span-5 space-y-6">
          <div className="card">
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setTab('submissions')}
                className={`flex-1 px-4 py-3 text-sm font-medium text-center border-b-2 transition-colors ${
                  tab === 'submissions'
                    ? 'border-teal-500 text-teal-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Upload className="w-4 h-4 inline mr-1.5" />
                Submissions ({submissions.length})
              </button>
              <button
                onClick={() => setTab('viewed')}
                className={`flex-1 px-4 py-3 text-sm font-medium text-center border-b-2 transition-colors ${
                  tab === 'viewed'
                    ? 'border-teal-500 text-teal-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Eye className="w-4 h-4 inline mr-1.5" />
                Viewed ({views.length})
              </button>
              <button
                onClick={() => setTab('interested')}
                className={`flex-1 px-4 py-3 text-sm font-medium text-center border-b-2 transition-colors ${
                  tab === 'interested'
                    ? 'border-teal-500 text-teal-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Users className="w-4 h-4 inline mr-1.5" />
                Interested ({interests.length})
              </button>
            </div>

            <div className="p-4">
              {tab === 'submissions' ? (
                submissions.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No submissions yet</p>
                ) : (() => {
                  const grouped: Record<string, VendorSubmission[]> = {};
                  for (const sub of submissions) {
                    const vendorId = sub.vendor_id;
                    if (!grouped[vendorId]) grouped[vendorId] = [];
                    grouped[vendorId].push(sub);
                  }
                  return (
                    <div className="space-y-4">
                      {Object.entries(grouped).map(([vendorId, vendorSubs]) => {
                        const profile = (vendorSubs[0] as any).profiles;
                        const vendorName = profile?.full_name || 'Unknown';
                        const vendorCompany = profile?.company || '';
                        const vendorEmail = profile?.email || '';
                        const initials = vendorName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
                        return (
                          <div key={vendorId} className="border border-gray-200 rounded-lg overflow-hidden">
                            <div className="bg-gradient-to-r from-navy-950 to-navy-900 px-4 py-3 flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-teal-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                                {initials}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-white truncate">{vendorName}</p>
                                <p className="text-xs text-gray-300 truncate">
                                  {vendorCompany ? `${vendorCompany} · ${vendorEmail}` : vendorEmail}
                                </p>
                              </div>
                              <span className="text-xs text-teal-300 font-medium whitespace-nowrap">
                                {vendorSubs.length} file{vendorSubs.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                            <div className="divide-y divide-gray-100">
                              {vendorSubs.map(sub => (
                                <div key={sub.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors">
                                  <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm text-gray-700 truncate">{sub.file_name}</p>
                                    <p className="text-xs text-gray-400">
                                      {formatDate(sub.created_at)} · {formatFileSize(sub.file_size)}
                                    </p>
                                  </div>
                                  <button onClick={() => handleDownload(sub)} className="btn-secondary text-xs py-1 px-2 flex-shrink-0">
                                    <Download className="w-3 h-3 mr-1 inline" />
                                    Get
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              ) : tab === 'interested' ? (
                interests.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No vendor interest yet</p>
                ) : (
                  <div className="space-y-4">
                    {interests.map(interest => (
                      <div key={interest.id} className="border border-gray-200 rounded-md p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {(interest as any).profiles?.full_name || 'Unknown'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {(interest as any).profiles?.company || (interest as any).profiles?.email}
                            </p>
                          </div>
                          <span className="text-xs text-gray-400">{formatDate(interest.created_at)}</span>
                        </div>
                        {/* Admin notes */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editingNotes[interest.id] || ''}
                            onChange={e => setEditingNotes(prev => ({ ...prev, [interest.id]: e.target.value }))}
                            placeholder="Add notes (e.g., follow-up status)..."
                            className="input-field text-xs py-1.5"
                          />
                          <button
                            onClick={() => handleSaveNotes(interest.id)}
                            className="btn-ghost p-1.5 flex-shrink-0"
                            title="Save notes"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : tab === 'viewed' ? (
                views.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No views yet</p>
                ) : (
                  <div className="space-y-2">
                    {views.map(view => (
                      <div key={view.id} className="flex items-center justify-between p-2">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {(view as any).profiles?.full_name || 'Unknown'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {(view as any).profiles?.company || (view as any).profiles?.email}
                          </p>
                        </div>
                        <span className="text-xs text-gray-400">{formatDate(view.viewed_at)}</span>
                      </div>
                    ))}
                  </div>
                )
                ) : null}
            </div>
          </div>
        </div>
      </div>

      {previewFile && (
        <DataPreviewModal file={previewFile as OpportunityFile} onClose={() => setPreviewFile(null)} />
      )}
    </div>
  );
}
