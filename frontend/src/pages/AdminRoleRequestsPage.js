import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRealtime } from '../context/RealtimeContext';
import { useLanguage } from '../context/LanguageContext';
import authService from '../services/authService';
import { AnimatedStatValue, ConfirmationModal, ImagePreviewModal, useDialog } from '../components/ui';
import { buildAssetUrl } from '../config/appConfig';
import { formatRoleLabel } from '../utils/formatters';

// Support role label for this page.
const roleLabel = (role) => {
  return formatRoleLabel(role, 'Player');
};

// Support status class for this page.
const statusClass = (status) => {
  if (status === 'approved') return 'bg-green-100 text-green-700';
  if (status === 'rejected') return 'bg-red-100 text-red-700';
  return 'bg-yellow-100 text-yellow-700';
};

// Resolve avatar url into a display-safe value.
const resolveAvatarUrl = (user) => {
  return buildAssetUrl(user?.avatarUrl || user?.avatar_url);
};

const resolvePaymentProofUrl = (request) => buildAssetUrl(request?.paymentScreenshotUrl, null);

const AdminRoleRequestsPage = () => {
  const { version } = useRealtime();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [submittingId, setSubmittingId] = useState(null);
  const [flash, setFlash] = useState(null);
  const [viewUser, setViewUser] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const { confirm } = useDialog();
  const { t } = useLanguage();

  const FILTER_OPTIONS = [
    { value: 'pending', label: t('common_pending', 'Pending') },
    { value: 'approved', label: t('admin_role_requests_approved', 'Approved') },
    { value: 'rejected', label: t('admin_role_requests_rejected', 'Rejected') },
    { value: '', label: t('common_all', 'All') }
  ];

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      const response = await authService.getAdminRoleRequests(filter);
      setRequests(Array.isArray(response.data?.requests) ? response.data.requests : []);
    } catch (error) {
      setFlash({ type: 'error', message: error.error || t('admin_role_requests_load_failed', 'Failed to load role requests.') });
    } finally {
      setLoading(false);
    }
  }, [filter, t]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests, version]);

  const stats = useMemo(() => {
    return {
      total: requests.length,
      pending: requests.filter((item) => item.status === 'pending').length,
      approved: requests.filter((item) => item.status === 'approved').length,
      rejected: requests.filter((item) => item.status === 'rejected').length
    };
  }, [requests]);

  const visibleRequests = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return requests;

    return requests.filter((request) => {
      const requester = request.requester || {};
      const fullName = `${requester.firstName || ''} ${requester.lastName || ''}`.trim().toLowerCase();
      return (
        fullName.includes(keyword) ||
        String(requester.username || '').toLowerCase().includes(keyword) ||
        String(requester.email || '').toLowerCase().includes(keyword) ||
        String(request.requestedRole || '').toLowerCase().includes(keyword)
      );
    });
  }, [requests, search]);

  // Handle review interactions.
  const handleReview = async (requestId, action) => {
    const confirmed = await confirm(t('admin_role_requests_confirm', 'Are you sure you want to {{action}} this request?', {
      action: action === 'approve' ? 'verify this payment and approve' : 'mark this payment as failed'
    }), {
      title: action === 'approve' ? 'Verify Payment' : 'Reject Payment'
    });
    if (!confirmed) return;

    try {
      setSubmittingId(requestId);
      await authService.reviewRoleRequest(requestId, action);
      setFlash({ type: 'success', message: action === 'approve' ? 'Payment verified and role approved.' : 'Payment failed and request rejected.' });
      await loadRequests();
    } catch (error) {
      setFlash({ type: 'error', message: error.error || t('admin_role_requests_review_failed', 'Failed to review request.') });
    } finally {
      setSubmittingId(null);
    }
  };

  // Open view modal in the UI.
  const openViewModal = (user) => {
    setViewUser(user || null);
  };

  // Close view modal in the UI.
  const closeViewModal = () => {
    setViewUser(null);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-amber-50/70 p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center rounded-full bg-white/85 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700 ring-1 ring-amber-100">
            {t('admin_role_requests_badge', 'Access Review')}
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950">{t('dashboard_admin_pending_role_requests', 'Pending Role Requests')}</h1>
          <p className="mt-2 text-sm text-slate-600">{t('admin_role_requests_subtitle', 'Review captain and field owner access requests with the same dashboard card style.')}</p>
        </div>
        </div>
      </div>

      {flash && (
        <div className={`rounded-md border px-4 py-3 text-sm ${flash.type === 'success' ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
          {flash.message}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-100/80 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-gray-500">{t('admin_role_requests_total', 'Total')}</p>
          <AnimatedStatValue value={stats.total} className="mt-1 text-2xl font-bold text-gray-900" />
        </div>
        <div className="rounded-[24px] border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-amber-100/70 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-gray-500">{t('common_pending', 'Pending')}</p>
          <AnimatedStatValue value={stats.pending} className="mt-1 text-2xl font-bold text-yellow-700" />
        </div>
        <div className="rounded-[24px] border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-emerald-100/70 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-gray-500">{t('admin_role_requests_approved', 'Approved')}</p>
          <AnimatedStatValue value={stats.approved} className="mt-1 text-2xl font-bold text-green-700" />
        </div>
        <div className="rounded-[24px] border border-red-100 bg-gradient-to-br from-red-50 via-white to-red-100/70 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-gray-500">{t('admin_role_requests_rejected', 'Rejected')}</p>
          <AnimatedStatValue value={stats.rejected} className="mt-1 text-2xl font-bold text-red-700" />
        </div>
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('admin_role_requests_search', 'Search username, email, name, or role')}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            {FILTER_OPTIONS.map((option) => (
              <option key={option.label} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="rounded-[28px] border border-slate-200 bg-white px-4 py-8 text-center text-gray-500 shadow-sm">{t('admin_role_requests_loading', 'Loading requests...')}</div>
        ) : visibleRequests.length === 0 ? (
          <div className="rounded-[28px] border border-slate-200 bg-white px-4 py-8 text-center text-gray-500 shadow-sm">{t('admin_role_requests_none_found', 'No role requests found.')}</div>
        ) : (
          visibleRequests.map((request) => {
            const requester = request.requester || {};
            const reviewer = request.reviewer || null;
            const isSubmitting = submittingId === request.id;
            const displayName = `${requester.firstName || ''} ${requester.lastName || ''}`.trim() || requester.username;

            return (
              <div key={request.id} className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <button
                    type="button"
                    onClick={() => openViewModal(requester)}
                    className="min-w-0 flex-1 rounded-lg text-left transition hover:bg-gray-50/70 focus:outline-none focus:ring-2 focus:ring-green-100"
                  >
                    <div className="flex items-start gap-3">
                      <img
                        src={resolveAvatarUrl(requester)}
                        alt={`${displayName} avatar`}
                        className="h-10 w-10 shrink-0 cursor-zoom-in rounded-full border border-gray-200 bg-gray-100 object-cover"
                        onClick={(event) => {
                          event.stopPropagation();
                          setPreviewImage({
                            url: resolveAvatarUrl(requester),
                            title: `${displayName} image`
                          });
                        }}
                        onError={(event) => {
                          const fallbackUrl = buildAssetUrl();
                          if (event.currentTarget.src !== fallbackUrl) {
                            event.currentTarget.src = fallbackUrl;
                          }
                        }}
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-sm font-semibold text-gray-900">
                          {displayName}
                          <span className="ml-2 text-xs font-normal text-gray-500">@{requester.username}</span>
                        </p>
                        <p className="text-xs text-gray-500">{requester.email}</p>
                        <p className="text-sm text-gray-700">
                          {t('admin_role_requests_requested_role', 'Requested role')}: <span className="font-semibold">{roleLabel(request.requestedRole)}</span>
                        </p>
                        <p className="text-sm text-emerald-700">
                          {t('admin_role_requests_upgrade_fee', 'Upgrade fee')}: <span className="font-semibold">${Number(request.feeAmountUsd || 0).toFixed(0)}</span>
                          {' '}| {t('admin_role_requests_payment', 'Payment')}: <span className="font-semibold capitalize">{request.paymentStatus || t('admin_role_requests_paid', 'paid')}</span>
                        </p>
                        {request.paymentAccountName && (
                          <p className="text-sm text-gray-600">
                            Payer: <span className="font-semibold text-gray-900">{request.paymentAccountName}</span>
                            {request.paymentPhone ? ` | ${request.paymentPhone}` : ''}
                          </p>
                        )}
                        {request.paymentReference && (
                          <p className="text-sm text-gray-600">
                            Reference details: <span className="font-semibold text-gray-900">{request.paymentReference}</span>
                          </p>
                        )}
                        {request.note && (
                          <p className="whitespace-pre-line text-sm text-gray-600">
                            {t('admin_role_requests_note', 'Note')}: {request.note}
                          </p>
                        )}
                        <p className="text-xs text-gray-500">{t('admin_role_requests_submitted', 'Submitted')}: {new Date(request.createdAt).toLocaleString()}</p>
                        {reviewer && request.reviewedAt && (
                          <p className="text-xs text-gray-500">{t('admin_role_requests_reviewed_by', 'Reviewed by {{user}} at {{date}}', { user: reviewer.username, date: new Date(request.reviewedAt).toLocaleString() })}</p>
                        )}
                      </div>
                    </div>
                  </button>

                  <div className="flex w-full flex-col gap-3 lg:w-auto lg:min-w-[220px] lg:items-end">
                    <span className={`inline-flex w-fit rounded-full px-2 py-1 text-xs font-semibold ${statusClass(request.status)}`}>
                      {request.status === 'pending' ? t('common_pending', 'Pending') : request.status === 'approved' ? t('admin_role_requests_approved', 'Approved') : t('admin_role_requests_rejected', 'Rejected')}
                    </span>

                    {request.paymentScreenshotUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewImage({
                            url: resolvePaymentProofUrl(request),
                            title: `${displayName} payment proof`
                          })
                        }
                        className="inline-flex w-fit text-sm font-semibold text-emerald-700 underline underline-offset-4"
                      >
                        View payment screenshot
                      </button>
                    )}

                    {request.status === 'pending' && (
                      <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => handleReview(request.id, 'approve')}
                          className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                        >
                          {isSubmitting ? t('admin_role_requests_processing', 'Processing...') : 'Approve Payment'}
                        </button>
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => handleReview(request.id, 'reject')}
                          className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                        >
                          {isSubmitting ? t('admin_role_requests_processing', 'Processing...') : 'Reject Payment'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <ConfirmationModal
        isOpen={Boolean(viewUser)}
        title={viewUser ? (`${viewUser.firstName || ''} ${viewUser.lastName || ''}`.trim() || viewUser.username) : t('admin_role_requests_user_details', 'User Details')}
        message={viewUser ? t('admin_role_requests_view_account', 'View account information for @{{username}}.', { username: viewUser.username }) : ''}
        badgeLabel={t('admin_role_requests_user_details', 'User Details')}
        confirmLabel={t('owner_bookings_close', 'Close')}
        showCancel={false}
        variant="default"
        onConfirm={closeViewModal}
        onClose={closeViewModal}
      >
        {viewUser && (
          <div className="space-y-5">
            <div className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
              <img
                src={resolveAvatarUrl(viewUser)}
                alt={`${viewUser.username} avatar`}
                className="h-16 w-16 cursor-zoom-in rounded-full border border-gray-200 bg-white object-cover transition hover:scale-[1.03]"
                onClick={() =>
                  setPreviewImage({
                    url: resolveAvatarUrl(viewUser),
                    title: `${`${viewUser.firstName || ''} ${viewUser.lastName || ''}`.trim() || viewUser.username} image`
                  })
                }
                onError={(event) => {
                  const fallbackUrl = buildAssetUrl();
                  if (event.currentTarget.src !== fallbackUrl) {
                    event.currentTarget.src = fallbackUrl;
                  }
                }}
              />
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold text-gray-900">
                  {`${viewUser.firstName || ''} ${viewUser.lastName || ''}`.trim() || viewUser.username}
                </p>
                <p className="truncate text-sm text-gray-500">@{viewUser.username}</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{t('admin_users_email', 'Email')}</p>
                <p className="mt-2 break-all text-sm text-gray-700">{viewUser.email || t('admin_role_requests_no_email', 'No email')}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{t('admin_users_role', 'Role')}</p>
                <p className="mt-2 text-sm font-semibold text-gray-700">{roleLabel(viewUser.role)}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{t('admin_users_status', 'Status')}</p>
                <p className="mt-2 text-sm font-semibold text-gray-700">{roleLabel(viewUser.status || 'active')}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{t('profile_phone_number', 'Phone')}</p>
                <p className="mt-2 text-sm text-gray-700">{viewUser.phone || t('admin_role_requests_no_phone', 'No phone number')}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{t('profile_dob', 'Date of Birth')}</p>
                <p className="mt-2 text-sm text-gray-700">{viewUser.dateOfBirth || viewUser.date_of_birth || t('team_details_not_set', 'Not set')}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{t('profile_address', 'Address')}</p>
                <p className="mt-2 text-sm text-gray-700">{viewUser.address || t('admin_role_requests_no_address', 'No address')}</p>
              </div>
            </div>
          </div>
        )}
      </ConfirmationModal>

      <ImagePreviewModal
        open={Boolean(previewImage)}
        imageUrl={previewImage?.url}
        title={previewImage?.title || 'User image'}
        onClose={() => setPreviewImage(null)}
      />
    </div>
  );
};

export default AdminRoleRequestsPage;
