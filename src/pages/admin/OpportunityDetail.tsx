import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Opportunity, OpportunityFile, VendorInterest, VendorView, OpportunityStatus, STATUSES } from '../../lib/types';
import { useToast } from '../../components/ui/Toast';
import {
  ArrowLeft, Download, FileText, Users, Eye, Trash2,
  Calendar, Package, Truck, Clock, Save, Globe
} from 'lucide-react';

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
  const [interests, setInterests] = useState<VendorInterest[]>([]);
  const [views, setViews] = useState<VendorView[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'interested' | 'viewed'>('interested');
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (id) fetchAll();
  }, [id]);

  async function fetchAll() {
    const [oppRes, filesRes, interestRes, viewsRes] = await Promise.all([
      supabase.from('opportunities').select('*').eq('id', id).single(),
      supabase.from('opportunity_files').select('*').eq('opportunity_id', id),
      supabase.from('vendor_interest').select('*, profiles(*)').eq('opportunity_id', id).order('created_at', { ascending: false }),
      supabase.from('vendor_views').select('*, profiles(*)').eq('opportunity_id', id).order('viewed_at', { ascending: false }),
    ]);
    if (oppRes.data) setOpp(oppRes.data as Opportunity);
    if (filesRes.data) setFiles(filesRes.data as OpportunityFile[]);
    if (interestRes.data) {
      setInterests(interestRes.data as VendorInterest[]);
      const notes: Record<string, string> = {};
      interestRes.data.forEach((i: any) => { notes[i.id] = i.admin_notes || ''; });
      setEditingNotes(notes);
    }
    if (viewsRes.data) setViews(viewsRes.data as VendorView[]);
    setLoading(false);
  }

  async function handleDownload(file: OpportunityFile) {
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
    if (!confirm('Are you sure you want to delete this opportunity? This cannot be undone.')) return;
    setDeleting(true);
    // Delete storage files first
    for (const file of files) {
      await supabase.storage.from('opportunity-files').remove([file.file_path]);
    }
    const { error } = await supabase.from('opportunities').delete().eq('id', id);
    if (error) { toast('Failed to delete', 'error'); setDeleting(false); return; }
    toast('Opportunity deleted');
    navigate('/admin');
  }

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
            <div className="flex items-center gap-2 mt-1">
              <span className={statusBadgeClass[opp.status]}>{opp.status}</span>
              <span className="text-sm text-gray-500">Created {formatDate(opp.created_at)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
          <button onClick={handleDelete} disabled={deleting} className="btn-danger">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Metadata + Files */}
        <div className="lg:col-span-2 space-y-6">
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
                  <p className="text-xs text-gray-500">Shipping Scope</p>
                  <p className="text-sm text-gray-900">{opp.shipping_scope}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <FileText className="w-4 h-4 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">Annual Volume</p>
                  <p className="text-sm text-gray-900">{opp.annual_volume || '—'}</p>
                </div>
              </div>
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
                    <button onClick={() => handleDownload(file)} className="btn-secondary text-sm py-1.5 px-3">
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Vendor Engagement */}
        <div className="space-y-6">
          <div className="card">
            <div className="flex border-b border-gray-200">
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
            </div>

            <div className="p-4">
              {tab === 'interested' ? (
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
              ) : (
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
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
