import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthModalShell from '../../components/ui/AuthModalShell';
import { Button } from '../../components/ui';
import authService from '../../services/authService';

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [resetLink, setResetLink] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setResetLink('');

    if (!identifier.trim()) {
      setError('Please enter your email.');
      return;
    }

    try {
      setSubmitting(true);
      const response = await authService.requestPasswordResetLink(identifier.trim());
      if (!response.success) {
        setError(response.error || 'Failed to send reset link.');
        return;
      }
      setSuccess('We sent a password reset link. Check your email.');
      if (response.data?.resetLink) {
        setResetLink(response.data.resetLink);
      }
    } catch (error) {
      setError(error?.error || error?.message || 'Failed to send reset link.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthModalShell
      badgeLabel="Password Help"
      title="Forgot Password"
      description="Enter your email address and we will send you a reset link."
      maxWidth={520}
    >
      <form className="space-y-6" onSubmit={handleSubmit} noValidate>
        <div>
          <label htmlFor="identifier" className="mb-2 block text-sm font-semibold text-slate-700">
            Email
          </label>
          <input
            id="identifier"
            name="identifier"
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
          />
          {error && <p className="mt-2 text-sm font-medium text-red-600">{error}</p>}
          {success && <p className="mt-2 text-sm font-medium text-emerald-600">{success}</p>}
        </div>

        <Button type="submit" disabled={submitting} className="w-full rounded-2xl bg-green-600 py-3 text-base font-semibold text-white hover:bg-green-700">
          {submitting ? 'Sending...' : 'Send Reset Link'}
        </Button>

        {resetLink && (
          <button
            type="button"
            onClick={() => navigate(resetLink.replace(window.location.origin, ''))}
            className="w-full rounded-2xl border border-emerald-200 bg-emerald-50 py-2 text-sm font-semibold text-emerald-700"
          >
            Open Reset Link
          </button>
        )}

        <p className="text-center text-sm text-slate-600">
          Remembered it?{' '}
          <Link to="/login" className="font-semibold text-green-700 hover:text-green-800">
            Back to login
          </Link>
        </p>
      </form>
    </AuthModalShell>
  );
};

export default ForgotPasswordPage;
