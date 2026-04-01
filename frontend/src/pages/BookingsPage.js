import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../context/RealtimeContext';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarIcon, ClockIcon, UsersIcon, CurrencyDollarIcon, PlusIcon } from '@heroicons/react/24/outline';
import bookingService from '../services/bookingService';
import { Badge, Button, Card, CardBody, EmptyState, Spinner, useDialog, useToast } from '../components/ui';
import { getTeamJerseyColors } from '../utils/teamColors';
import { useLanguage } from '../context/LanguageContext';

const TeamJerseyDots = ({ colors = [], teamKey }) => (
  <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-1 align-middle">
    {colors.map((color, index) => (
      <span
        key={`${teamKey}-${color}-${index}`}
        className="h-3.5 w-3.5 rounded-full border border-black/10"
        style={{ backgroundColor: color }}
      />
    ))}
  </span>
);

// Render the bookings page.
const BookingsPage = () => {
  const { user, isAdmin, isFieldOwner } = useAuth();
  const { version } = useRealtime();
  const navigate = useNavigate();
  const { confirm } = useDialog();
  const { showToast } = useToast();
  const { t } = useLanguage();
  const canCreateBooking = ['captain', 'field_owner'].includes(user?.role);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [openForOpponentsFilter, setOpenForOpponentsFilter] = useState('all');
  const [toggleLoadingMap, setToggleLoadingMap] = useState({});
  const [cancelMatchedLoadingMap, setCancelMatchedLoadingMap] = useState({});
  const [joinRequestsByBooking, setJoinRequestsByBooking] = useState({});
  const [joinRequestsLoadingMap, setJoinRequestsLoadingMap] = useState({});
  const [joinActionLoadingMap, setJoinActionLoadingMap] = useState({});
  const [cancellationLoadingMap, setCancellationLoadingMap] = useState({});
  const [cancellationRequestModal, setCancellationRequestModal] = useState({
    open: false,
    booking: null,
    reason: ''
  });

  const loadBookings = useCallback(async () => {
    try {
      setLoading(true);
      const response = await bookingService.getAllBookings();
      const bookingsData = Array.isArray(response.data) ? response.data : [];
      setBookings(bookingsData);

      if (user?.role === 'captain') {
        const targetBookings = bookingsData.filter(
          (booking) =>
            booking?.team?.captainId === user?.id &&
            booking?.openForOpponents &&
            !booking?.opponentTeam?.name &&
            booking?.status !== 'cancelled' &&
            booking?.status !== 'completed' &&
            booking?.status !== 'cancellation_pending'
        );

        if (targetBookings.length > 0) {
          setJoinRequestsLoadingMap((prev) => {
            const next = { ...prev };
            for (const booking of targetBookings) next[booking.id] = true;
            return next;
          });

          const results = await Promise.all(
            targetBookings.map(async (booking) => {
              try {
                const res = await bookingService.getBookingJoinRequests(booking.id);
                return { bookingId: booking.id, requests: Array.isArray(res.data) ? res.data : [] };
              } catch {
                return { bookingId: booking.id, requests: [] };
              }
            })
          );

          setJoinRequestsByBooking((prev) => {
            const next = { ...prev };
            for (const result of results) {
              next[result.bookingId] = result.requests;
            }
            return next;
          });

          setJoinRequestsLoadingMap((prev) => {
            const next = { ...prev };
            for (const booking of targetBookings) next[booking.id] = false;
            return next;
          });
        }
      }
    } catch (err) {
      console.error('Failed to fetch bookings:', err);
      showToast(err?.error || t('booking_load_failed'), { type: 'error' });
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [showToast, t, user?.id, user?.role]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings, version]);

  // Handle create booking interactions.
  const handleCreateBooking = () => {
    if (!canCreateBooking) {
      navigate('/app/settings', {
        state: { focusRoleRequest: 'captain' }
      });
      return;
    }
    navigate('/app/bookings/new');
  };

  // Handle update status interactions.
  const handleUpdateStatus = async (bookingId, newStatus) => {
    try {
      if (newStatus === 'confirmed') {
        await bookingService.confirmBooking(bookingId);
      } else if (newStatus === 'completed') {
        await bookingService.completeBooking(bookingId);
      } else if (newStatus === 'cancelled') {
        const confirmed = await confirm(t('booking_cancel_confirm'), { title: t('booking_cancel_title') });
        if (!confirmed) return;
        await bookingService.cancelBooking(bookingId);
      } else {
        await bookingService.updateBooking(bookingId, { status: newStatus });
      }
      await loadBookings();
      showToast(t('booking_update_success'), { type: 'success' });
    } catch (err) {
      console.error('Failed to update booking status:', err);
      showToast(err?.error || t('booking_update_failed'), { type: 'error' });
    }
  };

  const openCancellationRequestModal = (booking) => {
    setCancellationRequestModal({
      open: true,
      booking,
      reason: ''
    });
  };

  const closeCancellationRequestModal = () => {
    setCancellationRequestModal({
      open: false,
      booking: null,
      reason: ''
    });
  };

  const submitCancellationRequest = async () => {
    const booking = cancellationRequestModal.booking;
    if (!booking?.id) return;

    try {
      setCancellationLoadingMap((prev) => ({ ...prev, [booking.id]: true }));
      await bookingService.requestCancellation(booking.id, cancellationRequestModal.reason.trim());
      closeCancellationRequestModal();
      await loadBookings();
      showToast(t('booking_cancellation_sent'), { type: 'success' });
    } catch (err) {
      console.error('Failed to request cancellation:', err);
      showToast(err.error || t('booking_cancellation_failed'), { type: 'error' });
    } finally {
      setCancellationLoadingMap((prev) => ({ ...prev, [booking.id]: false }));
    }
  };

  // Check whether captain owner is true.
  const isCaptainOwner = (booking) => user?.role === 'captain' && booking.team?.captainId === user?.id;
  // Check whether captain in matched booking is true.
  const isCaptainInMatchedBooking = (booking) =>
    user?.role === 'captain' && (booking.team?.captainId === user?.id || booking.opponentTeam?.captainId === user?.id);

  // Handle toggle open for opponents interactions.
  const handleToggleOpenForOpponents = async (booking) => {
    try {
      setToggleLoadingMap((prev) => ({ ...prev, [booking.id]: true }));
      await bookingService.setOpenForOpponents(booking.id, !booking.openForOpponents);
      await loadBookings();
      showToast(t('booking_opponent_setting_updated'), { type: 'success' });
    } catch (err) {
      console.error('Failed to toggle open for opponents:', err);
      showToast(err.error || t('booking_open_opponents_failed'), { type: 'error' });
    } finally {
      setToggleLoadingMap((prev) => ({ ...prev, [booking.id]: false }));
    }
  };

  // Handle cancel matched opponent interactions.
  const handleCancelMatchedOpponent = async (booking) => {
    const confirmed = await confirm(
      t('booking_cancel_matched_confirm', 'Do you want to cancel this matched game: {{home}} vs {{away}}?', {
        home: booking.team?.name || 'Team A',
        away: booking.opponentTeam?.name || 'Team B'
      }),
      { title: t('booking_cancel_matched_title') }
    );
    if (!confirmed) return;

    try {
      setCancelMatchedLoadingMap((prev) => ({ ...prev, [booking.id]: true }));
      await bookingService.cancelMatchedOpponent(booking.id);
      await loadBookings();
      showToast(t('booking_matched_cancelled_success'), { type: 'success' });
    } catch (err) {
      console.error('Failed to cancel matched opponent:', err);
      showToast(err.error || t('booking_cancel_matched_failed'), { type: 'error' });
    } finally {
      setCancelMatchedLoadingMap((prev) => ({ ...prev, [booking.id]: false }));
    }
  };

  // Handle respond to join request interactions.
  const handleRespondToJoinRequest = async (bookingId, requestId, action) => {
    const key = `${bookingId}-${requestId}-${action}`;
    try {
      setJoinActionLoadingMap((prev) => ({ ...prev, [key]: true }));
      await bookingService.respondToJoinRequest(bookingId, requestId, action);
      await loadBookings();
      showToast(t(action === 'accept' ? 'booking_join_request_approved' : 'booking_join_request_rejected'), {
        type: 'success'
      });
    } catch (err) {
      console.error(`Failed to ${action} join request:`, err);
      showToast(err.error || t(action === 'accept' ? 'booking_join_request_approve_failed' : 'booking_join_request_reject_failed'), { type: 'error' });
    } finally {
      setJoinActionLoadingMap((prev) => ({ ...prev, [key]: false }));
    }
  };

  // Get status tone for the current view.
  const getStatusTone = (status) => {
    const tones = {
      pending: 'yellow',
      confirmed: 'green',
      cancellation_pending: 'orange',
      cancelled: 'red',
      completed: 'blue'
    };
    return tones[status] || 'gray';
  };

  const formatStatusLabel = (status) => {
    if (!status) return status;
    const labels = {
      pending: t('common_pending'),
      confirmed: t('common_confirmed'),
      cancellation_pending: t('owner_bookings_cancellation_pending'),
      cancelled: t('common_cancelled'),
      completed: t('common_completed')
    };
    return labels[status] || status.replace('_', ' ');
  };

  // const getStatusIcon = (status) => {
  //   const icons = {
  //     pending: <ClockIcon className="h-4 w-4" />,
  //     confirmed: <CheckCircleIcon className="h-4 w-4" />,
  //     cancelled: <XCircleIcon className="h-4 w-4" />,
  //     completed: <CheckCircleIcon className="h-4 w-4" />
  //   };
  //   return icons[status] || <ClockIcon className="h-4 w-4" />;
  // };

  const getStatusActions = (booking) => {
    const actions = [];
    const canDirectCancel = isAdmin() || isFieldOwner();
    const canRequestCancellation = isCaptainOwner(booking) && ['pending', 'confirmed'].includes(booking.status);

    if (booking.status === 'pending') {
      if (isAdmin() || isFieldOwner()) {
        actions.push(
          <Button key="confirm" size="sm" variant="outline" onClick={() => handleUpdateStatus(booking.id, 'confirmed')}>
            {t('action_confirm')}
          </Button>
        );
      }
      if (canDirectCancel) {
        actions.push(
          <Button key="cancel" size="sm" variant="danger" onClick={() => handleUpdateStatus(booking.id, 'cancelled')}>
            {t('booking_cancel_button')}
          </Button>
        );
      }
    }

    if (booking.status === 'confirmed' && canDirectCancel) {
      actions.push(
        <Button key="cancel-confirmed" size="sm" variant="danger" onClick={() => handleUpdateStatus(booking.id, 'cancelled')}>
          {t('booking_cancel_button')}
        </Button>
      );
    }

    if (canRequestCancellation) {
      actions.push(
        <Button
          key="request-cancel"
          size="sm"
          variant="danger"
          onClick={() => openCancellationRequestModal(booking)}
          disabled={!!cancellationLoadingMap[booking.id]}
        >
          {cancellationLoadingMap[booking.id] ? t('booking_requesting') : t('booking_request_cancellation')}
        </Button>
      );
    }

    if (booking.status === 'confirmed' && (isAdmin() || isFieldOwner())) {
      actions.push(
        <Button key="complete" size="sm" variant="outline" onClick={() => handleUpdateStatus(booking.id, 'completed')}>
          {t('booking_complete')}
        </Button>
      );
    }

    return actions;
  };

  const filteredBookings = Array.isArray(bookings)
    ? bookings.filter((booking) => {
        const statusMatch = statusFilter === 'all' ? true : booking.status === statusFilter;
        const openForOpponentsMatch =
          openForOpponentsFilter === 'all'
            ? true
            : openForOpponentsFilter === 'open'
            ? Boolean(booking.openForOpponents)
            : !booking.openForOpponents;
        return statusMatch && openForOpponentsMatch;
      })
    : [];

  // Format date for display.
  const formatDate = (dateString) => new Date(dateString).toLocaleDateString();
  // Format time for display.
  const formatTime = (dateString) => new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Calculate duration from the current data.
  const calculateDuration = (startTime, endTime) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const duration = (end - start) / (1000 * 60 * 60);
    return duration.toFixed(1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('booking_title')}</h1>
          <p className="mt-1 text-sm text-gray-600">
            {canCreateBooking ? t('booking_subtitle_manage') : t('booking_subtitle_track')}
          </p>
        </div>
        <Button
          onClick={handleCreateBooking}
          className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-200 transform hover:scale-105"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          {canCreateBooking ? t('booking_new') : t('booking_request_captain')}
        </Button>
      </div>

      <Card className="mb-6">
        <CardBody className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-medium text-gray-700">{t('booking_filter_status')}</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 text-sm"
            >
              <option value="all">{t('common_all')}</option>
              <option value="pending">{t('common_pending')}</option>
              <option value="confirmed">{t('common_confirmed')}</option>
              <option value="cancellation_pending">{t('owner_bookings_cancellation_pending')}</option>
              <option value="completed">{t('common_completed')}</option>
              <option value="cancelled">{t('common_cancelled')}</option>
            </select>

            {user?.role === 'captain' && (
              <>
                <label className="text-sm font-medium text-gray-700">{t('booking_filter_opponent')}</label>
                <select
                  value={openForOpponentsFilter}
                  onChange={(e) => setOpenForOpponentsFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 text-sm"
                >
                  <option value="all">{t('common_all')}</option>
                  <option value="open">{t('booking_open_for_opponents')}</option>
                  <option value="closed">{t('booking_not_open')}</option>
                </select>
              </>
            )}
          </div>
        </CardBody>
      </Card>

      <Card className="overflow-hidden">
        <div className="divide-y divide-gray-200">
          {filteredBookings.length > 0 ? (
            filteredBookings.map((booking) => {
              const homeColors = getTeamJerseyColors(booking.team);
              const awayColors = booking.opponentTeam ? getTeamJerseyColors(booking.opponentTeam) : [];

              return (
              <div key={booking.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center flex-wrap gap-3 mb-2">
                      {booking.field?.id ? (
                        <Link
                          to={`/app/fields/${booking.field.id}`}
                          className="text-lg font-medium text-emerald-700 underline-offset-4 hover:text-emerald-800 hover:underline"
                        >
                          {booking.field?.name || t('common_unknown')}
                        </Link>
                      ) : (
                        <h3 className="text-lg font-medium text-gray-900">{booking.field?.name || t('common_unknown')}</h3>
                      )}
                      <Badge tone={getStatusTone(booking.status)} className="capitalize">
                        {formatStatusLabel(booking.status)}
                      </Badge>
                      {booking.opponentTeam?.name ? (
                        <Badge tone="green">{t('booking_matched')}</Badge>
                      ) : booking.openForOpponents ? (
                        <Badge tone="blue">{t('booking_open_for_opponents')}</Badge>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600">
                      <div className="flex items-center">
                        <CalendarIcon className="h-4 w-4 mr-2 text-gray-400" />
                        <span>{formatDate(booking.startTime)}</span>
                      </div>
                      <div className="flex items-center">
                        <ClockIcon className="h-4 w-4 mr-2 text-gray-400" />
                        <span>{formatTime(booking.startTime)} - {formatTime(booking.endTime)}</span>
                      </div>
                      <div className="flex items-center">
                        <UsersIcon className="h-4 w-4 mr-1" />
                        {booking.team?.name || t('booking_no_team')}
                        {booking.opponentTeam?.name ? ` vs ${booking.opponentTeam.name}` : ''}
                      </div>
                      <div className="flex items-center">
                        <CurrencyDollarIcon className="h-4 w-4 mr-2 text-gray-400" />
                        <span className="font-medium text-gray-900">${booking.totalPrice}</span>
                        <span className="text-gray-400 ml-1">({calculateDuration(booking.startTime, booking.endTime)}h)</span>
                      </div>
                    </div>

                    <div className="mt-2 text-xs text-gray-500">
                        {t('booking_booked_by')}: {booking.creator?.firstName || booking.creator?.username || t('common_unknown')} | {t('common_created')}:{' '}
                      {formatDate(booking.createdAt)}
                    </div>

                    {booking.status === 'pending' && isCaptainOwner(booking) && (
                      <div className="mt-2 inline-flex rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        {t('booking_waiting_owner_approval')}
                      </div>
                    )}

                    {booking.status === 'cancellation_pending' && (
                      <div className="mt-2 rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-800">
                        {t('booking_cancellation_requested')}
                      </div>
                    )}

                    {booking.opponentTeam?.name && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-green-700">
                        <span>{t('booking_already_matched')}</span>
                        <span className="font-medium text-green-800">{booking.team?.name || t('booking_team_a')}</span>
                        <TeamJerseyDots colors={homeColors} teamKey={`home-${booking.id}`} />
                        <span className="text-gray-400">{t('booking_vs')}</span>
                        <TeamJerseyDots colors={awayColors} teamKey={`away-${booking.id}`} />
                        <span className="font-medium text-green-800">{booking.opponentTeam.name}</span>
                      </div>
                    )}

                    {booking.opponentTeam?.name &&
                      isCaptainInMatchedBooking(booking) &&
                      booking.status !== 'cancelled' &&
                      booking.status !== 'completed' &&
                      booking.status !== 'cancellation_pending' && (
                        <div className="mt-3">
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleCancelMatchedOpponent(booking)}
                            disabled={!!cancelMatchedLoadingMap[booking.id]}
                          >
                            {cancelMatchedLoadingMap[booking.id] ? t('booking_cancelling_match') : t('booking_cancel_matched_opponent')}
                          </Button>
                        </div>
                      )}

                    {isCaptainOwner(booking) &&
                      booking.status !== 'cancelled' &&
                      booking.status !== 'completed' &&
                      booking.status !== 'cancellation_pending' && (
                      <div className="mt-4">
                        <div className="flex items-center flex-wrap gap-2">
                          {!booking.opponentTeam?.name && (
                            <Button
                              size="sm"
                              variant={booking.openForOpponents ? 'warning' : 'primary'}
                              onClick={() => handleToggleOpenForOpponents(booking)}
                              disabled={!!toggleLoadingMap[booking.id]}
                            >
                              {toggleLoadingMap[booking.id]
                                ? t('common_updating')
                                : booking.openForOpponents
                                ? t('booking_close_match')
                                : t('booking_open_match')}
                            </Button>
                          )}

                        </div>

                        {booking.openForOpponents && !booking.opponentTeam?.name && (
                          <div className="mt-3 rounded-md border border-gray-200 bg-white p-3">
                            <p className="text-sm font-medium text-gray-800 mb-2">{t('booking_join_requests')}</p>
                            {joinRequestsLoadingMap[booking.id] ? (
                              <p className="text-sm text-gray-500">{t('booking_loading_requests')}</p>
                            ) : Array.isArray(joinRequestsByBooking[booking.id]) &&
                              joinRequestsByBooking[booking.id].length > 0 ? (
                              <div className="space-y-2">
                                {joinRequestsByBooking[booking.id].map((request) => {
                                  const captainName =
                                    request?.requesterTeam?.captain?.firstName || request?.requesterTeam?.captain?.lastName
                                      ? `${request.requesterTeam?.captain?.firstName || ''} ${
                                          request.requesterTeam?.captain?.lastName || ''
                                        }`.trim()
                                      : request?.requesterTeam?.captain?.username || t('booking_unknown_captain');
                                  return (
                                    <div
                                      key={request.id}
                                      className="border border-gray-100 rounded-md p-2 flex items-center justify-between gap-3"
                                    >
                                      <div>
                                        <p className="text-sm text-gray-800">
                                          {request.requesterTeam?.name || t('booking_unknown_team')} ({formatStatusLabel(request.status)})
                                        </p>
                                        <p className="text-xs text-gray-600 mt-1">{t('teams_captain_label', 'Captain: {{name}}', { name: captainName })}</p>
                                        {request.message && <p className="text-xs text-gray-500 mt-1">"{request.message}"</p>}
                                      </div>

                                      {request.status === 'pending' && (
                                        <div className="flex items-center gap-2">
                                          <Button
                                            size="sm"
                                            variant="primary"
                                            onClick={() => handleRespondToJoinRequest(booking.id, request.id, 'accept')}
                                            disabled={!!joinActionLoadingMap[`${booking.id}-${request.id}-accept`]}
                                          >
                                            {t('notifications_approve_join')}
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="danger"
                                            onClick={() => handleRespondToJoinRequest(booking.id, request.id, 'reject')}
                                            disabled={!!joinActionLoadingMap[`${booking.id}-${request.id}-reject`]}
                                          >
                                            {t('teams_decline')}
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500">{t('booking_no_requests')}</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 ml-6">{getStatusActions(booking)}</div>
                </div>
              </div>
            )})
          ) : (
            <div className="p-12 text-center">
              <EmptyState
                icon={CalendarIcon}
                title={t('booking_empty_title')}
                description={
                  statusFilter === 'all' && openForOpponentsFilter === 'all'
                    ? canCreateBooking
                      ? t('booking_empty_create_first')
                      : t('booking_empty_request_captain')
                    : t('booking_empty_filtered')
                }
                actionLabel={canCreateBooking ? t('booking_new') : t('booking_request_captain')}
                onAction={handleCreateBooking}
              />
            </div>
          )}
        </div>
      </Card>

      {cancellationRequestModal.open && cancellationRequestModal.booking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="border-b border-gray-200 px-5 py-4">
              <h2 className="text-lg font-semibold text-gray-900">{t('booking_request_cancellation')}</h2>
              <p className="mt-1 text-sm text-gray-600">
                {t('booking_send_cancellation_for')}{' '}
                <span className="font-semibold">
                  {cancellationRequestModal.booking.field?.name || t('booking_this_booking')}
                </span>
                .
              </p>
            </div>

            <div className="px-5 py-4">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                {t('booking_reason_for_cancellation')}
              </label>
              <textarea
                value={cancellationRequestModal.reason}
                onChange={(event) =>
                  setCancellationRequestModal((prev) => ({
                    ...prev,
                    reason: event.target.value
                  }))
                }
                rows={4}
                placeholder={t('booking_reason_placeholder')}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-4">
              <button
                type="button"
                onClick={closeCancellationRequestModal}
                disabled={!!cancellationLoadingMap[cancellationRequestModal.booking.id]}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {t('owner_bookings_close')}
              </button>
              <button
                type="button"
                onClick={submitCancellationRequest}
                disabled={!!cancellationLoadingMap[cancellationRequestModal.booking.id]}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {cancellationLoadingMap[cancellationRequestModal.booking.id] ? t('booking_requesting') : t('booking_send_request')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingsPage;
