import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../components/ui/Toast';
import { Opportunity, OpportunityFile, VendorSubmission } from '../../lib/types';
import { DataPreviewModal } from '../../components/ui/DataPreviewModal';
import { formatSpend, formatVolume } from '../../lib/format';
import {
  ArrowLeft, Download, FileText, Clock,
  Calendar, Package, Truck, CheckCircle, Upload, Check, Globe, Heart, Table2, X, DollarSign, Building2
} from 'lucide-react';

export default function VendorOpportunityDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [opp, setOpp] = useState<Opportunity | null>(null);
  const [files, setFiles] = useState<OpportunityFile[]>([]);
  const [submissions, setSubmissions] = useState<VendorSubmission[]>([]);
  const [interested, setInterested] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expressing, setExpressing] = useState(false);
  const [previewFile, setPreviewFile] = useState<OpportunityFile | null>(null);

  const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (id) fetchAll();
  }, [id]);

  async function fetchAll() {
    const [oppRes, filesRes, interestRes, submissionsRes] = await Promise.all([
      supabase.from('opportunities').select('*').eq('id', id).single(),
      supabase.from('opportunity_files').select('*').eq('opportunity_id', id),
      supabase.from('vendor_interest').select('id').eq('opportunity_id', id).eq('vendor_id', user!.id),
      supabase.from('vendor_submissions').select('*').eq('opportunity_id', id).eq('vendor_id', user!.id).order('created_at', { ascending: false }),
    ]);

    if (oppRes.data) setOpp(oppRes.data as Opportunity);
    if (filesRes.data) setFiles(filesRes.data as OpportunityFile[]);
    if (interestRes.data && interestRes.data.length > 0) setInterested(true);
    if (submissionsRes.data) setSubmissions(submissionsRes.data as VendorSubmission[]);

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

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files) {
      setUploadingFiles(prev => [...prev, ...Array.from(e.dataTransfer.files!)]);
    }
  };

  const removeUploadingFile = (index: number) => {
    setUploadingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const submitFiles = async () => {
    if (uploadingFiles.length === 0) return;
    setIsUploading(true);
    
    let uploadedCount = 0;

    for (const file of uploadingFiles) {
      const filePath = `submissions/${id}/${user!.id}/${crypto.randomUUID()}-${file.name}`;
      
      const { error: uploadError } = await supabase.storage
        .from('opportunity-files')
        .upload(filePath, file);

      if (uploadError) {
        console.error('File upload error:', uploadError);
        toast(`Failed to upload ${file.name}`, 'error');
        continue;
      }

      const { data: submissionData, error: dbError } = await supabase.from('vendor_submissions').insert({
        opportunity_id: id,
        vendor_id: user!.id,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
      }).select().single();

      if (dbError) {
        console.error('DB Insert error:', dbError);
      } else if (submissionData) {
        setSubmissions(prev => [submissionData as VendorSubmission, ...prev]);
        uploadedCount++;
        
        supabase.functions.invoke('notify-admin-submission', {
          body: { submission_id: submissionData.id },
        }).catch(err => console.error("Notification failed:", err));
      }
    }

    if (uploadedCount > 0) {
      toast(`Successfully uploaded ${uploadedCount} file${uploadedCount > 1 ? 's' : ''}`);
    }
    
    setUploadingFiles([]);
    setIsUploading(false);
  };

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
    <div className="max-w-3xl mx-auto space-y-6">
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
      <div className="card p-6">
        {opp.description && (
          <div className="mb-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-1">Notes</h3>
            <p className="text-sm text-gray-600">{opp.description}</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <p className="text-xs text-gray-500">Shipping Region</p>
              <p className="text-sm text-gray-900">{Array.isArray(opp.shipping_scope) ? opp.shipping_scope.join(', ') : (opp.shipping_scope || 'Not specified')}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <DollarSign className="w-4 h-4 text-gray-400 mt-0.5" />
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

      {/* Files from Admin */}
      <div className="card p-6">
        <h2 className="section-title">
          <span className="flex items-center gap-2">
            <Download className="w-5 h-5 text-gray-400" />
            Opportunity Files ({files.length})
          </span>
        </h2>
        <p className="text-sm text-gray-500 mb-4">Files provided by the prospective client.</p>
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

      {/* Vendor File Submissions */}
      <div className="card p-6">
        <h2 className="section-title">
          <span className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-gray-400" />
            Your Submissions ({submissions.length})
          </span>
        </h2>
        <p className="text-sm text-gray-500 mb-4">Upload your proposals, data sheets, and quotes here.</p>
        
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-6 mb-4 text-center cursor-pointer transition-colors ${
            dragActive
              ? 'border-teal-500 bg-teal-50'
              : 'border-gray-300 bg-gray-50 hover:border-gray-400'
          }`}
        >
          <Upload className={`w-8 h-8 mx-auto mb-2 ${dragActive ? 'text-teal-500' : 'text-gray-400'}`} />
          <p className="text-sm text-gray-600 mb-1">
            Drop files here or <span className="text-teal-500 font-medium">browse</span>
          </p>
          <p className="text-xs text-gray-400">CSV, Excel, PDF, or any file type</p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={e => {
              if (e.target.files) {
                setUploadingFiles(prev => [...prev, ...Array.from(e.target.files!)]);
              }
            }}
            className="hidden"
          />
        </div>

        {uploadingFiles.length > 0 && (
          <div className="mb-4">
            <div className="space-y-2 mb-3">
              {uploadingFiles.map((file, i) => (
                <div key={i} className="flex items-center gap-3 p-2 bg-white border border-gray-200 rounded-md">
                  <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 truncate">{file.name}</p>
                    <p className="text-xs text-gray-400 font-mono">{formatFileSize(file.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeUploadingFile(i)}
                    className="text-gray-400 hover:text-red-500"
                    disabled={isUploading}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={submitFiles}
              disabled={isUploading || uploadingFiles.length === 0}
              className="btn-primary w-full"
            >
              {isUploading ? 'Uploading...' : `Submit ${uploadingFiles.length} File${uploadingFiles.length > 1 ? 's' : ''}`}
            </button>
          </div>
        )}

        {submissions.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Previously Uploaded</h4>
            {submissions.map(sub => (
              <div key={sub.id} className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-md">
                <FileText className="w-5 h-5 text-teal-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{sub.file_name}</p>
                  <p className="text-xs text-gray-400">
                    Uploaded {formatDate(sub.created_at)} • <span className="font-mono">{formatFileSize(sub.file_size)}</span>
                  </p>
                </div>
                <button onClick={() => handleDownload(sub)} className="btn-secondary text-sm py-1.5 px-3 whitespace-nowrap">
                  <Download className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {previewFile && (
        <DataPreviewModal file={previewFile as OpportunityFile} onClose={() => setPreviewFile(null)} />
      )}
    </div>
  );
}
