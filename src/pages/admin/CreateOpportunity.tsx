import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../components/ui/Toast';
import { CARRIERS, FulfillmentType, SHIPPING_REGIONS, ShippingRegion, OpportunityStatus, STATUSES } from '../../lib/types';
import { Upload, X, FileText, ArrowLeft, Bell, Trash2 } from 'lucide-react';

export default function CreateOpportunity() {
  const { id } = useParams<{ id: string }>();
  const isEditing = !!id;
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [industryCategory, setIndustryCategory] = useState('');
  const [description, setDescription] = useState('');
  const [carriers, setCarriers] = useState<string[]>([]);
  const [annualVolume, setAnnualVolume] = useState('');
  const [annualParcelVolume, setAnnualParcelVolume] = useState('');
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>('Parcel');
  const [shippingRegions, setShippingRegions] = useState<ShippingRegion[]>(['Domestic']);
  const [status, setStatus] = useState<OpportunityStatus>('Open');
  const [deadline, setDeadline] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [showOther, setShowOther] = useState(false);
  const [customCarrierInput, setCustomCarrierInput] = useState('');

  // Existing files from DB (when editing)
  interface ExistingFile {
    id: string;
    file_name: string;
    file_path: string;
    file_size: number;
  }
  const [existingFiles, setExistingFiles] = useState<ExistingFile[]>([]);

  // Dirty state tracking
  const [initialValues, setInitialValues] = useState<Record<string, any> | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [showNotifyDialog, setShowNotifyDialog] = useState(false);
  const [pendingBackTarget, setPendingBackTarget] = useState<string | null>(null);

  const standardCarriers = CARRIERS.filter(c => c !== 'Other');
  const customCarriersArr = carriers.filter(c => !standardCarriers.includes(c as any) && c !== 'Other');
  const isOtherChecked = showOther || customCarriersArr.length > 0;

  // Snapshot initial values when editing
  useEffect(() => {
    if (isEditing) {
      async function fetchOpportunity() {
        const { data, error } = await supabase.from('opportunities').select('*').eq('id', id).single();
        if (data && !error) {
          setName(data.name);
          setCompanyName(data.company_name || '');
          setIndustryCategory(data.industry_category || '');
          setDescription(data.description || '');
          setCarriers(data.carriers || []);
          setAnnualVolume(data.annual_volume || '');
          setAnnualParcelVolume(data.annual_parcel_volume || '');
          setFulfillmentType(data.fulfillment_type as FulfillmentType);
          setShippingRegions(Array.isArray(data.shipping_scope) ? data.shipping_scope : [data.shipping_scope || 'Domestic']);
          setStatus(data.status as OpportunityStatus);
          setDeadline(data.deadline || '');
          if (data.carriers && data.carriers.some((c: string) => !standardCarriers.includes(c as any) && c !== 'Other')) {
            setShowOther(true);
          }
          // Save initial values for dirty checking
          setInitialValues({
            name: data.name,
            companyName: data.company_name || '',
            industryCategory: data.industry_category || '',
            description: data.description || '',
            carriers: JSON.stringify(data.carriers || []),
            annualVolume: data.annual_volume || '',
            annualParcelVolume: data.annual_parcel_volume || '',
            fulfillmentType: data.fulfillment_type,
            shippingRegions: JSON.stringify(Array.isArray(data.shipping_scope) ? data.shipping_scope : [data.shipping_scope || 'Domestic']),
            status: data.status,
            deadline: data.deadline || '',
          });

          // Fetch existing files
          const { data: filesData } = await supabase
            .from('opportunity_files')
            .select('id, file_name, file_path, file_size')
            .eq('opportunity_id', id);
          if (filesData) setExistingFiles(filesData);
        }
      }
      fetchOpportunity();
    }
  }, [id, isEditing]);

  // Check dirty state whenever form values change 
  useEffect(() => {
    if (!isEditing || !initialValues) return;
    const currentValues = {
      name,
      companyName,
      industryCategory,
      description,
      carriers: JSON.stringify(carriers),
      annualVolume,
      annualParcelVolume,
      fulfillmentType,
      shippingRegions: JSON.stringify(shippingRegions),
      status,
      deadline,
    };
    const dirty = Object.keys(currentValues).some(
      key => (currentValues as any)[key] !== (initialValues as any)[key]
    ) || files.length > 0;
    setIsDirty(dirty);
  }, [name, description, carriers, annualVolume, annualParcelVolume, fulfillmentType, shippingRegions, status, deadline, files, initialValues, isEditing, companyName, industryCategory]);

  // Warn on browser back / tab close
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const handleBack = useCallback(() => {
    const target = isEditing ? `/admin/opportunities/${id}` : '/admin';
    if (isDirty) {
      setPendingBackTarget(target);
      setShowUnsavedDialog(true);
    } else {
      navigate(target);
    }
  }, [isDirty, isEditing, id, navigate]);

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

  const removeExistingFile = async (file: ExistingFile) => {
    try {
      // Delete from storage
      await supabase.storage.from('opportunity-files').remove([file.file_path]);
      // Delete from DB
      await supabase.from('opportunity_files').delete().eq('id', file.id);
      // Update local state
      setExistingFiles(prev => prev.filter(f => f.id !== file.id));
      setIsDirty(true);
      toast('File removed');
    } catch (err: any) {
      toast('Failed to remove file', 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent | null, notify: boolean = false) => {
    if (e) e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);

    try {
      const oppData = {
        name: name.trim(),
        company_name: companyName.trim(),
        industry_category: industryCategory.trim(),
        description: description.trim(),
        carriers,
        annual_volume: annualVolume.trim(),
        annual_parcel_volume: annualParcelVolume.trim(),
        fulfillment_type: fulfillmentType,
        shipping_scope: shippingRegions,
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
          toast(isEditing ? 'Changes saved & vendors notified!' : 'Opportunity created & vendors notified!');
        } catch {
          toast('Saved, but notification failed', 'error');
        }
      } else {
        toast(isEditing ? 'Opportunity updated successfully!' : 'Opportunity created successfully!');
      }

      navigate('/admin');
    } catch (err: any) {
      toast(err.message || 'Failed to save opportunity', 'error');
    } finally {
      setSaving(false);
    }
  };

  // For edit mode: show notify dialog instead of saving directly
  const handleEditSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing) {
      setShowNotifyDialog(true);
    } else {
      handleSubmit(e, false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={handleBack} className="btn-ghost p-2">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="page-title">{isEditing ? 'Edit Opportunity' : 'New Opportunity'}</h1>
        </div>
      </div>

      {/* Unsaved Changes Dialog */}
      {showUnsavedDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowUnsavedDialog(false)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Unsaved Changes</h3>
            <p className="text-sm text-gray-600 mb-6">You have unsaved changes. Would you like to save them before leaving?</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowUnsavedDialog(false);
                  if (pendingBackTarget) navigate(pendingBackTarget);
                }}
                className="btn-secondary px-4 py-2 text-sm"
              >
                Discard
              </button>
              <button
                onClick={() => {
                  setShowUnsavedDialog(false);
                  if (isEditing) {
                    setShowNotifyDialog(true);
                  } else {
                    handleSubmit(null, false);
                  }
                }}
                className="btn-primary px-4 py-2 text-sm"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notify Vendors Dialog (edit mode) */}
      {showNotifyDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowNotifyDialog(false)} />
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-teal-50 rounded-lg">
                <Bell className="w-5 h-5 text-teal-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Notify Vendors?</h3>
            </div>
            <p className="text-sm text-gray-600 mb-6">Would you like to notify all vendors about the changes to this opportunity?</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowNotifyDialog(false);
                  handleSubmit(null, false);
                }}
                className="btn-secondary px-4 py-2 text-sm"
              >
                Save Only
              </button>
              <button
                onClick={() => {
                  setShowNotifyDialog(false);
                  handleSubmit(null, true);
                }}
                className="btn-primary px-4 py-2 text-sm"
              >
                <Bell className="w-4 h-4" />
                Save & Notify
              </button>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleEditSave}>
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
                  placeholder="e.g., Q1 Logistics RFQ"
                  required
                />
              </div>

              {/* Company Name */}
              <div>
                <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1">
                  Company Name <span className="text-gray-400 font-normal">(Visible only to Admins)</span>
                </label>
                <input
                  id="companyName"
                  type="text"
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  className="input-field"
                  placeholder="e.g., Acme Corp"
                />
              </div>

              {/* Industry Category */}
              <div>
                <label htmlFor="industryCategory" className="block text-sm font-medium text-gray-700 mb-1">
                  Industry Category
                </label>
                <input
                  id="industryCategory"
                  type="text"
                  value={industryCategory}
                  onChange={e => setIndustryCategory(e.target.value)}
                  className="input-field"
                  placeholder="e.g., E-commerce, Retail, Healthcare"
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
                    {customCarriersArr.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {customCarriersArr.map(cc => (
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div>
                  <label htmlFor="volume" className="block text-sm font-medium text-gray-700 mb-1">
                    Estimated Annual Shipping Spend
                  </label>
                  <input
                    id="volume"
                    type="text"
                    value={annualVolume}
                    onChange={e => setAnnualVolume(e.target.value)}
                    className="input-field"
                    placeholder='e.g., "$500,000" or "500K"'
                  />
                </div>
                <div>
                  <label htmlFor="parcelVolume" className="block text-sm font-medium text-gray-700 mb-1">
                    Estimated Annual Parcel Volume
                  </label>
                  <input
                    id="parcelVolume"
                    type="text"
                    value={annualParcelVolume}
                    onChange={e => setAnnualParcelVolume(e.target.value)}
                    className="input-field"
                    placeholder='e.g., "50000"'
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
                    Shipping Region
                  </label>
                  <div className="flex gap-3">
                    {SHIPPING_REGIONS.map(region => {
                      const isSelected = shippingRegions.includes(region);
                      return (
                        <label
                          key={region}
                          className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm cursor-pointer transition-colors ${
                            isSelected
                              ? 'border-teal-500 bg-teal-50 text-teal-700'
                              : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              setShippingRegions(prev =>
                                isSelected
                                  ? prev.filter(r => r !== region)
                                  : [...prev, region]
                              );
                            }}
                            className="sr-only"
                          />
                          {region}
                        </label>
                      );
                    })}
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

              {/* Existing files (when editing) */}
              {existingFiles.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Current Files</p>
                  <div className="space-y-2">
                    {existingFiles.map(file => (
                      <div key={file.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-md border border-gray-200">
                        <FileText className="w-4 h-4 text-teal-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-700 truncate">{file.file_name}</p>
                          <p className="text-xs text-gray-400 font-mono">{formatFileSize(file.file_size)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeExistingFile(file)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                          title="Remove file"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New files to upload */}
              {files.length > 0 && (
                <div className="mt-4">
                  {existingFiles.length > 0 && (
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">New Files</p>
                  )}
                  <div className="space-y-2">
                    {files.map((file, i) => (
                      <div key={i} className="flex items-center gap-3 p-2 bg-teal-50 rounded-md border border-teal-200">
                        <FileText className="w-4 h-4 text-teal-500 flex-shrink-0" />
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
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="card p-6 space-y-3">
              {isEditing ? (
                <button
                  type="submit"
                  disabled={saving || !name.trim()}
                  className={`w-full font-medium py-2.5 px-4 rounded-lg text-sm transition-all duration-200 ${
                    isDirty
                      ? 'bg-teal-500 hover:bg-teal-600 text-white shadow-md shadow-teal-500/25 ring-2 ring-teal-300'
                      : 'btn-secondary'
                  }`}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              ) : (
                <>
                  <button
                    type="submit"
                    disabled={saving || !name.trim()}
                    className="btn-secondary w-full"
                  >
                    {saving ? 'Saving...' : 'Save Without Notifying'}
                  </button>
                  <button
                    type="button"
                    disabled={saving || !name.trim()}
                    onClick={e => handleSubmit(e, true)}
                    className="btn-primary w-full"
                  >
                    {saving ? 'Saving...' : 'Create & Notify Vendors'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
