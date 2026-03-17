import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../components/ui/Toast';
import { Opportunity, OpportunityFile } from '../../lib/types';
import {
  ArrowLeft, Download, FileText, Clock,
  Calendar, Package, Truck, CheckCircle, Upload, Check, Globe, Heart
} from 'lucide-react';

export default function VendorOpportunityDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [opp, setOpp] = useState<Opportunity | null>(null);
  const [files, setFiles] = useState<OpportunityFile[]>([]);
  const [interested, setInterested] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expressing, setExpressing] = useState(false);

  useEffect(() => {
    if (id) fetchAll();
  }, [id]);

  async function fetchAll() {
    const [oppRes, filesRes, interestRes] = await Promise.all([
      supabase.from('opportunities').select('*').eq('id', id).single(),
      supabase.from('opportunity_files').select('*').eq('opportunity_id', id),
      supabase.from('vendor_interest').select('id').eq('opportunity_id', id).eq('vendor_id', user!.id),
    ]);

    if (oppRes.data) setOpp(oppRes.data as Opportunity);
    if (filesRes.data) setFiles(filesRes.data as OpportunityFile[]);
    if (interestRes.data && interestRes.data.length > 0) setInterested(true);

    // Record view
    await supabase.from('vendor_views').insert({
      opportunity_id: id,
      vendor_id: user!.id,
    });

    setLoading(false);
  }

  async function handleInterest() {
    setExpressing(true);
    const { error } = await supabase.from('vendor_interest').insert({
      opportunity_id: id,
      vendor_id: user!.id,
    });
    if (error) {
      if (error.code === '23505') {
        setInterested(true); // Already expressed
      } else {
        toast('Failed to express interest', 'error');
      }
    } else {
      setInterested(true);
      toast("Interest recorded — the Ship Pros team will follow up!");
    }
    setExpressing(false);
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

  const formatDate = (date: string) => new Date(date).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getDeadlineInfo = () => {
    if (!opp?.deadline) return null;
    const diff = Math.ceil((new Date(opp.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { text: 'Expired', color: 'text-red-600 bg-red-50' };
    if (diff <= 3) return { text: `${diff} days remaining`, color: 'text-amber-600 bg-amber-50' };
    if (diff <= 7) return { text: `${diff} days remaining`, color: 'text-blue-600 bg-blue-50' };
    return { text: `Due ${formatDate(opp.deadline)}`, color: 'text-gray-600 bg-gray-50' };
  };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div></div>;
  if (!opp) return <div className="text-center py-12 text-gray-500">Opportunity not found</div>;

  const deadlineInfo = getDeadlineInfo();

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/vendor')} className="btn-ghost p-2">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="page-title">{opp.name}</h1>
          <p className="text-sm text-gray-500 mt-1">Posted {formatDate(opp.created_at)}</p>
        </div>
      </div>

      {/* Deadline banner */}
      {deadlineInfo && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg mb-6 ${deadlineInfo.color}`}>
          <Clock className="w-4 h-4" />
          <span className="text-sm font-medium">{deadlineInfo.text}</span>
        </div>
      )}

      {/* Metadata */}
      <div className="card p-6 mb-6">
        {opp.description && (
          <p className="text-sm text-gray-600 mb-5">{opp.description}</p>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-start gap-2">
            <Package className="w-4 h-4 text-gray-400 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500 mb-1">Current Carriers</p>
              <div className="flex flex-wrap gap-1">
                {opp.carriers.map(c => <span key={c} className="badge-carrier">{c}</span>)}
                {opp.carriers.length === 0 && <span className="text-sm text-gray-400">Not specified</span>}
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Truck className="w-4 h-4 text-gray-400 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500">Fulfillment Type</p>
              <p className="text-sm text-gray-900">{opp.fulfillment_type}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Globe className="w-4 h-4 text-gray-400 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500">Shipping Scope</p>
              <p className="text-sm text-gray-900">{opp.shipping_scope || 'Not specified'}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <FileText className="w-4 h-4 text-gray-400 mt-0.5" />
            <div>
              <p className="text-xs text-gray-500">Annual Volume</p>
              <p className="text-sm text-gray-900">{opp.annual_volume || 'Not specified'}</p>
            </div>
          </div>
          {opp.deadline && (
            <div className="flex items-start gap-2">
              <Calendar className="w-4 h-4 text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500">Deadline</p>
                <p className="text-sm text-gray-900">{formatDate(opp.deadline)}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Files */}
      <div className="card p-6 mb-6">
        <h2 className="section-title">
          <span className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-400" />
            Attachments ({files.length})
          </span>
        </h2>
        {files.length === 0 ? (
          <p className="text-sm text-gray-400">No files attached to this opportunity</p>
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

      {/* Interest Button */}
      <div className="card p-6">
        {interested ? (
          <div className="flex items-center justify-center gap-2 py-3 text-teal-600">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">You've expressed interest in this opportunity</span>
          </div>
        ) : (
          <button
            onClick={handleInterest}
            disabled={expressing}
            className="btn-primary w-full py-3 text-base"
          >
            <Heart className="w-5 h-5" />
            {expressing ? 'Recording...' : "I'm Interested"}
          </button>
        )}
      </div>
    </div>
  );
}
