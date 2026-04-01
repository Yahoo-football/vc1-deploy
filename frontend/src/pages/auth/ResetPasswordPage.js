import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthModalShell from '../../components/ui/AuthModalShell';
import { Button } from '../../components/ui';
import authService from '../../services/authService';

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryToken = searchParams.get('token') || '';
  const [token, setToken] = useState(queryToken);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!token) {
      setError('Missing reset token. Please use the link from your email.');
      return;
    }

    if (!newPassword.trim()) {
      setError('Please enter a new password.');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setSubmitting(true);
      const response = await authService.resetPasswordWithToken(token, newPassword);
      if (!response.success) {
        setError(response.error || 'Failed to reset password.');
        return;
      }
      setSuccess('Password reset successfully. Redirecting to login...');
      setTimeout(() => navigate('/login'), 1500);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthModalShell
      badgeLabel="Reset"
      title="Reset Password"
      description="Create a new password for your account."
      maxWidth={520}
    >
      <form className="space-y-6" onSubmit={handleSubmit} noValidate>
        <div>
          <label htmlFor="token" className="mb-2 block text-sm font-semibold text-slate-700">
            Reset Token
          </label>
          <input
            id="token"
            name="token"
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
          />
        </div>

        <div>
          <label htmlFor="newPassword" className="mb-2 block text-sm font-semibold text-slate-700">
            New Password
          </label>
          <input
            id="newPassword"
            name="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="mb-2 block text-sm font-semibold text-slate-700">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
          />
        </div>

        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        {success && <p className="text-sm font-medium text-emerald-600">{success}</p>}

        <Button type="submit" disabled={submitting} className="w-full rounded-2xl bg-green-600 py-3 text-base font-semibold text-white hover:bg-green-700">
          {submitting ? 'Saving...' : 'Reset Password'}
        </Button>

        <p className="text-center text-sm text-slate-600">
          Back to{' '}
          <Link to="/login" className="font-semibold text-green-700 hover:text-green-800">
            login
          </Link>
        </p>
      </form>
    </AuthModalShell>
  );
};

export default ResetPasswordPage;
