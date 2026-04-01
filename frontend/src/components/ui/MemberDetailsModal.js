import React, { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import ImagePreviewModal from './ImagePreviewModal';
import { buildAssetUrl } from '../../config/appConfig';
import { formatRoleLabel } from '../../utils/formatters';

// Format date for display.
const formatDate = (value) => {
  if (!value) return 'Not available';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not available';
  return parsed.toLocaleString();
};

// Format date only for display.
const formatDateOnly = (value) => {
  if (!value) return 'Not set';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not set';
  return parsed.toLocaleDateString();
};

// Render the member details modal modal.
const MemberDetailsModal = ({ member, onClose }) => {
  const [previewOpen, setPreviewOpen] = useState(false);
  if (!member) return null;

  const profile = member.user || member;
  const fullName =
    `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim() || profile?.username || 'Member';
  const avatarUrl = buildAssetUrl(profile?.avatarUrl || profile?.avatar_url);

  return (
    <>
      <div
        className="fixed inset-0 z-[1250] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          className="flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.28)] sm:max-h-[calc(100vh-3rem)]"
          onClick={(event) => event.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="member-details-title"
        >
          <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
            <div>
              <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700 ring-1 ring-emerald-200">
                Member Details
              </span>
              <h3 id="member-details-title" className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
                {fullName}
              </h3>
              <p className="mt-1 text-sm text-slate-500">@{profile?.username || 'member'}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close member details"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="overflow-y-auto px-6 py-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4 sm:col-span-2">
                <div className="flex items-center gap-4">
                  <img
                    src={avatarUrl}
                    alt={`${fullName} avatar`}
                    className="h-20 w-20 cursor-zoom-in rounded-full border border-slate-200 bg-white object-cover transition hover:scale-[1.03]"
                    onClick={() => setPreviewOpen(true)}
                    onError={(event) => {
                      const fallbackUrl = buildAssetUrl();
                      if (event.currentTarget.src !== fallbackUrl) {
                        event.currentTarget.src = fallbackUrl;
                      }
                    }}
                  />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Profile Image</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Email</p>
                <p className="mt-2 break-all text-sm text-slate-700">{profile?.email || 'No email'}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Role</p>
                <p className="mt-2 text-sm font-semibold text-slate-700">{formatRoleLabel(member.role)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Status</p>
                <p className="mt-2 text-sm font-semibold text-slate-700">{formatRoleLabel(member.status || 'active')}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Joined</p>
                <p className="mt-2 text-sm text-slate-700">{formatDate(member.joinedAt || member.createdAt)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Phone</p>
                <p className="mt-2 text-sm text-slate-700">{profile?.phone || 'No phone number'}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Date of Birth</p>
                <p className="mt-2 text-sm text-slate-700">{formatDateOnly(profile?.dateOfBirth || profile?.date_of_birth)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Account Status</p>
                <p className="mt-2 text-sm font-semibold text-slate-700">{formatRoleLabel(profile?.status || 'active')}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Address</p>
                <p className="mt-2 text-sm text-slate-700">{profile?.address || 'No address'}</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end border-t border-slate-200 bg-slate-50/80 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 transition hover:-translate-y-0.5 hover:from-emerald-700 hover:to-teal-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      <ImagePreviewModal
        open={previewOpen}
        imageUrl={avatarUrl}
        title={`${fullName} image`}
        onClose={() => setPreviewOpen(false)}
      />
    </>
  );
};

export default MemberDetailsModal;
