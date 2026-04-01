import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthModalShell from '../../components/ui/AuthModalShell';
import { Button } from '../../components/ui';
import authService from '../../services/authService';

const VerifyOtpPage = () => {
  const navigate = useNavigate();
  const identifier = sessionStorage.getItem('resetIdentifier') || '';
  const [otp, setOtp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!identifier) {
      setError('Missing identifier. Please start again.');
      return;
    }

    if (!otp.trim()) {
      setError('Please enter the OTP code.');
      return;
    }

    try {
      setSubmitting(true);
      const response = await authService.verifyPasswordOtp(identifier, otp.trim());
      if (!response.success) {
        setError(response.error || 'Invalid OTP.');
        return;
      }
      sessionStorage.setItem('resetOtp', otp.trim());
      navigate('/reset-password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthModalShell
      badgeLabel="OTP Verification"
      title="Verify OTP"
      description="Enter the 6-digit code we sent to you."
      maxWidth={520}
    >
      <form className="space-y-6" onSubmit={handleSubmit} noValidate>
        <div>
          <label htmlFor="otp" className="mb-2 block text-sm font-semibold text-slate-700">
            OTP Code
          </label>
          <input
            id="otp"
            name="otp"
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            className="block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20"
          />
          {error && <p className="mt-2 text-sm font-medium text-red-600">{error}</p>}
        </div>

        <Button type="submit" disabled={submitting} className="w-full rounded-2xl bg-green-600 py-3 text-base font-semibold text-white hover:bg-green-700">
          {submitting ? 'Verifying...' : 'Verify OTP'}
        </Button>

        <p className="text-center text-sm text-slate-600">
          Need a new code?{' '}
          <Link to="/forgot-password" className="font-semibold text-green-700 hover:text-green-800">
            Resend OTP
          </Link>
        </p>
      </form>
    </AuthModalShell>
  );
};

export default VerifyOtpPage;
