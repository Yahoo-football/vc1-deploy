import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarIcon, ClockIcon, UsersIcon } from '@heroicons/react/24/outline';
import bookingService from '../services/bookingService';
import teamService from '../services/teamService';
import { Badge, Button, Card, CardBody, EmptyState, Spinner } from '../components/ui';
import { getTeamJerseyColors } from '../utils/teamColors';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../context/RealtimeContext';
import { useLanguage } from '../context/LanguageContext';

// Render the open matches page.
const OpenMatchesPage = () => {
  const { user } = useAuth();
  const { version } = useRealtime();
  const { t } = useLanguage();
  const canUseOpenMatches = ['captain', 'field_owner'].includes(user?.role || '');
  const [openMatches, setOpenMatches] = useState([]);
  const [captainedTeams, setCaptainedTeams] = useState([]);
  const [selectedTeams, setSelectedTeams] = useState({});
  const [messages, setMessages] = useState({});
  const [submittingMap, setSubmittingMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  const defaultTeamId = useMemo(() => {
    if (captainedTeams.length === 0) return '';
    return String(captainedTeams[0].id);
  }, [captainedTeams]);

  const loadData = useCallback(async () => {
    if (!canUseOpenMatches) {
      setOpenMatches([]);
      setCaptainedTeams([]);
      setError(t('open_matches_access_only', 'This feature is available for team captains and field owners only.'));
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const [matchesResponse, teamsResponse] = await Promise.all([
        bookingService.getOpenMatches(),
        teamService.getCaptainedTeams()
      ]);

      const matches = Array.isArray(matchesResponse.data) ? matchesResponse.data : [];
      const teams = Array.isArray(teamsResponse.data) ? teamsResponse.data : [];
      setOpenMatches(matches);
      setCaptainedTeams(teams);
    } catch (err) {
      console.error('Failed to load open matches:', err);
      setError(err.error || t('open_matches_load_failed', 'Failed to load open matches'));
    } finally {
      setLoading(false);
    }
  }, [canUseOpenMatches, t]);

  useEffect(() => {
    loadData();
  }, [loadData, version]);

  useEffect(() => {
    if (!defaultTeamId) return;
    setSelectedTeams((prev) => {
      const next = { ...prev };
      for (const match of openMatches) {
        if (!next[match.id]) next[match.id] = defaultTeamId;
      }
      return next;
    });
  }, [openMatches, defaultTeamId]);

  // Format date for display.
  const formatDate = (dateString) => new Date(dateString).toLocaleDateString();
  // Format time for display.
  const formatTime = (dateString) =>
    new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const getCaptainName = (team) => {
    const fullName = `${team?.captain?.firstName || ''} ${team?.captain?.lastName || ''}`.trim();
    return fullName || team?.captain?.username || t('booking_unknown_captain', 'Unknown captain');
  };
  const getActiveMemberCount = (team) =>
    Array.isArray(team?.teamMembers)
      ? team.teamMembers.filter((member) => member.status === 'active' && member.isActive !== false).length
      : 0;

  const hasPendingRequest = (match) =>
    Array.isArray(match.myRequests) && match.myRequests.some((request) => request.status === 'pending');

  // Handle submit request interactions.
  const handleSubmitRequest = async (bookingId) => {
    try {
      const selectedTeamId = Number(selectedTeams[bookingId]);
      if (!selectedTeamId) {
        setError(t('open_matches_choose_team', 'Please choose a team before sending the request.'));
        return;
      }

      setSubmittingMap((prev) => ({ ...prev, [bookingId]: true }));
      setSuccessMessage('');
      await bookingService.requestJoinMatch(bookingId, selectedTeamId, messages[bookingId] || '');
      setSuccessMessage(t('open_matches_request_success', 'Join request submitted successfully.'));
      await loadData();
    } catch (err) {
      console.error('Failed to submit join request:', err);
      setError(err.error || t('open_matches_request_failed', 'Failed to submit join request'));
    } finally {
      setSubmittingMap((prev) => ({ ...prev, [bookingId]: false }));
    }
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
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">{t('nav_open_matches', 'Open Matches')}</h1>
          <p className="mt-2 text-sm text-gray-600">
            {t('page_open_matches_subtitle', 'Find and respond to open opponent matches')}
          </p>
        </div>
        <Badge tone="gray" className="px-4 py-1.5 text-sm">
          {t('open_matches_available_count', '{{count}} available', { count: openMatches.length })}
        </Badge>
      </div>

      {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md text-sm">{error}</div>}
      {successMessage && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md text-sm">{successMessage}</div>
      )}

      {captainedTeams.length === 0 && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 text-yellow-900 px-4 py-3 rounded-md text-sm">
          {t('open_matches_need_team', 'You need at least one team where you are captain to request an open match.')}
        </div>
      )}

      <Card className="overflow-hidden rounded-[28px] border border-slate-200 shadow-sm">
        <div className="divide-y divide-slate-200">
          {openMatches.length > 0 ? (
            openMatches.map((match) => {
              const ownerColors = getTeamJerseyColors(match.team);
              const selectedTeam = captainedTeams.find((team) => String(team.id) === String(selectedTeams[match.id] || ''));
              const selectedColors = selectedTeam ? getTeamJerseyColors(selectedTeam) : [];
              const ownerCaptainName = getCaptainName(match.team);
              const activeMemberCount = getActiveMemberCount(match.team);
              const hourlyRate = Number(match.field?.pricePerHour || 0);
              const discountPercent = Math.min(100, Math.max(0, Number(match.field?.discountPercent || 0)));
              const effectiveRate = Number((hourlyRate * (1 - discountPercent / 100)).toFixed(2));

              return (
              <CardBody key={match.id} className="p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      {match.field?.id ? (
                        <Link
                          to={`/fields/${match.field.id}`}
                          className="text-base font-semibold text-slate-950 transition hover:text-green-700 hover:underline"
                        >
                          {match.field?.name || t('booking_unknown_field', 'Unknown Field')}
                        </Link>
                      ) : (
                        <h3 className="text-base font-semibold text-slate-950">{match.field?.name || t('booking_unknown_field', 'Unknown Field')}</h3>
                      )}
                      <Badge tone="blue" className="px-3 py-1">{t('booking_open_for_opponents', 'Open for Opponents')}</Badge>
                    </div>

                    <div className="mt-2 grid grid-cols-1 gap-x-3 gap-y-2 text-sm text-gray-600 sm:grid-cols-2 xl:grid-cols-3">
                      <div className="inline-flex min-w-0 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                        <CalendarIcon className="h-4 w-4 text-slate-400" />
                        <span className="truncate">{formatDate(match.startTime)}</span>
                      </div>
                      <div className="inline-flex min-w-0 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                        <ClockIcon className="h-4 w-4 text-slate-400" />
                        <span className="truncate">{formatTime(match.startTime)} - {formatTime(match.endTime)}</span>
                      </div>
                      <div className="inline-flex min-w-0 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
                        <UsersIcon className="h-4 w-4 text-slate-400" />
                        <span className="truncate">{t('open_matches_owner_team', 'Owner Team: {{name}}', { name: match.team?.name || t('booking_unknown_team', 'Unknown team') })}</span>
                        <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-1">
                          {ownerColors.map((color, index) => (
                            <span key={`owner-${match.id}-${color}-${index}`} className="h-3.5 w-3.5 rounded-full border border-black/10" style={{ backgroundColor: color }} />
                          ))}
                        </span>
                      </div>
                      <div className="text-slate-600">{t('teams_captain_label', 'Captain: {{name}}', { name: ownerCaptainName })}</div>
                      <div className="text-slate-600">{t('open_matches_active_members', '{{count}} active members', { count: activeMemberCount })}</div>
                      <div className="text-slate-600">
                        {t('open_matches_rate', 'Rate: {{rate}}/hr', { rate: discountPercent > 0 ? effectiveRate.toFixed(2) : hourlyRate.toFixed(2) })}
                        {discountPercent > 0 && <span className="ml-2 text-green-600">{t('open_matches_discount', '({{percent}}% off)', { percent: discountPercent })}</span>}
                      </div>
                    </div>

                    {hasPendingRequest(match) && (
                      <p className="mt-2 text-sm text-yellow-700">{t('open_matches_pending_exists', 'You already have a pending request for this match.')}</p>
                    )}
                  </div>

                  <div className="w-full space-y-1.5 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 lg:max-w-sm lg:min-w-[20rem]">
                    <select
                      value={selectedTeams[match.id] || ''}
                      onChange={(e) => setSelectedTeams((prev) => ({ ...prev, [match.id]: e.target.value }))}
                      disabled={captainedTeams.length === 0 || hasPendingRequest(match)}
                      className="w-full rounded-xl border border-gray-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100"
                    >
                      <option value="">{t('open_matches_select_team', 'Select your team')}</option>
                      {captainedTeams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                    <textarea
                      rows={1}
                      placeholder={t('open_matches_optional_message', 'Optional message')}
                      value={messages[match.id] || ''}
                      onChange={(e) => setMessages((prev) => ({ ...prev, [match.id]: e.target.value }))}
                      disabled={captainedTeams.length === 0 || hasPendingRequest(match)}
                      className="w-full min-h-[38px] rounded-xl border border-gray-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100"
                    />
                    {selectedTeam && selectedColors.length > 0 && (
                      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{t('open_matches_your_jersey', 'Your Jersey')}</span>
                        <div className="inline-flex items-center gap-1">
                          {selectedColors.map((color, index) => (
                            <span key={`selected-${match.id}-${color}-${index}`} className="h-3.5 w-3.5 rounded-full border border-black/10" style={{ backgroundColor: color }} />
                          ))}
                        </div>
                      </div>
                    )}
                    <Button
                      className="h-9 w-full rounded-xl"
                      onClick={() => handleSubmitRequest(match.id)}
                      disabled={captainedTeams.length === 0 || hasPendingRequest(match) || submittingMap[match.id]}
                    >
                      {submittingMap[match.id] ? t('open_matches_sending', 'Sending...') : t('open_matches_request_join', 'Request to Join')}
                    </Button>
                  </div>
                </div>
              </CardBody>
            )})
          ) : (
            <div className="p-6">
              <EmptyState
                icon={CalendarIcon}
                title={t('open_matches_empty_title', 'No open matches right now')}
                description={t('open_matches_empty_description', 'Check again later for new matches opened by other captains.')}
              />
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default OpenMatchesPage;
