import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowTrendingUpIcon,
  BuildingOfficeIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  PlusIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import fieldService from '../services/fieldService';
import bookingService from '../services/bookingService';
import { useLanguage } from '../context/LanguageContext';
import { AnimatedStatValue, Badge, Button, Card, CardBody, CardHeader, EmptyState, Spinner, useDialog } from '../components/ui';
import { useRealtime } from '../context/RealtimeContext';

// Support status tone for this page.
const statusTone = (status) => {
  const tones = { pending: 'yellow', confirmed: 'green', cancellation_pending: 'orange', completed: 'blue', cancelled: 'red' };
  return tones[status] || 'gray';
};

const formatMoney = (value, locale) => {
  const n = Number(value || 0);
  return n.toLocaleString(locale, { style: 'currency', currency: 'USD' });
};

const getStatusTranslationKey = (status) => {
  const keys = {
    pending: 'common_pending',
    confirmed: 'common_confirmed',
    cancellation_pending: 'booking_cancellation_pending',
    completed: 'common_completed',
    cancelled: 'common_cancelled',
    available: 'field_available'
  };

  return keys[status] || null;
};

const OwnerDashboardPage = () => {
  const { version } = useRealtime();
  const navigate = useNavigate();
  const { confirm } = useDialog();
  const { t, language } = useLanguage();
  const [fields, setFields] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState(null);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const fetchOwnerData = async () => {
      const isInitialLoad = !hasLoadedRef.current;
      try {
        if (isInitialLoad) {
          setLoading(true);
        }
        setError(null);
        const [fieldsRes, bookingsRes] = await Promise.all([
          fieldService.getMyFields(),
          bookingService.getAllBookings({ limit: 200 })
        ]);
        if (cancelled) return;
        setFields(Array.isArray(fieldsRes.data) ? fieldsRes.data : []);
        setBookings(Array.isArray(bookingsRes.data) ? bookingsRes.data : []);
        hasLoadedRef.current = true;
      } catch (err) {
        if (cancelled) return;
        setError(err?.error || 'Failed to load owner dashboard');
      } finally {
        if (!cancelled && isInitialLoad) {
          setLoading(false);
        }
      }
    };

    fetchOwnerData();

    return () => {
      cancelled = true;
    };
  }, [version]);

  const pendingBookings = useMemo(() => bookings.filter((booking) => booking.status === 'pending'), [bookings]);
  const confirmedBookings = useMemo(() => bookings.filter((booking) => booking.status === 'confirmed'), [bookings]);

  const upcomingConfirmed = useMemo(() => {
    const now = Date.now();
    return confirmedBookings
      .filter((booking) => booking?.startTime && new Date(booking.startTime).getTime() >= now)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      .slice(0, 5);
  }, [confirmedBookings]);

  const revenueEstimate = useMemo(() => {
    return bookings
      .filter((booking) => booking.ownerRevenueLocked || booking.status === 'confirmed' || booking.status === 'completed')
      .reduce((sum, booking) => sum + Number(booking.totalPrice || 0), 0);
  }, [bookings]);

  const locale = language === 'km' ? 'km-KH' : 'en-US';

  const formatBookingDateTime = (value) => {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toLocaleString(locale);
  };

  const kpiCards = useMemo(
    () => [
      {
        name: t('stat_my_fields', 'My Fields'),
        value: fields.length,
        valueType: 'number',
        icon: BuildingOfficeIcon,
        iconWrap: 'bg-blue-600',
        cardClass: 'border-blue-100 bg-gradient-to-br from-blue-50 via-white to-blue-100/70',
        textClass: 'text-blue-950'
      },
      {
        name: t('stat_pending_requests', 'Pending Requests'),
        value: pendingBookings.length,
        valueType: 'number',
        icon: ClockIcon,
        iconWrap: 'bg-amber-500',
        cardClass: 'border-amber-100 bg-gradient-to-br from-amber-50 via-white to-amber-100/70',
        textClass: 'text-amber-950'
      },
      {
        name: t('stat_confirmed', 'Confirmed'),
        value: confirmedBookings.length,
        valueType: 'number',
        icon: CalendarIcon,
        iconWrap: 'bg-emerald-600',
        cardClass: 'border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-emerald-100/70',
        textClass: 'text-emerald-950'
      },
      {
        name: t('stat_revenue_est', 'Revenue (est.)'),
        value: revenueEstimate,
        valueType: 'currency',
        icon: ArrowTrendingUpIcon,
        iconWrap: 'bg-indigo-600',
        cardClass: 'border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-indigo-100/70',
        textClass: 'text-indigo-950'
      }
    ],
    [fields.length, pendingBookings.length, confirmedBookings.length, revenueEstimate, t]
  );

  // Handle status interactions.
  const handleStatus = async (bookingId, nextStatus) => {
    try {
      setUpdatingId(bookingId);
      setError(null);

      if (nextStatus === 'confirmed') {
        const confirmed = await confirm(t('owner_confirm_booking_message', 'តើអ្នកចង់បញ្ជាក់ការកក់នេះមែនទេ?'), {
          title: t('owner_confirm_booking_title', 'បញ្ជាក់ការកក់'),
          confirmText: t('action_confirm', 'បញ្ជាក់'),
          cancelText: t('action_cancel', 'បោះបង់'),
          badgeLabel: t('dialog_confirmation', 'ការបញ្ជាក់')
        });
        if (!confirmed) return;
        await bookingService.confirmBooking(bookingId);
      }
      if (nextStatus === 'cancelled') {
        const confirmed = await confirm(t('owner_cancel_booking_message', 'តើអ្នកចង់បោះបង់ការកក់នេះមែនទេ?'), {
          title: t('owner_cancel_booking_title', 'បោះបង់ការកក់'),
          confirmText: t('action_confirm', 'បញ្ជាក់'),
          cancelText: t('action_cancel', 'បោះបង់'),
          badgeLabel: t('dialog_confirmation', 'ការបញ្ជាក់')
        });
        if (!confirmed) return;
        await bookingService.cancelBooking(bookingId);
      }
      if (nextStatus === 'completed') {
        await bookingService.completeBooking(bookingId);
      }

      setBookings((current) =>
        current.map((booking) => {
          if (booking.id !== bookingId) return booking;

          const ownerRevenueLocked =
            nextStatus === 'confirmed'
              ? true
              : nextStatus === 'cancelled' && booking.status === 'confirmed'
                ? true
                : booking.ownerRevenueLocked;

          return {
            ...booking,
            status: nextStatus,
            ownerRevenueLocked
          };
        })
      );
    } catch (err) {
      setError(err?.error || 'Failed to update booking');
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-emerald-50/70 p-6 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 ring-1 ring-emerald-200">
              {t('owner_badge', 'Field Owner')}
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950">{t('owner_dashboard_title', 'Owner Dashboard')}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              {t('owner_dashboard_subtitle', 'Track your fields, review booking requests, and keep your schedule under control.')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button as={Link} to="/owner/fields" variant="outline" size="sm" className="rounded-xl border-slate-300 bg-white px-4">
              <PlusIcon className="h-4 w-4" />
              {t('action_add_field', 'Add field')}
            </Button>
            <Button as={Link} to="/owner/bookings" size="sm" className="rounded-xl px-4 shadow-sm shadow-emerald-600/20">
              <ClockIcon className="h-4 w-4" />
              {t('action_review_requests', 'Review requests')}
            </Button>
            <Button as={Link} to="/owner/matches" variant="outline" size="sm" className="rounded-xl border-slate-300 bg-white px-4">
              <CalendarIcon className="h-4 w-4" />
              {t('nav_matches', 'Matches')}
            </Button>
          </div>
        </div>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((card) => (
          <Card key={card.name} className={`overflow-hidden ${card.cardClass}`}>
            <CardBody className="px-4 py-4">
              <div className="flex items-center gap-4">
                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm ${card.iconWrap}`}>
                  <card.icon className="h-6 w-6 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{card.name}</div>
                  <AnimatedStatValue
                    value={card.value}
                    type={card.valueType}
                    locale={locale}
                    className={`mt-1.5 text-[1.8rem] font-bold leading-none ${card.textClass}`}
                  />
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-950">{t('owner_pending_title', 'Pending booking requests')}</h2>
              <p className="mt-1 text-sm text-slate-500">{t('owner_pending_subtitle', 'Approve or reject new requests from teams.')}</p>
            </div>
            <Badge tone="yellow">{t('owner_pending_count', '{{count}} pending', { count: pendingBookings.length })}</Badge>
          </CardHeader>
          <div className="bg-white">
            {pendingBookings.length > 0 ? (
              <div className="divide-y divide-slate-200">
                {pendingBookings.slice(0, 6).map((booking) => {
                  const isUpdating = updatingId === booking.id;
                  return (
                    <div key={booking.id} className="px-6 py-5 transition hover:bg-slate-50/80">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="truncate text-sm font-semibold text-slate-950">{booking.field?.name || t('nav_fields', 'Field')}</div>
                            <Badge tone={statusTone(booking.status)} className="capitalize">
                              {t(getStatusTranslationKey(booking.status), booking.status)}
                            </Badge>
                          </div>
                          <div className="mt-1.5 text-xs text-slate-600">
                            {formatBookingDateTime(booking.startTime)} | {booking.team?.name || t('nav_teams', 'Team')}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button size="sm" className="rounded-xl px-4" disabled={isUpdating} onClick={() => handleStatus(booking.id, 'confirmed')}>
                            <CheckCircleIcon className="h-4 w-4" />
                            {t('action_confirm', 'Confirm')}
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            className="rounded-xl px-4"
                            disabled={isUpdating}
                            onClick={() => handleStatus(booking.id, 'cancelled')}
                          >
                            <XCircleIcon className="h-4 w-4" />
                            {t('action_cancel', 'Cancel')}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6">
                <EmptyState
                  icon={ClockIcon}
                  title={t('owner_pending_empty_title', 'No pending requests')}
                  description={t('owner_pending_empty_description', 'When players create bookings for your fields, they will show up here.')}
                />
              </div>
            )}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-950">{t('owner_upcoming_title', 'Upcoming confirmed')}</h2>
              <p className="mt-1 text-sm text-slate-500">{t('owner_upcoming_subtitle', 'Your next scheduled bookings after approval.')}</p>
            </div>
            <Badge tone="green">{t('owner_upcoming_count', '{{count}} upcoming', { count: upcomingConfirmed.length })}</Badge>
          </CardHeader>
          <div className="bg-white">
            {upcomingConfirmed.length > 0 ? (
              <div className="divide-y divide-slate-200">
                {upcomingConfirmed.map((booking) => (
                  <div key={booking.id} className="flex items-center justify-between gap-4 px-6 py-5 transition hover:bg-slate-50/80">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="truncate text-sm font-semibold text-slate-950">{booking.field?.name || t('nav_fields', 'Field')}</div>
                        <Badge tone="green">{t('common_confirmed', 'Confirmed')}</Badge>
                      </div>
                      <div className="mt-1.5 truncate text-xs text-slate-600">
                        {formatBookingDateTime(booking.startTime)} | {booking.team?.name || t('nav_teams', 'Team')}
                      </div>
                    </div>
                    <div className="shrink-0">
                      <Badge tone="green">{formatMoney(booking.totalPrice, locale)}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6">
                <EmptyState
                  icon={CalendarIcon}
                  title={t('owner_upcoming_empty_title', 'No upcoming bookings')}
                  description={t('owner_upcoming_empty_description', 'Confirm pending requests to see your upcoming schedule.')}
                  actionLabel={t('action_go_to_requests', 'Go to requests')}
                  onAction={() => navigate('/owner/bookings')}
                />
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">{t('owner_my_fields_title', 'My fields')}</h2>
            <p className="mt-1 text-sm text-slate-500">{t('owner_my_fields_subtitle', 'Your venues, availability, and pricing at a glance.')}</p>
          </div>
          <Button as={Link} to="/owner/fields" variant="outline" size="sm" className="rounded-xl border-slate-300 bg-white px-4">
            {t('action_manage_fields', 'Manage fields')}
          </Button>
        </CardHeader>
        <div className="bg-white">
          {fields.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {fields.slice(0, 6).map((field) => (
                <div key={field.id} className="flex items-center justify-between gap-4 px-6 py-5 transition hover:bg-slate-50/80">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate text-sm font-semibold text-slate-950">{field.name}</div>
                      {field.status && (
                        <Badge tone={field.status === 'available' ? 'green' : 'gray'} className="capitalize">
                          {t(getStatusTranslationKey(field.status), field.status)}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1.5 truncate text-xs text-slate-600">
                      {field.city}
                      {field.province ? `, ${field.province}` : ''} | {formatMoney(field.pricePerHour, locale)}/hr
                    </div>
                  </div>
                  <Button as={Link} to="/owner/fields" size="sm" variant="outline" className="rounded-xl border-slate-300 bg-white px-4">
                    {t('action_edit', 'Edit')}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6">
                <EmptyState
                  icon={BuildingOfficeIcon}
                  title={t('owner_no_fields_title', 'No fields yet')}
                  description={t('owner_no_fields_description', 'Create your first field to start receiving booking requests.')}
                  actionLabel={t('action_add_field', 'Add field')}
                  onAction={() => navigate('/owner/fields')}
                />
            </div>
          )}
        </div>
      </Card>

    </div>
  );
};

export default OwnerDashboardPage;
