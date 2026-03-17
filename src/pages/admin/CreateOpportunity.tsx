import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../components/ui/Toast';
import { CARRIERS, FulfillmentType, ShippingScope, OpportunityStatus, STATUSES } from '../../lib/types';
import { Upload, X, FileText, ArrowLeft } from 'lucide-react';

export default function CreateOpportunity() {
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [carriers, setCarriers] = useState<string[]>([]);
  const [annualVolume, setAnnualVolume] = useState('');
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>('Parcel');
  const [shippingScope, setShippingScope] = useState<ShippingScope>('Domestic');
  const [status, setStatus] = useState<OpportunityStatus>('Open');
  const [deadline, setDeadline] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [showOther, setShowOther] = useState(false);
  const [customCarrierInput, setCustomCarrierInput] = useState('');

  const standardCarriers = CARRIERS.filter(c => c !== 'Other');
  const customCarriers = carriers.filter(c => !standardCarriers.includes(c as any) && c !== 'Other');
  const isOtherChecked = showOther || customCarriers.length > 0;

  useEffect(() => {
    if (isEditing) {
      async function fetchOpportunity() {
        const { data, error } = await supabase.from('opportunities').select('*').eq('id', id).single();
        if (data && !error) {
          setName(data.name);
          setDescription(data.description || '');
          setCarriers(data.carriers || []);
          setAnnualVolume(data.annual_volume || '');
          setFulfillmentType(data.fulfillment_type as FulfillmentType);
          setShippingScope(data.shipping_scope as ShippingScope || 'Domestic');
          setStatus(data.status as OpportunityStatus);
          setDeadline(data.deadline || '');
          if (data.carriers && data.carriers.some((c: string) => !standardCarriers.includes(c as any) && c !== 'Other')) {
            setShowOther(true);
          }
        }
      }
      fetchOpportunity();
    }
  }, [id, isEditing]);

  const handleCarrierToggle = (carrier: string) => {
    if (carrier === 'Other') {
      if (isOtherChecked) {
        setCarriers(prev => prev.filter(c => standardCarriers.includes(c as any)));
        setShowOther(false);
      } else {
        setShowOther(true);
      }
      return;
    }
    setCarriers(prev =>
      prev.includes(carrier)
        ? prev.filter(c => c !== carrier)
        : [...prev, carrier]
    );
  };

  const handleFiles = (newFiles: FileList | null) => {
    if (newFiles) {
      setFiles(prev => [...prev, ...Array.from(newFiles)]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

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
    handleFiles(e.dataTransfer.files);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleSubmit = async (e: React.FormEvent, notify: boolean = false) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);

    try {
      // Create or update opportunity
      const oppData = {
        name: name.trim(),
        description: description.trim(),
        carriers,
        annual_volume: annualVolume.trim(),
        fulfillment_type: fulfillmentType,
        shipping_scope: shippingScope,
        status,
        deadline: deadline || null,
        created_by: user!.id,
      };

      let opp;
      if (isEditing) {
        const { data, error: oppError } = await supabase.from('opportunities').update(oppData).eq('id', id).select().single();
        if (oppError) throw oppError;
        opp = data;
      } else {
        const { data, error: oppError } = await supabase.from('opportunities').insert(oppData).select().single();
        if (oppError) throw oppError;
        opp = data;
      }

      // Upload files
      for (const file of files) {
        const filePath = `${opp.id}/${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('opportunity-files')
          .upload(filePath, file);

        if (uploadError) {
          console.error('File upload error:', uploadError);
          continue;
        }

        await supabase.from('opportunity_files').insert({
          opportunity_id: opp.id,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
        });
      }

      // Notify vendors if requested
      if (notify) {
        try {
          await supabase.functions.invoke('notify-vendors', {
            body: { opportunity_id: opp.id },
          });
          toast('Opportunity created & vendors notified!');
        } catch {
          toast('Opportunity created, but notification failed', 'error');
        }
      } else {
        toast(isEditing ? 'Opportunity updated successfully!' : 'Opportunity created successfully!');
      }

      navigate('/admin');
    } catch (err: any) {
      toast(err.message || 'Failed to create opportunity', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => isEditing ? navigate(`/admin/opportunities/${id}`) : navigate('/admin')} className="btn-ghost p-2">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="page-title">{isEditing ? 'Edit Opportunity' : 'New Opportunity'}</h1>
        </div>
      </div>

      <form onSubmit={e => handleSubmit(e, false)}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column — Metadata */}
          <div className="lg:col-span-2 space-y-6">
            <div className="card p-6 space-y-5">
              {/* Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Opportunity Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="input-field"
                  placeholder="e.g., Acme Corp Shipping RFQ"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                  Client Description
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="input-field min-h-[100px] resize-y"
                  placeholder="Brief context about the client and their shipping needs..."
                />
              </div>

              {/* Carriers */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Current Carrier(s)
                </label>
                <div className="flex flex-wrap gap-2">
                  {CARRIERS.map(carrier => {
                    const isChecked = carrier === 'Other' ? isOtherChecked : carriers.includes(carrier);
                    return (
                      <label
                        key={carrier}
                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-md border text-sm cursor-pointer transition-colors ${
                          isChecked
                            ? 'border-teal-500 bg-teal-50 text-teal-700'
                            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleCarrierToggle(carrier)}
                          className="sr-only"
                        />
                        {carrier}
                      </label>
                    );
                  })}
                </div>

                {isOtherChecked && (
                  <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-md">
                    <label className="block text-xs font-medium text-gray-700 mb-2">Add Custom Carriers</label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={customCarrierInput}
                        onChange={e => setCustomCarrierInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (customCarrierInput.trim()) {
                              setCarriers(prev => [...prev.filter(c => c !== 'Other'), customCarrierInput.trim()]);
                              setCustomCarrierInput('');
                            }
                          }
                        }}
                        className="input-field py-1.5 text-sm"
                        placeholder="Type carrier name and hit Enter..."
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (customCarrierInput.trim()) {
                            setCarriers(prev => [...prev.filter(c => c !== 'Other'), customCarrierInput.trim()]);
                            setCustomCarrierInput('');
                          }
                        }}
                        className="btn-secondary py-1.5 px-4 text-sm whitespace-nowrap"
                      >
                        Add
                      </button>
                    </div>
                    {customCarriers.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {customCarriers.map(cc => (
                          <span key={cc} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white border border-gray-300 text-xs font-medium text-gray-700">
                            {cc}
                            <button
                              type="button"
                              onClick={() => setCarriers(prev => prev.filter(c => c !== cc))}
                              className="text-gray-400 hover:text-red-500"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Volume + Fulfillment */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="volume" className="block text-sm font-medium text-gray-700 mb-1">
                    Est. Annual Shipping Volume
                  </label>
                  <input
                    id="volume"
                    type="text"
                    value={annualVolume}
                    onChange={e => setAnnualVolume(e.target.value)}
                    className="input-field"
                    placeholder='e.g., "$500K" or "50,000 packages"'
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fulfillment Type
                  </label>
                  <div className="flex gap-3">
                    {(['Parcel', 'Freight', 'Both'] as FulfillmentType[]).map(ft => (
                      <label
                        key={ft}
                        className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm cursor-pointer transition-colors ${
                          fulfillmentType === ft
                            ? 'border-teal-500 bg-teal-50 text-teal-700'
                            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="fulfillmentType"
                          value={ft}
                          checked={fulfillmentType === ft}
                          onChange={() => setFulfillmentType(ft)}
                          className="sr-only"
                        />
                        {ft}
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Shipping Scope + Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Shipping Scope
                  </label>
                  <div className="flex gap-3">
                    {(['Domestic', 'International', 'Both'] as ShippingScope[]).map(scope => (
                      <label
                        key={scope}
                        className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm cursor-pointer transition-colors ${
                          shippingScope === scope
                            ? 'border-teal-500 bg-teal-50 text-teal-700'
                            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="shippingScope"
                          value={scope}
                          checked={shippingScope === scope}
                          onChange={() => setShippingScope(scope)}
                          className="sr-only"
                        />
                        {scope}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    id="status"
                    value={status}
                    onChange={e => setStatus(e.target.value as OpportunityStatus)}
                    className="input-field"
                  >
                    {STATUSES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Deadline */}
              <div>
                <label htmlFor="deadline" className="block text-sm font-medium text-gray-700 mb-1">
                  Deadline
                </label>
                <input
                  id="deadline"
                  type="date"
                  value={deadline}
                  onChange={e => setDeadline(e.target.value)}
                  className="input-field"
                />
              </div>
            </div>
          </div>

          {/* Right column — File upload + actions */}
          <div className="space-y-6">
            {/* File Dropzone */}
            <div className="card p-6">
              <h3 className="section-title">Attachments</h3>
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
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
                  onChange={e => handleFiles(e.target.files)}
                  className="hidden"
                />
              </div>

              {/* File list */}
              {files.length > 0 && (
                <div className="mt-4 space-y-2">
                  {files.map((file, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 bg-gray-50 rounded-md">
                      <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 truncate">{file.name}</p>
                        <p className="text-xs text-gray-400 font-mono">{formatFileSize(file.size)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="card p-6 space-y-3">
              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="btn-secondary w-full"
              >
                {saving ? 'Saving...' : (isEditing ? 'Save Changes' : 'Save as Draft')}
              </button>
              {!isEditing && (
                <button
                  type="button"
                  disabled={saving || !name.trim()}
                  onClick={e => handleSubmit(e, true)}
                  className="btn-primary w-full"
                >
                  {saving ? 'Saving...' : 'Create & Notify Vendors'}
                </button>
              )}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
