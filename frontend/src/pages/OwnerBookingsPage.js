import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  BuildingOfficeIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  MapPinIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import bookingService from '../services/bookingService';
import { useRealtime } from '../context/RealtimeContext';
import { useLanguage } from '../context/LanguageContext';
import { Badge, Button, Card, CardBody, CardHeader, ConfirmationModal, EmptyState, Spinner, useDialog } from '../components/ui';
import MemberDetailsModal from '../components/ui/MemberDetailsModal';
import { getTeamJerseyColors } from '../utils/teamColors';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';
const API_ORIGIN =
  typeof window !== 'undefined' && API_BASE_URL.startsWith('/')
    ? window.location.origin
    : API_BASE_URL.replace(/\/api\/?$/, '');
const DEFAULT_PROFILE_PATH = '/uploads/profile/default_profile.jpg';

const statusTone = (status) => {
  const tones = { pending: 'yellow', confirmed: 'green', cancellation_pending: 'orange', completed: 'blue', cancelled: 'red' };
  return tones[status] || 'gray';
};

const statusTranslationKey = (status) => {
  const map = {
    pending: 'common_pending',
    confirmed: 'common_confirmed',
    cancellation_pending: 'owner_bookings_cancellation_pending',
    completed: 'common_completed',
    cancelled: 'common_cancelled'
  };
  return map[status] || null;
};

const formatMoney = (value) => {
  const n = Number(value || 0);
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString();
};

const formatTimeOnly = (value) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleTimeString();
};

const toDateInputValue = (value) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const openNativeDatePicker = (event) => {
  event.currentTarget.focus();
  if (typeof event.currentTarget.showPicker === 'function') {
    try {
      event.currentTarget.showPicker();
    } catch (_) {}
  }
};

const buildScheduleWithSelectedDate = (booking, dateValue) => {
  if (!booking?.startTime || !booking?.endTime || !dateValue) return null;
  const [year, month, day] = String(dateValue).split('-').map(Number);
  if (![year, month, day].every(Number.isFinite)) return null;

  const currentStart = new Date(booking.startTime);
  const currentEnd = new Date(booking.endTime);
  if (Number.isNaN(currentStart.getTime()) || Number.isNaN(currentEnd.getTime())) return null;

  const durationMs = currentEnd.getTime() - currentStart.getTime();
  if (durationMs <= 0) return null;

  const nextStart = new Date(currentStart);
  nextStart.setFullYear(year, month - 1, day);

  let nextEnd = new Date(currentEnd);
  nextEnd.setFullYear(year, month - 1, day);
  if (nextEnd <= nextStart) {
    nextEnd = new Date(nextStart.getTime() + durationMs);
  }

  return {
    startTime: nextStart.toISOString(),
    endTime: nextEnd.toISOString()
  };
};

const resolveAvatarUrl = (user) => {
  const rawAvatar = user?.avatarUrl || user?.avatar_url;
  if (!rawAvatar) return `${API_ORIGIN}${DEFAULT_PROFILE_PATH}`;
  if (/^https?:\/\//i.test(rawAvatar)) return rawAvatar;
  return `${API_ORIGIN}${rawAvatar.startsWith('/') ? rawAvatar : `/${rawAvatar}`}`;
};

const OwnerBookingsPage = () => {
  const { version } = useRealtime();
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const { confirm } = useDialog();
  const fieldIdFilter = searchParams.get('fieldId');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [captainDetailsOpen, setCaptainDetailsOpen] = useState(false);
  const [acceptDateByBooking, setAcceptDateByBooking] = useState({});

  const refresh = useCallback(async () => {
    const filters = { limit: 200 };
    if (fieldIdFilter) filters.fieldId = fieldIdFilter;
    const res = await bookingService.getAllBookings(filters);
    setBookings(Array.isArray(res.data) ? res.data : []);
  }, [fieldIdFilter]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        await refresh();
      } catch (err) {
        setError(err?.error || t('owner_bookings_load_failed', 'Failed to load booking requests'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [refresh, t, version]);

  const counts = useMemo(() => {
    const base = { all: bookings.length, pending: 0, confirmed: 0, cancellation_pending: 0, completed: 0, cancelled: 0 };
    for (const b of bookings) {
      if (b?.status && Object.prototype.hasOwnProperty.call(base, b.status)) base[b.status] += 1;
    }
    return base;
  }, [bookings]);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return bookings;
    return bookings.filter((b) => b.status === statusFilter);
  }, [bookings, statusFilter]);

  const handleStatus = useCallback(async (booking, nextStatus) => {
    try {
      setUpdatingId(booking.id);
      setError(null);

      if (nextStatus === 'confirmed') {
        const selectedDate = acceptDateByBooking[booking.id] || toDateInputValue(booking.startTime);
        if (!selectedDate) {
          setError(t('owner_bookings_select_date_first', 'Please select a date before accepting this booking.'));
          return;
        }
        const nextSchedule = buildScheduleWithSelectedDate(booking, selectedDate);
        if (!nextSchedule) {
          setError(t('owner_bookings_invalid_date', 'Unable to update booking date. Please choose a valid date.'));
          return;
        }

        const confirmed = await confirm(t('owner_bookings_confirm_accept_message', 'Do you want to accept this booking request?'), {
          title: t('owner_bookings_accept', 'Accept Booking')
        });
        if (!confirmed) return;
        await bookingService.confirmBooking(booking.id, nextSchedule);
      }
      if (nextStatus === 'cancelled') {
        const confirmed = await confirm(t('owner_bookings_confirm_cancel_message', 'Do you want to cancel booking?'), { title: t('owner_bookings_cancel_title', 'Cancel Booking') });
        if (!confirmed) return;
        await bookingService.cancelBooking(booking.id);
      }

      await refresh();
    } catch (err) {
      setError(err?.error || t('owner_bookings_update_failed', 'Failed to update booking'));
    } finally {
      setUpdatingId(null);
    }
  }, [acceptDateByBooking, confirm, refresh, t]);

  const captainDisplayName = (booking) => {
    if (booking?.team?.captain?.firstName || booking?.team?.captain?.lastName) {
      return `${booking.team?.captain?.firstName || ''} ${booking.team?.captain?.lastName || ''}`.trim();
    }
    return booking?.team?.captain?.username || t('common_unknown', 'Unknown');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  const tabs = [
    { key: 'pending', label: t('common_pending', 'Pending'), count: counts.pending },
    { key: 'cancellation_pending', label: t('owner_bookings_cancellation_pending', 'Cancellation Pending'), count: counts.cancellation_pending },
    { key: 'confirmed', label: t('common_confirmed', 'Confirmed'), count: counts.confirmed },
    { key: 'completed', label: t('common_completed', 'Completed'), count: counts.completed },
    { key: 'cancelled', label: t('common_cancelled', 'Cancelled'), count: counts.cancelled },
    { key: 'all', label: t('common_all', 'All'), count: counts.all }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('owner_bookings_title', 'Booking requests')}</h1>
          <p className="mt-1 text-sm text-gray-600">{t('owner_bookings_subtitle', 'Confirm or cancel booking requests. Match completion is managed in Matches.')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button as={Link} to="/owner/fields" variant="outline" size="sm">
            <BuildingOfficeIcon className="h-4 w-4" />
            {t('stat_my_fields', 'My fields')}
          </Button>
          <Button as={Link} to="/owner/matches" variant="outline" size="sm">
            <CalendarIcon className="h-4 w-4" />
            {t('nav_matches', 'Matches')}
          </Button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md text-sm">{error}</div>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-blue-100/80 p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">{t('owner_bookings_booked', 'Booked')}</div>
              <div className="mt-3 text-4xl font-bold leading-none text-blue-950">{counts.confirmed}</div>
              <p className="mt-2 text-sm text-blue-700/80">{t('owner_bookings_booked_subtitle', 'Confirmed bookings ready for play.')}</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-3 text-blue-600 shadow-sm ring-1 ring-blue-100">
              <CalendarIcon className="h-6 w-6" />
            </div>
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-emerald-100/80 p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">{t('common_completed', 'Completed')}</div>
              <div className="mt-3 text-4xl font-bold leading-none text-emerald-950">{counts.completed}</div>
              <p className="mt-2 text-sm text-emerald-700/80">{t('owner_bookings_completed_subtitle', 'Finished matches recorded successfully.')}</p>
            </div>
            <div className="rounded-2xl bg-white/80 p-3 text-emerald-600 shadow-sm ring-1 ring-emerald-100">
              <CheckCircleIcon className="h-6 w-6" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setStatusFilter(t.key)}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm ring-1 transition ${
              statusFilter === t.key
                ? 'bg-blue-600 text-white ring-blue-600'
                : 'bg-white text-gray-700 ring-gray-200 hover:bg-gray-50'
            }`}
            type="button"
          >
            <span>{t.label}</span>
            <span className={`${statusFilter === t.key ? 'text-white/80' : 'text-gray-500'}`}>{t.count}</span>
          </button>
        ))}
      </div>

      <Card>
        <CardHeader className="px-6 py-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-900">{t('owner_bookings_requests', 'Requests')}</div>
            <div className="text-xs text-gray-500">{t('owner_bookings_showing', 'Showing: {{status}}', { status: tabs.find((tab) => tab.key === statusFilter)?.label || statusFilter })}</div>
          </div>
          <Badge tone={statusFilter === 'pending' ? 'yellow' : 'gray'}>{t('owner_bookings_items', '{{count}} items', { count: filtered.length })}</Badge>
        </CardHeader>

        <div className="border-t border-gray-200">
          {filtered.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={ClockIcon} title={t('owner_bookings_empty_title', 'No bookings')} description={t('owner_bookings_empty_description', 'Try another filter, or wait for new booking requests.')} />
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filtered.map((b) => {
                const isUpdating = updatingId === b.id;
                const start = b?.startTime ? new Date(b.startTime) : null;
                const end = b?.endTime ? new Date(b.endTime) : null;
                const captainName = captainDisplayName(b);
                const homeTeamName = b.team?.name || t('owner_bookings_home_team', 'Home Team');
                const awayTeamName = b.opponentTeam?.name || t('owner_bookings_away_team', 'Away Team');
                const homeJerseyColors = getTeamJerseyColors(b.team);
                const awayJerseyColors = b.opponentTeam ? getTeamJerseyColors(b.opponentTeam) : [];
                const hasResult = !!b.matchResult?.id;

                return (
                  <div
                    key={b.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedBooking(b)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedBooking(b);
                      }
                    }}
                    className="flex cursor-pointer flex-col gap-4 px-6 py-4 transition hover:bg-slate-50/80 focus:outline-none focus:ring-2 focus:ring-blue-200 lg:flex-row lg:items-start lg:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <div className="text-sm font-semibold text-gray-900 truncate">{b.field?.name || t('field_name', 'Field')}</div>
                          <Badge tone={statusTone(b.status)} className="capitalize">
                            {t(statusTranslationKey(b.status) || b.status, b.status)}
                          </Badge>
                          <Badge tone="green">{formatMoney(b.totalPrice)}</Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
                        <span className="inline-flex items-center gap-1">
                          <CalendarIcon className="h-4 w-4 text-gray-400" />
                          {start ? start.toLocaleString() : '-'}
                          {end ? ` - ${end.toLocaleTimeString()}` : ''}
                        </span>
                        <span className="text-gray-300">|</span>
                        <span className="truncate">{t('create_booking_team', 'Team')}: {b.team?.name || t('create_booking_team', 'Team')}</span>
                      </div>
                      <div className="mt-1 text-xs text-gray-600">
                        {t('teams_captain_label', 'Captain: {{name}}', { name: captainName })}
                      </div>
                      <div className="mt-1 inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-1">
                        {homeJerseyColors.map((color, index) => (
                          <span key={`home-${b.id}-${color}-${index}`} className="h-3.5 w-3.5 rounded-full border border-black/10" style={{ backgroundColor: color }} />
                        ))}
                        {awayJerseyColors.length > 0 && <span className="mx-0.5 text-gray-400 text-xs">vs</span>}
                        {awayJerseyColors.map((color, index) => (
                          <span key={`away-${b.id}-${color}-${index}`} className="h-3.5 w-3.5 rounded-full border border-black/10" style={{ backgroundColor: color }} />
                        ))}
                      </div>
                      {hasResult && (
                        <div className="mt-1 text-xs text-emerald-700">
                          {t('owner_bookings_result_recorded', 'Result recorded: {{home}} {{homeScore}} - {{awayScore}} {{away}}', { home: homeTeamName, homeScore: b.matchResult.homeScore, awayScore: b.matchResult.awayScore, away: awayTeamName })}
                        </div>
                      )}
                    </div>

                    <div className="flex justify-start lg:justify-end">
                      <div className="flex flex-col items-start gap-3 lg:items-end">
                        {b.status === 'pending' && (
                          <div className="w-full min-w-[220px] lg:w-[220px]">
                            <label className="block text-[11px] font-medium text-gray-600">{t('owner_bookings_match_date', 'Match date')}</label>
                            <input
                              type="date"
                              value={acceptDateByBooking[b.id] ?? toDateInputValue(b.startTime)}
                              min={toDateInputValue(new Date())}
                              onClick={(event) => {
                                event.stopPropagation();
                                openNativeDatePicker(event);
                              }}
                              onKeyDown={(event) => event.stopPropagation()}
                              onChange={(event) =>
                                setAcceptDateByBooking((prev) => ({
                                  ...prev,
                                  [b.id]: event.target.value
                                }))
                              }
                              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900"
                            />
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-2">
                      {b.status === 'pending' && (
                        <>
                          <Button
                            size="sm"
                            className="h-7 px-2.5 text-xs"
                            disabled={isUpdating}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleStatus(b, 'confirmed');
                            }}
                          >
                            <CheckCircleIcon className="h-4 w-4" />
                            {t('owner_bookings_accept', 'Accept Booking')}
                          </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          className="h-7 px-2.5 text-xs"
                          disabled={isUpdating}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleStatus(b, 'cancelled');
                          }}
                        >
                          <XCircleIcon className="h-4 w-4" />
                          {t('action_cancel', 'Cancel')}
                        </Button>
                        </>
                      )}
                      {b.status === 'confirmed' && <Badge tone="blue">{t('owner_bookings_use_matches', 'Use Matches page to complete')}</Badge>}
                      {b.status === 'completed' && <Badge tone="blue">{t('common_completed', 'Completed')}</Badge>}
                      {b.status === 'cancelled' && <Badge tone="gray">{t('owner_bookings_no_actions', 'No actions')}</Badge>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <CardBody className="px-6 py-4 text-xs text-gray-500">
          {t('owner_bookings_tip', 'Tip: Confirm pending requests quickly to improve your field booking rate.')}
        </CardBody>
      </Card>

      <ConfirmationModal
        isOpen={Boolean(selectedBooking)}
        title={selectedBooking?.field?.name || t('owner_bookings_details_title', 'Booking details')}
        message={t('owner_bookings_details_message', 'View the full booking information and manage the request.')}
        confirmLabel={t('owner_bookings_close', 'Close')}
        badgeLabel={t('owner_bookings_details_badge', 'Booking Details')}
        variant="default"
        showCancel={false}
        showConfirm={false}
        onConfirm={() => setSelectedBooking(null)}
        onClose={() => setSelectedBooking(null)}
      >
        {selectedBooking && (
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={statusTone(selectedBooking.status)} className="capitalize">
                {t(statusTranslationKey(selectedBooking.status) || selectedBooking.status, selectedBooking.status)}
              </Badge>
              <Badge tone="green">{formatMoney(selectedBooking.totalPrice)}</Badge>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('owner_bookings_info', 'Booking Information')}</div>
              <div className="mt-2.5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t('owner_bookings_date', 'Date')}</div>
                  <div className="mt-1.5 text-sm font-medium text-slate-900">{formatDateTime(selectedBooking.startTime).split(',')[0]}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t('owner_bookings_start_time', 'Start Time')}</div>
                  <div className="mt-1.5 text-sm font-medium text-slate-900">{formatTimeOnly(selectedBooking.startTime)}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t('owner_bookings_end_time', 'End Time')}</div>
                  <div className="mt-1.5 text-sm font-medium text-slate-900">{formatTimeOnly(selectedBooking.endTime)}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t('owner_bookings_id', 'Booking ID')}</div>
                  <div className="mt-1.5 text-sm font-medium text-slate-900">#{selectedBooking.id}</div>
                </div>
              </div>
            </div>

            <div className="grid gap-2 lg:grid-cols-[1.08fr_0.92fr]">
              <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('owner_bookings_captain_account', 'Captain Account')}</div>
                  <div className="mt-1 text-xs text-slate-500">{t('owner_bookings_captain_account_subtitle', 'Who created this booking')}</div>
                </div>
                <div className="mt-2.5 flex items-center gap-3 rounded-xl bg-slate-50 p-2.5">
                  <img
                    src={resolveAvatarUrl(selectedBooking?.team?.captain)}
                    alt={`${captainDisplayName(selectedBooking)} avatar`}
                    className="h-12 w-12 rounded-full border border-slate-200 bg-slate-100 object-cover"
                    onError={(event) => {
                      const fallbackUrl = `${API_ORIGIN}${DEFAULT_PROFILE_PATH}`;
                      if (event.currentTarget.src !== fallbackUrl) {
                        event.currentTarget.src = fallbackUrl;
                      }
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold leading-tight text-slate-900">{captainDisplayName(selectedBooking)}</div>
                    <div className="mt-0.5 text-xs text-slate-600">@{selectedBooking?.team?.captain?.username || t('team_captain', 'captain')}</div>
                    <div className="mt-1.5 inline-flex rounded-full bg-white px-2 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-slate-200">
                      {selectedBooking.team?.name || t('owner_bookings_no_team_assigned', 'No team assigned')}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('nav_teams', 'Teams')}</div>
                <div className="mt-2.5 space-y-2">
                    <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t('owner_bookings_home_team', 'Home Team')}</div>
                      <div className="mt-1.5 text-sm font-medium text-slate-900">{selectedBooking.team?.name || t('owner_bookings_team_not_assigned', 'Team not assigned')}</div>
                      <div className="mt-1 text-xs text-slate-600">{t('teams_captain_label', 'Captain: {{name}}', { name: captainDisplayName(selectedBooking) })}</div>
                      <div className="mt-1 inline-flex items-center gap-1.5">
                        {getTeamJerseyColors(selectedBooking.team).map((color, index) => (
                          <span key={`modal-home-${color}-${index}`} className="h-3.5 w-3.5 rounded-full border border-black/10" style={{ backgroundColor: color }} />
                        ))}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t('owner_bookings_opponent_team', 'Opponent Team')}</div>
                      <div className="mt-1.5 text-sm font-medium text-slate-900">{selectedBooking.opponentTeam?.name || t('owner_bookings_not_assigned_yet', 'Not assigned yet')}</div>
                      {selectedBooking.opponentTeam && (
                        <div className="mt-1 inline-flex items-center gap-1.5">
                          {getTeamJerseyColors(selectedBooking.opponentTeam).map((color, index) => (
                            <span key={`modal-away-${color}-${index}`} className="h-3.5 w-3.5 rounded-full border border-black/10" style={{ backgroundColor: color }} />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('field_name', 'Field')}</div>
                <div className="mt-1.5 text-sm font-medium text-slate-900">{selectedBooking.field?.name || t('field_name', 'Field')}</div>
                {selectedBooking.field?.address && (
                  <div className="mt-1 inline-flex items-start gap-1 text-xs text-slate-600">
                    <MapPinIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{selectedBooking.field.address}</span>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('owner_bookings_other_info', 'Other Information')}</div>
                <div className="mt-1.5 text-sm font-medium text-slate-900">{selectedBooking.field?.name || t('field_name', 'Field')}</div>
                <div className="mt-1 text-xs text-slate-600">
                  {selectedBooking.field?.city || selectedBooking.field?.province
                    ? [selectedBooking.field?.city, selectedBooking.field?.province].filter(Boolean).join(', ')
                    : t('owner_bookings_location_unavailable', 'Location details not available')}
                </div>
              </div>
            </div>

            {selectedBooking.matchResult?.id && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{t('booking_complete', 'Result')}</div>
                <div className="mt-1.5 text-sm font-medium text-emerald-900">
                  {selectedBooking.team?.name || t('owner_bookings_home_team', 'Home Team')} {selectedBooking.matchResult.homeScore} - {selectedBooking.matchResult.awayScore}{' '}
                  {selectedBooking.opponentTeam?.name || t('owner_bookings_away_team', 'Away Team')}
                </div>
              </div>
            )}

            {selectedBooking.status === 'pending' && (
              <div className="flex flex-wrap items-center justify-end gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="mr-auto min-w-[220px]">
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t('owner_bookings_match_date', 'Match date')}</label>
                  <input
                    type="date"
                    value={acceptDateByBooking[selectedBooking.id] ?? toDateInputValue(selectedBooking.startTime)}
                    min={toDateInputValue(new Date())}
                    onClick={openNativeDatePicker}
                    onChange={(event) =>
                      setAcceptDateByBooking((prev) => ({
                        ...prev,
                        [selectedBooking.id]: event.target.value
                      }))
                    }
                    className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900"
                  />
                </div>
                <Button
                  size="sm"
                  variant="danger"
                  className="h-8 px-3 text-xs"
                  disabled={updatingId === selectedBooking.id}
                  onClick={async () => {
                    await handleStatus(selectedBooking, 'cancelled');
                    setSelectedBooking(null);
                  }}
                >
                  <XCircleIcon className="h-4 w-4" />
                  {t('action_cancel', 'Cancel')}
                </Button>
                <Button
                  size="sm"
                  className="h-8 px-3 text-xs"
                  disabled={updatingId === selectedBooking.id}
                  onClick={async () => {
                    await handleStatus(selectedBooking, 'confirmed');
                    setSelectedBooking(null);
                  }}
                >
                  <CheckCircleIcon className="h-4 w-4" />
                  {t('owner_bookings_accept', 'Accept Booking')}
                </Button>
              </div>
            )}
          </div>
        )}
      </ConfirmationModal>

      <MemberDetailsModal
        member={captainDetailsOpen ? selectedBooking?.team?.captain : null}
        onClose={() => setCaptainDetailsOpen(false)}
      />
    </div>
  );
};

export default OwnerBookingsPage;
