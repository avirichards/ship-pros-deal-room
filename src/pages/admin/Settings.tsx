import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import { User, Mail, Building, Phone, Lock, Save } from 'lucide-react';

export default function AdminSettings() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Profile Form State
  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');

  // Password Form State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setCompany(profile.company || '');
      setPhone(profile.phone || '');
    }
  }, [profile]);

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          company: company.trim(),
          phone: phone.trim(),
        })
        .eq('id', profile.id);

      if (error) throw error;
      toast('Profile updated successfully');
    } catch (err: any) {
      toast(err.message || 'Failed to update profile', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast('Passwords do not match', 'error');
      return;
    }

    if (newPassword.length < 6) {
      toast('Password must be at least 6 characters', 'error');
      return;
    }

    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;
      
      toast('Password updated successfully');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast(err.message || 'Failed to update password', 'error');
    } finally {
      setPasswordLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="page-header">
        <h1 className="page-title">Admin Settings</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Profile Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-lg font-medium text-navy-950 flex items-center gap-2">
              <User className="w-5 h-5 text-teal-600" />
              Profile Information
            </h2>
          </div>
          
          <form onSubmit={handleUpdateProfile} className="p-6 space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  value={profile?.email || ''}
                  disabled
                  className="input-field pl-9 bg-gray-50 text-gray-500 cursor-not-allowed"
                />
                <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
              <p className="mt-1 text-xs text-gray-500">Email cannot be changed.</p>
            </div>

            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <div className="relative">
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="input-field pl-9"
                  placeholder="John Doe"
                />
                <User className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-1">
                Company Name
              </label>
              <div className="relative">
                <input
                  id="company"
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="input-field pl-9"
                  placeholder="Acme Corp"
                />
                <Building className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <div className="relative">
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="input-field pl-9"
                  placeholder="(555) 123-4567"
                />
                <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="pt-2">
              <button 
                type="submit" 
                disabled={loading}
                className="btn-primary w-full justify-center"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Profile Links
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Password Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-lg font-medium text-navy-950 flex items-center gap-2">
              <Lock className="w-5 h-5 text-teal-600" />
              Change Password
            </h2>
          </div>
          
          <form onSubmit={handleUpdatePassword} className="p-6 space-y-4">
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                New Password
              </label>
              <div className="relative">
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="input-field pl-9"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
                <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input-field pl-9"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
                <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="pt-2">
              <button 
                type="submit" 
                disabled={passwordLoading || !newPassword || !confirmPassword}
                className="btn-primary w-full justify-center"
              >
                {passwordLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    Update Password
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
