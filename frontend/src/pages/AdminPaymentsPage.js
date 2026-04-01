import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BanknotesIcon,
  CheckCircleIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  PhotoIcon,
  UserCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import { useRealtime } from '../context/RealtimeContext';
import authService from '../services/authService';
import { AnimatedStatValue, ImagePreviewModal, useDialog, useToast } from '../components/ui';
import { buildAssetUrl } from '../config/appConfig';
import { formatRoleLabel } from '../utils/formatters';
import {
  buildPaymentRoleBreakdown,
  buildPaymentSummary,
  buildPaymentTimeline,
  formatUsd,
  getPaymentStatusPercentages
} from '../utils/adminPayments';

const resolveAvatarUrl = (user) => buildAssetUrl(user?.avatarUrl || user?.avatar_url);
const resolvePaymentProofUrl = (request) => buildAssetUrl(request?.paymentScreenshotUrl, null);

const statusToneClass = (status) => {
  if (status === 'approved') return 'bg-emerald-100 text-emerald-700';
  if (status === 'rejected') return 'bg-rose-100 text-rose-700';
  return 'bg-amber-100 text-amber-700';
};

const AdminPaymentsPage = () => {
  const { version } = useRealtime();
  const { confirm } = useDialog();
  const { showSuccess, showError } = useToast();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [submittingId, setSubmittingId] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      const response = await authService.getAdminRoleRequests('');
      setRequests(Array.isArray(response.data?.requests) ? response.data.requests : []);
    } catch (error) {
      showError(error.error || 'Failed to load payment requests.');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests, version]);

  const summary = useMemo(() => buildPaymentSummary(requests), [requests]);
  const statusPercentages = useMemo(() => getPaymentStatusPercentages(summary), [summary]);
  const timeline = useMemo(() => buildPaymentTimeline(requests, 6), [requests]);
  const roleBreakdown = useMemo(() => buildPaymentRoleBreakdown(requests), [requests]);

  const maxTimelineAmount = useMemo(() => {
    const max = Math.max(
      ...timeline.map((item) => item.approvedAmount + item.pendingAmount + item.rejectedAmount),
      0
    );
    return max || 1;
  }, [timeline]);

  const visibleRequests = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return requests.filter((request) => {
      if (statusFilter && request.status !== statusFilter) return false;
      if (!keyword) return true;

      const requester = request.requester || {};
      const searchableFields = [
        `${requester.firstName || ''} ${requester.lastName || ''}`.trim(),
        requester.username,
        requester.email,
        request.requestedRole,
        request.paymentReference,
        request.paymentAccountName,
        request.paymentPhone
      ];

      return searchableFields.some((value) => String(value || '').toLowerCase().includes(keyword));
    });
  }, [requests, search, statusFilter]);

  const handleReview = async (requestId, action) => {
    const confirmed = await confirm(
      action === 'approve'
        ? 'Verify this payment and approve the requested role?'
        : 'Reject this payment and mark the request as failed?',
      {
        title: action === 'approve' ? 'Approve Payment' : 'Reject Payment',
        confirmText: action === 'approve' ? 'Approve Payment' : 'Reject Payment'
      }
    );
    if (!confirmed) return;

    try {
      setSubmittingId(requestId);
      await authService.reviewRoleRequest(requestId, action);
      showSuccess(
        action === 'approve'
          ? 'Payment verified and role approved.'
          : 'Payment rejected and role request failed.'
      );
      await loadRequests();
    } catch (error) {
      showError(error.error || 'Failed to review payment.');
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-emerald-50/60 p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <div className="inline-flex items-center rounded-full bg-white/85 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 ring-1 ring-emerald-100">
              Payment Center
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950">Admin Payments</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Review all role-upgrade payments, verify proof screenshots, and manage how much money is approved, pending, or rejected.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:min-w-[340px]">
            <div className="rounded-2xl border border-white/80 bg-white/85 px-4 py-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Verified revenue</p>
              <p className="mt-2 text-2xl font-bold text-emerald-700">{formatUsd(summary.approvedAmount)}</p>
            </div>
            <div className="rounded-2xl border border-white/80 bg-white/85 px-4 py-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Pending amount</p>
              <p className="mt-2 text-2xl font-bold text-amber-700">{formatUsd(summary.pendingAmount)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[24px] border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-emerald-100/70 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-500">Approved</p>
          <p className="mt-2 text-2xl font-bold text-emerald-800">{formatUsd(summary.approvedAmount)}</p>
          <p className="mt-1 text-xs text-slate-500">{summary.approvedCount} verified payments</p>
        </div>
        <div className="rounded-[24px] border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-amber-100/70 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-500">Pending</p>
          <p className="mt-2 text-2xl font-bold text-amber-800">{formatUsd(summary.pendingAmount)}</p>
          <p className="mt-1 text-xs text-slate-500">{summary.pendingCount} waiting for review</p>
        </div>
        <div className="rounded-[24px] border border-rose-100 bg-gradient-to-br from-rose-50 via-white to-rose-100/70 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-500">Rejected</p>
          <p className="mt-2 text-2xl font-bold text-rose-800">{formatUsd(summary.rejectedAmount)}</p>
          <p className="mt-1 text-xs text-slate-500">{summary.rejectedCount} failed payments</p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-100/70 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-slate-500">All requests</p>
          <AnimatedStatValue value={summary.totalCount} className="mt-2 text-2xl font-bold text-slate-900" />
          <p className="mt-1 text-xs text-slate-500">{formatUsd(summary.totalAmount)} submitted in total</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Money Flow</h2>
              <p className="mt-1 text-sm text-slate-500">Visualize approved, pending, and rejected payment amounts for the last 6 months.</p>
            </div>
            <BanknotesIcon className="h-6 w-6 text-emerald-600" />
          </div>

          <div className="mt-5 flex items-end gap-3 overflow-x-auto pb-2">
            {timeline.map((item) => {
              const totalAmount = item.approvedAmount + item.pendingAmount + item.rejectedAmount;
              const totalHeight = Math.max((totalAmount / maxTimelineAmount) * 180, totalAmount > 0 ? 18 : 8);
              const approvedHeight = totalAmount ? (item.approvedAmount / totalAmount) * totalHeight : 0;
              const pendingHeight = totalAmount ? (item.pendingAmount / totalAmount) * totalHeight : 0;
              const rejectedHeight = totalAmount ? (item.rejectedAmount / totalAmount) * totalHeight : 0;

              return (
                <div key={item.key} className="flex min-w-[86px] flex-1 flex-col items-center">
                  <div className="mb-2 text-xs font-semibold text-slate-500">{formatUsd(totalAmount)}</div>
                  <div className="flex h-[190px] w-full items-end justify-center rounded-[24px] border border-slate-200 bg-slate-50/70 px-3 py-3">
                    <div className="flex w-full max-w-[42px] flex-col justify-end overflow-hidden rounded-full bg-white shadow-inner">
                      <div style={{ height: `${approvedHeight}px` }} className="bg-emerald-500 transition-all duration-300" />
                      <div style={{ height: `${pendingHeight}px` }} className="bg-amber-400 transition-all duration-300" />
                      <div style={{ height: `${rejectedHeight}px` }} className="bg-rose-400 transition-all duration-300" />
                    </div>
                  </div>
                  <div className="mt-3 text-sm font-semibold text-slate-900">{item.label}</div>
                  <div className="text-xs text-slate-500">{item.requestCount} requests</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Status by Amount</h2>
            <p className="mt-1 text-sm text-slate-500">See how much money is approved, waiting, or rejected.</p>

            <div className="mt-5 overflow-hidden rounded-full bg-slate-100">
              <div className="flex h-4 w-full">
                <div style={{ width: `${statusPercentages.approved}%` }} className="bg-emerald-500" />
                <div style={{ width: `${statusPercentages.pending}%` }} className="bg-amber-400" />
                <div style={{ width: `${statusPercentages.rejected}%` }} className="bg-rose-400" />
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {[
                { label: 'Approved', amount: summary.approvedAmount, color: 'bg-emerald-500' },
                { label: 'Pending', amount: summary.pendingAmount, color: 'bg-amber-400' },
                { label: 'Rejected', amount: summary.rejectedAmount, color: 'bg-rose-400' }
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className={`h-3 w-3 rounded-full ${item.color}`} />
                    <span className="text-sm font-semibold text-slate-900">{item.label}</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-700">{formatUsd(item.amount)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Role Breakdown</h2>
            <p className="mt-1 text-sm text-slate-500">Compare money by requested role.</p>

            <div className="mt-5 space-y-3">
              {roleBreakdown.length > 0 ? roleBreakdown.map((item) => (
                <div key={item.role} className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{formatRoleLabel(item.role, 'Unknown')}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.count} payment requests</p>
                    </div>
                    <p className="text-sm font-bold text-slate-900">{formatUsd(item.amount)}</p>
                  </div>
                </div>
              )) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                  No payment data yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Manage Payment Requests</h2>
            <p className="mt-1 text-sm text-slate-500">Admin can inspect all payment data and decide if a payment is good or failed.</p>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(260px,1fr)_220px]">
            <label className="relative block">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, email, phone, reference, or role"
                className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              />
            </label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              Loading payments...
            </div>
          ) : visibleRequests.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              No payment requests found.
            </div>
          ) : (
            visibleRequests.map((request) => {
              const requester = request.requester || {};
              const reviewer = request.reviewer || null;
              const displayName =
                `${requester.firstName || ''} ${requester.lastName || ''}`.trim() ||
                requester.username ||
                requester.email ||
                'Unknown user';
              const isSubmitting = submittingId === request.id;

              return (
                <div key={request.id} className="rounded-[24px] border border-slate-200 bg-slate-50/60 p-4">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex min-w-0 flex-1 items-start gap-4">
                      <img
                        src={resolveAvatarUrl(requester)}
                        alt={`${displayName} avatar`}
                        className="h-12 w-12 rounded-full border border-slate-200 bg-white object-cover"
                        onError={(event) => {
                          const fallbackUrl = buildAssetUrl();
                          if (event.currentTarget.src !== fallbackUrl) {
                            event.currentTarget.src = fallbackUrl;
                          }
                        }}
                      />

                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold text-slate-900">{displayName}</p>
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusToneClass(request.status)}`}>
                            {request.status}
                          </span>
                        </div>
                        <p className="text-sm text-slate-500">
                          @{requester.username || 'user'}{requester.email ? ` | ${requester.email}` : ''}
                        </p>

                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                          <div className="rounded-2xl border border-white bg-white px-4 py-3 shadow-sm">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Requested role</p>
                            <p className="mt-2 text-sm font-semibold text-slate-900">{formatRoleLabel(request.requestedRole, 'Unknown')}</p>
                          </div>
                          <div className="rounded-2xl border border-white bg-white px-4 py-3 shadow-sm">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Amount</p>
                            <p className="mt-2 text-sm font-semibold text-slate-900">{formatUsd(request.feeAmountUsd)}</p>
                          </div>
                          <div className="rounded-2xl border border-white bg-white px-4 py-3 shadow-sm">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Submitted</p>
                            <p className="mt-2 text-sm font-semibold text-slate-900">{new Date(request.createdAt).toLocaleString()}</p>
                          </div>
                          <div className="rounded-2xl border border-white bg-white px-4 py-3 shadow-sm">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Payer</p>
                            <p className="mt-2 text-sm font-semibold text-slate-900">{request.paymentAccountName || 'Not provided'}</p>
                            <p className="mt-1 text-xs text-slate-500">{request.paymentPhone || 'No phone number'}</p>
                          </div>
                          <div className="rounded-2xl border border-white bg-white px-4 py-3 shadow-sm md:col-span-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Reference details</p>
                            <p className="mt-2 text-sm text-slate-700">{request.paymentReference || 'No reference details'}</p>
                          </div>
                          <div className="rounded-2xl border border-white bg-white px-4 py-3 shadow-sm md:col-span-2 xl:col-span-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Note</p>
                            <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{request.note || 'No note added.'}</p>
                          </div>
                          {reviewer && request.reviewedAt && (
                            <div className="rounded-2xl border border-white bg-white px-4 py-3 shadow-sm md:col-span-2 xl:col-span-3">
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Reviewed</p>
                              <p className="mt-2 text-sm text-slate-700">
                                Reviewed by {reviewer.username || reviewer.email} at {new Date(request.reviewedAt).toLocaleString()}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex w-full flex-col gap-3 xl:w-[220px]">
                      {request.paymentScreenshotUrl ? (
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewImage({
                              url: resolvePaymentProofUrl(request),
                              title: `${displayName} payment screenshot`
                            })
                          }
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          <PhotoIcon className="h-5 w-5" />
                          View Screenshot
                        </button>
                      ) : (
                        <div className="inline-flex items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-500">
                          <PhotoIcon className="h-5 w-5" />
                          No screenshot
                        </div>
                      )}

                      {request.status === 'pending' ? (
                        <>
                          <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => handleReview(request.id, 'approve')}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
                          >
                            <CheckCircleIcon className="h-5 w-5" />
                            {isSubmitting ? 'Checking...' : 'Payment Good'}
                          </button>
                          <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => handleReview(request.id, 'reject')}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-300"
                          >
                            <XCircleIcon className="h-5 w-5" />
                            {isSubmitting ? 'Checking...' : 'Payment Failed'}
                          </button>
                        </>
                      ) : (
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-600">
                          <div className="flex items-center gap-2 font-semibold text-slate-900">
                            {request.status === 'approved' ? (
                              <CheckCircleIcon className="h-5 w-5 text-emerald-600" />
                            ) : request.status === 'rejected' ? (
                              <XCircleIcon className="h-5 w-5 text-rose-600" />
                            ) : (
                              <ClockIcon className="h-5 w-5 text-amber-500" />
                            )}
                            {request.status === 'approved'
                              ? 'Verified'
                              : request.status === 'rejected'
                                ? 'Rejected'
                                : 'Pending'}
                          </div>
                          <p className="mt-2 text-xs leading-5 text-slate-500">
                            This payment has already been reviewed.
                          </p>
                        </div>
                      )}

                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-600">
                        <div className="flex items-center gap-2 font-semibold text-slate-900">
                          <UserCircleIcon className="h-5 w-5 text-slate-400" />
                          Payment status
                        </div>
                        <p className="mt-2 capitalize">{request.paymentStatus || 'paid'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <ImagePreviewModal
        open={Boolean(previewImage)}
        imageUrl={previewImage?.url}
        title={previewImage?.title || 'Payment screenshot'}
        onClose={() => setPreviewImage(null)}
      />
    </div>
  );
};

export default AdminPaymentsPage;
