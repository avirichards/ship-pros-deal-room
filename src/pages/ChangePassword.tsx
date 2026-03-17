import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { ShieldCheck } from 'lucide-react';

export default function ChangePassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { user, profile, updatePassword } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Update the password via Auth API
      const { error: authError } = await updatePassword(password);
      if (authError) throw authError;

      // 2. Clear the requires_password_change flag in the user's profile
      if (user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ requires_password_change: false })
          .eq('id', user.id);
        
        if (profileError) {
          console.error('Failed to clear requires_password_change flag:', profileError);
          // Don't throw here, the password was successfully changed.
          // They might have to manually hit continue, or we just redirect them cleanly.
        }
      }

      // 3. Force page reload to properly re-fetch user profile and trigger normal routing
      window.location.href = '/';
    } catch (err: any) {
      setError(err.message || 'Failed to update password');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-teal-500 rounded-xl flex items-center justify-center mb-4">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-white">Create New Password</h1>
          <p className="text-gray-400 text-sm mt-1 text-center">
            Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}! Please set a new password to continue.
          </p>
        </div>

        {/* Change Password Card */}
        <div className="bg-white rounded-xl shadow-xl p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                New Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input-field"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="input-field"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-2"
            >
              {loading ? 'Updating...' : 'Update Password & Continue'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
