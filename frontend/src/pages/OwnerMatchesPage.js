import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  CalendarIcon,
  CheckCircleIcon,
  TrophyIcon,
  BuildingOfficeIcon,
  PhotoIcon
} from '@heroicons/react/24/outline';
import bookingService from '../services/bookingService';
import teamService from '../services/teamService';
import userService from '../services/userService';
import notificationService from '../services/notificationService';
import { useRealtime } from '../context/RealtimeContext';
import { useLanguage } from '../context/LanguageContext';
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Spinner } from '../components/ui';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';
const API_ORIGIN =
  typeof window !== 'undefined' && API_BASE_URL.startsWith('/')
    ? window.location.origin
    : API_BASE_URL.replace(/\/api\/?$/, '');

// Support status tone for this page.
const statusTone = (status) => {
  const tones = { confirmed: 'green', completed: 'blue' };
  return tones[status] || 'gray';
};

const statusTranslationKey = (status) => {
  const map = {
    confirmed: 'common_confirmed',
    completed: 'common_completed'
  };
  return map[status] || null;
};

const resolveTeamLogoUrl = (team) => {
  const raw = team?.logoUrl || team?.logo_url || team?.logo || null;
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw) || /^data:image\//i.test(raw)) return raw;
  const normalized = String(raw).startsWith('/') ? raw : `/${raw}`;
  return `${API_ORIGIN}${normalized}`;
};

// Support team avatar for this page.
const TeamAvatar = ({ teamName, logoUrl }) => {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = !!logoUrl && !imageFailed;
  useEffect(() => {
    setImageFailed(false);
  }, [logoUrl]);

  return (
    <div className="mx-auto h-12 w-12 sm:h-14 sm:w-14 rounded-full border border-gray-200 bg-gray-100 overflow-hidden shadow-sm">
      {showImage ? (
        <img
          src={logoUrl}
          alt={`${teamName} logo`}
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className="h-full w-full flex items-center justify-center text-gray-400 bg-gray-50">
          <PhotoIcon className="h-5 w-5 sm:h-6 sm:w-6" />
        </div>
      )}
    </div>
  );
};

// Render the owner matches page.
const OwnerMatchesPage = () => {
  const { user } = useAuth();
  const { version } = useRealtime();
  const { t } = useLanguage();
  const PAGE_SIZE = 10;
  const RESULT_EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [activeCardId, setActiveCardId] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [resultDrafts, setResultDrafts] = useState({});
  const [eligiblePlayersByBooking, setEligiblePlayersByBooking] = useState({});
  const [eligiblePlayersLoadingMap, setEligiblePlayersLoadingMap] = useState({});
  const [teamLogosById, setTeamLogosById] = useState({});
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Support refresh for this page.
  const refresh = async () => {
    const res = await bookingService.getAllBookings({ limit: 300 });
    setBookings(Array.isArray(res.data) ? res.data : []);
  };

  useEffect(() => {
    // Support load for this page.
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        await refresh();
      } catch (err) {
        setError(err?.error || t('owner_matches_load_failed', 'Failed to load matches'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [t, version]);

  const matches = useMemo(() => {
    return bookings
      .filter((b) => ['confirmed', 'completed'].includes(b.status) && b.team?.id && b.opponentTeam?.id)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }, [bookings]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [matches.length]);

  const visibleMatches = useMemo(() => matches.slice(0, visibleCount), [matches, visibleCount]);
  const canShowMore = matches.length > visibleCount;

  useEffect(() => {
    const teamIds = Array.from(
      new Set(
        matches
          .flatMap((m) => [m.team?.id, m.opponentTeam?.id])
          .filter(Boolean)
      )
    );

    const missingIds = teamIds.filter((id) => teamLogosById[id] === undefined);
    if (missingIds.length === 0) return;

    let cancelled = false;

    // Support load team logos for this page.
    const loadTeamLogos = async () => {
      const entries = await Promise.all(
        missingIds.map(async (teamId) => {
          try {
            const response = await teamService.getTeamById(teamId);
            const teamData = response?.data || null;
            return [teamId, resolveTeamLogoUrl(teamData)];
          } catch {
            return [teamId, null];
          }
        })
      );

      if (cancelled) return;

      setTeamLogosById((prev) => {
        const next = { ...prev };
        for (const [teamId, logoUrl] of entries) {
          if (next[teamId] === undefined) {
            next[teamId] = logoUrl;
          }
        }
        return next;
      });
    };

    loadTeamLogos();

    return () => {
      cancelled = true;
    };
  }, [matches, teamLogosById]);

  // Get initial draft for the current view.
  const getInitialDraft = (booking) => ({
    homeScore: booking?.matchResult?.homeScore ?? '',
    awayScore: booking?.matchResult?.awayScore ?? '',
    matchNotes: booking?.matchResult?.matchNotes || '',
    mvpPlayerId: booking?.matchResult?.mvpPlayerId ?? ''
  });

  const loadEligiblePlayersForBooking = async (booking) => {
    const bookingId = booking?.id;
    const homeTeamId = booking?.team?.id;
    const awayTeamId = booking?.opponentTeam?.id;
    if (!bookingId || !homeTeamId || !awayTeamId) return;
    if (eligiblePlayersByBooking[bookingId]) return;

    try {
      setEligiblePlayersLoadingMap((prev) => ({ ...prev, [bookingId]: true }));
      const [homeMembersRes, awayMembersRes] = await Promise.all([
        teamService.getTeamMembers(homeTeamId),
        teamService.getTeamMembers(awayTeamId)
      ]);

      const normalizeMembers = (members, team) => {
        const rows = Array.isArray(members) ? members : [];
        return rows
          .filter((member) => member?.status === 'active' && member?.isActive !== false && member?.user?.id)
          .map((member) => ({
            id: Number(member.user.id),
            username: member.user.username || '',
            firstName: member.user.firstName || '',
            lastName: member.user.lastName || '',
            teamName: team?.name || t('create_booking_team', 'Team')
          }));
      };

      const candidates = [
        ...normalizeMembers(homeMembersRes?.data, booking?.team),
        ...normalizeMembers(awayMembersRes?.data, booking?.opponentTeam)
      ];

      const deduped = Array.from(
        new Map(candidates.map((item) => [item.id, item])).values()
      );

      setEligiblePlayersByBooking((prev) => ({
        ...prev,
        [bookingId]: deduped
      }));
    } catch {
      setEligiblePlayersByBooking((prev) => ({
        ...prev,
        [bookingId]: []
      }));
    } finally {
      setEligiblePlayersLoadingMap((prev) => ({ ...prev, [bookingId]: false }));
    }
  };

  const handleCardClick = (booking) => {
    setError(null);
    setActiveCardId((prev) => (prev === booking.id ? null : booking.id));
    setResultDrafts((prev) => ({
      ...prev,
      [booking.id]: prev[booking.id] || getInitialDraft(booking)
    }));
    loadEligiblePlayersForBooking(booking);
  };

  // Update draft in local state.
  const updateDraft = (bookingId, key, value) => {
    setResultDrafts((prev) => ({
      ...prev,
      [bookingId]: {
        ...(prev[bookingId] || {}),
        [key]: value
      }
    }));
  };

  // Check whether within edit window is true.
  const isWithinEditWindow = (booking) => {
    const startMs = booking?.startTime ? new Date(booking.startTime).getTime() : null;
    if (!startMs || Number.isNaN(startMs)) return false;
    return Date.now() - startMs <= RESULT_EDIT_WINDOW_MS;
  };

  // Support request admin change for this page.
  const requestAdminChange = async (booking) => {
    try {
      setSavingId(booking.id);
      setError(null);
      setSuccessMessage(null);

      const usersRes = await userService.getAllUsers();
      const allUsers = Array.isArray(usersRes?.data) ? usersRes.data : [];
      const admins = allUsers.filter((u) => u?.role === 'admin' && u?.id);

      if (admins.length === 0) {
        setError(t('owner_matches_no_admin', 'No admin account found to receive this request.'));
        return;
      }

      const homeTeamName = booking?.team?.name || t('owner_matches_home_team', 'Home Team');
      const awayTeamName = booking?.opponentTeam?.name || t('owner_matches_away_team', 'Away Team');
      const when = booking?.startTime ? new Date(booking.startTime).toLocaleString() : t('owner_matches_unknown_date', 'Unknown date');

      await Promise.all(
        admins.map((admin) =>
          notificationService.create({
            userId: admin.id,
            type: 'system',
            title: t('owner_matches_change_request_title', 'Match result change request'),
            message: t('owner_matches_change_request_message', 'Owner requested admin review to change result for {{home}} vs {{away}} ({{when}}).', {
              home: homeTeamName,
              away: awayTeamName,
              when
            }),
            metadata: {
              event: 'match_result_change_request',
              bookingId: booking.id,
              requesterId: user?.id,
              teamA: homeTeamName,
              teamB: awayTeamName,
              startTime: booking?.startTime || null
            }
          })
        )
      );

      setSuccessMessage(t('owner_matches_change_request_sent', 'Request sent to admin. They will review this match result change.'));
    } catch (err) {
      setError(err?.error || t('owner_matches_change_request_failed', 'Failed to send admin change request'));
    } finally {
      setSavingId(null);
    }
  };

  // Support save result for this page.
  const saveResult = async (booking) => {
    if (booking.status !== 'completed') {
      setError(t('owner_matches_result_after_completed', 'Result can only be entered after the match is completed.'));
      return;
    }
    if (!isWithinEditWindow(booking)) {
      setError(t('owner_matches_edit_locked', 'Result editing is locked after 24 hours. Please request admin to change it.'));
      return;
    }

    const draft = resultDrafts[booking.id] || getInitialDraft(booking);
    const homeRaw = String(draft.homeScore ?? '').trim();
    const awayRaw = String(draft.awayScore ?? '').trim();

    if (homeRaw === '' || awayRaw === '') {
      setError(t('owner_matches_enter_scores', 'Please enter both team scores.'));
      return;
    }

    const homeScore = Number(homeRaw);
    const awayScore = Number(awayRaw);
    if (!Number.isInteger(homeScore) || homeScore < 0 || !Number.isInteger(awayScore) || awayScore < 0) {
      setError(t('owner_matches_scores_valid', 'Scores must be non-negative whole numbers.'));
      return;
    }

    try {
      setSavingId(booking.id);
      setError(null);
      setSuccessMessage(null);

      if (booking?.matchResult?.id) {
        await bookingService.updateMatchResult(booking.matchResult.id, {
          bookingId: booking.id,
          homeScore,
          awayScore,
          mvpPlayerId: draft?.mvpPlayerId ? Number(draft.mvpPlayerId) : null,
          matchNotes: draft.matchNotes || null
        });
      } else {
        await bookingService.createMatchResult({
          bookingId: booking.id,
          homeScore,
          awayScore,
          mvpPlayerId: draft?.mvpPlayerId ? Number(draft.mvpPlayerId) : null,
          matchNotes: draft.matchNotes || null
        });
      }

      await refresh();
      setActiveCardId(null);
    } catch (err) {
      setError(err?.error || t('owner_matches_save_result_failed', 'Failed to save result'));
    } finally {
      setSavingId(null);
    }
  };

  const saveMvp = async (booking) => {
    if (booking.status !== 'completed') {
      setError(t('owner_matches_mvp_after_completed', 'MVP can only be selected after the match is completed.'));
      return;
    }

    const draft = resultDrafts[booking.id] || getInitialDraft(booking);
    const selectedMvpId = draft?.mvpPlayerId ? Number(draft.mvpPlayerId) : null;

    if (!booking?.matchResult?.id) {
      setError(t('owner_matches_save_result_first', 'Please save the match result before selecting MVP.'));
      return;
    }

    if (!selectedMvpId) {
      setError(t('owner_matches_choose_mvp', 'Please choose one player to set as MVP.'));
      return;
    }

    try {
      setSavingId(booking.id);
      setError(null);
      setSuccessMessage(null);

      await bookingService.updateMatchResult(booking.matchResult.id, {
        mvpPlayerId: selectedMvpId
      });

      await refresh();
      setSuccessMessage(t('owner_matches_mvp_saved', 'MVP saved successfully.'));
    } catch (err) {
      setError(err?.error || t('owner_matches_save_mvp_failed', 'Failed to save MVP'));
    } finally {
      setSavingId(null);
    }
  };

  // Support mark match completed for this page.
  const markMatchCompleted = async (bookingId) => {
    try {
      setSavingId(bookingId);
      setError(null);
      await bookingService.completeBooking(bookingId);
      await refresh();
    } catch (err) {
      setError(err?.error || t('owner_matches_mark_completed_failed', 'Failed to mark match as completed'));
    } finally {
      setSavingId(null);
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
          <h1 className="text-2xl font-bold text-gray-900">{t('nav_matches', 'Matches')}</h1>
          <p className="mt-1 text-sm text-gray-600">{t('owner_matches_subtitle', 'Confirmed team-vs-team matches. Open any card to update result.')}</p>
        </div>
        <Button as={Link} to="/owner/bookings" variant="outline" size="sm">
          <BuildingOfficeIcon className="h-4 w-4" />
          {t('nav_booking_requests', 'Booking requests')}
        </Button>
      </div>

      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md text-sm">{successMessage}</div>
      )}
      {error && <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md text-sm">{error}</div>}

      <Card>
        <CardHeader className="px-6 py-4 flex items-center justify-between">
          <div className="text-sm font-semibold text-gray-900">{t('owner_matches_cards', 'Match Cards')}</div>
          <Badge tone="blue">{t('owner_matches_count', '{{count}} matches', { count: matches.length })}</Badge>
        </CardHeader>

        <div className="border-t border-gray-200">
          {matches.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={TrophyIcon}
                title={t('owner_matches_empty_title', 'No matches yet')}
                description={t('owner_matches_empty_description', 'Matches appear here after bookings are confirmed with both teams.')}
              />
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {visibleMatches.map((m) => {
                const isOpen = activeCardId === m.id;
                const draft = resultDrafts[m.id] || getInitialDraft(m);
                const hasResult = !!m.matchResult?.id;
                const canEditWindow = isWithinEditWindow(m);
                const canInputResult = m.status === 'completed' && canEditWindow;
                const canOpenCard = m.status === 'completed';
                const canSetMvp = m.status === 'completed' && hasResult;
                const homeTeamName = m.team?.name || t('owner_matches_home_team', 'Home Team');
                const awayTeamName = m.opponentTeam?.name || t('owner_matches_away_team', 'Away Team');
                const homeTeamLogo = teamLogosById[m.team?.id] ?? resolveTeamLogoUrl(m.team);
                const awayTeamLogo = teamLogosById[m.opponentTeam?.id] ?? resolveTeamLogoUrl(m.opponentTeam);
                const isSaving = savingId === m.id;
                const eligiblePlayers = eligiblePlayersByBooking[m.id] || [];
                const mvpDisplayName =
                  m?.matchResult?.mvpPlayer
                    ? `${m.matchResult.mvpPlayer.firstName || ''} ${m.matchResult.mvpPlayer.lastName || ''}`.trim() ||
                      m.matchResult.mvpPlayer.username ||
                      t('common_unknown', 'Unknown')
                    : eligiblePlayers.find((player) => Number(player.id) === Number(m?.matchResult?.mvpPlayerId))
                    ? (() => {
                        const player = eligiblePlayers.find((p) => Number(p.id) === Number(m?.matchResult?.mvpPlayerId));
                        return `${player.firstName || ''} ${player.lastName || ''}`.trim() || player.username || t('common_unknown', 'Unknown');
                      })()
                    : null;

                return (
                  <div key={m.id} className="p-4">
                    <button
                      type="button"
                      onClick={() => canOpenCard && handleCardClick(m)}
                      className={`w-full text-left rounded-xl border border-gray-200 bg-white px-4 py-4 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${
                        canOpenCard ? 'hover:border-blue-200 hover:shadow-md cursor-pointer' : 'opacity-90 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="inline-flex items-center gap-2">
                          <Badge tone={statusTone(m.status)} className="capitalize">
                            {t(statusTranslationKey(m.status) || m.status, m.status)}
                          </Badge>
                          {hasResult && (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                              {t('owner_matches_final', 'Final')}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-600 inline-flex items-center gap-1">
                          <CalendarIcon className="h-4 w-4 text-gray-400" />
                          {m?.startTime ? new Date(m.startTime).toLocaleString() : '-'}
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:gap-6">
                        <div className="text-center">
                          <TeamAvatar teamName={homeTeamName} logoUrl={homeTeamLogo} />
                          <div className="text-sm sm:text-base font-semibold text-gray-900 break-words">{homeTeamName}</div>
                        </div>
                        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-center min-w-[90px] sm:min-w-[106px]">
                          <div className="text-xl sm:text-2xl font-bold text-gray-900 leading-none">
                            {hasResult ? `${m.matchResult.homeScore} : ${m.matchResult.awayScore}` : '- : -'}
                          </div>
                        </div>
                        <div className="text-center">
                          <TeamAvatar teamName={awayTeamName} logoUrl={awayTeamLogo} />
                          <div className="text-sm sm:text-base font-semibold text-gray-900 break-words">{awayTeamName}</div>
                        </div>
                      </div>

                      <div className="mt-4 text-xs text-gray-500 truncate">{m.field?.name || t('field_name', 'Field')}</div>
                      {hasResult && mvpDisplayName && (
                        <div className="mt-1 text-xs font-medium text-amber-700">{t('owner_matches_mvp_label', 'MVP: {{name}}', { name: mvpDisplayName })}</div>
                      )}
                      {!canInputResult && (
                        <div className="mt-2 text-xs text-amber-700">
                          {m.status !== 'completed'
                            ? t('owner_matches_input_locked', 'Input is locked until this match is marked completed.')
                            : hasResult
                            ? t('owner_matches_score_locked_mvp_available', 'Result editing is locked after 24 hours, but MVP can still be managed below.')
                            : t('owner_matches_save_result_then_mvp', 'Save the match result first, then set MVP.')}
                        </div>
                      )}
                    </button>

                    {m.status === 'confirmed' && (
                      <div className="mt-3 flex items-center justify-end">
                        <Button size="sm" disabled={isSaving} onClick={() => markMatchCompleted(m.id)}>
                          <CheckCircleIcon className="h-4 w-4" />
                          {t('owner_matches_confirm_completed', 'Confirm Match Completed')}
                        </Button>
                      </div>
                    )}
                    {m.status === 'completed' && !canEditWindow && (
                      <div className="mt-3 flex items-center justify-end">
                        <Button size="sm" variant="outline" disabled={isSaving} onClick={() => requestAdminChange(m)}>
                          {t('owner_matches_request_admin_change', 'Request Admin Change')}
                        </Button>
                      </div>
                    )}

                    {isOpen && (
                      <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-3 space-y-3">
                        <div className="text-xs font-semibold text-blue-900">{t('owner_matches_result_form', 'Result Form')}</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-700">{t('owner_matches_team_score', '{{team}} score', { team: homeTeamName })}</label>
                            <input
                              type="number"
                              min="0"
                              value={draft.homeScore}
                              onChange={(e) => updateDraft(m.id, 'homeScore', e.target.value)}
                              className="mt-1 block w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                              disabled={!canInputResult}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700">{t('owner_matches_team_score', '{{team}} score', { team: awayTeamName })}</label>
                            <input
                              type="number"
                              min="0"
                              value={draft.awayScore}
                              onChange={(e) => updateDraft(m.id, 'awayScore', e.target.value)}
                              className="mt-1 block w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                              disabled={!canInputResult}
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700">{t('owner_matches_notes_optional', 'Match notes (optional)')}</label>
                          <textarea
                            rows={2}
                            value={draft.matchNotes}
                            onChange={(e) => updateDraft(m.id, 'matchNotes', e.target.value)}
                            className="mt-1 block w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                            disabled={!canInputResult}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700">{t('owner_matches_mvp_player', 'MVP Player')}</label>
                          <select
                            value={draft.mvpPlayerId ?? ''}
                            onChange={(e) => updateDraft(m.id, 'mvpPlayerId', e.target.value)}
                            className="mt-1 block w-full px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                            disabled={eligiblePlayersLoadingMap[m.id] || !canSetMvp}
                          >
                            <option value="">{hasResult ? t('owner_matches_select_one_player', 'Select one player') : t('owner_matches_save_result_first_short', 'Save result first')}</option>
                            {eligiblePlayers.map((player) => {
                              const fullName = `${player.firstName || ''} ${player.lastName || ''}`.trim();
                              const label = fullName || player.username || `Player #${player.id}`;
                              return (
                                <option key={player.id} value={player.id}>
                                  {t('owner_matches_player_team', '{{label}} ({{team}})', { label, team: player.teamName })}
                                </option>
                              );
                            })}
                          </select>
                          {eligiblePlayersLoadingMap[m.id] && (
                            <div className="mt-1 text-xs text-gray-500">{t('owner_matches_loading_players', 'Loading eligible players...')}</div>
                          )}
                          {!eligiblePlayersLoadingMap[m.id] && eligiblePlayers.length === 0 && (
                            <div className="mt-1 text-xs text-amber-700">{t('owner_matches_no_players', 'No eligible players found for MVP selection.')}</div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" disabled={isSaving || !canInputResult} onClick={() => saveResult(m)}>
                            {isSaving ? t('common_saving', 'Saving...') : hasResult ? t('owner_matches_update_result', 'Update Result') : t('owner_matches_save_result', 'Save Result')}
                          </Button>
                          <Button size="sm" variant="outline" disabled={isSaving || !canSetMvp} onClick={() => saveMvp(m)}>
                            {isSaving ? t('common_saving', 'Saving...') : m?.matchResult?.mvpPlayerId ? t('owner_matches_update_mvp', 'Update MVP') : t('owner_matches_set_mvp', 'Set MVP')}
                          </Button>
                          <Button size="sm" variant="outline" disabled={isSaving} onClick={() => setActiveCardId(null)}>
                            {t('action_cancel', 'Cancel')}
                          </Button>
                          {!canInputResult && canSetMvp && (
                            <span className="text-xs text-gray-600 inline-flex items-center gap-1">
                              <CheckCircleIcon className="h-4 w-4" />
                              {t('owner_matches_score_locked_mvp_available', 'Result editing is locked after 24 hours, but MVP can still be managed below.')}
                            </span>
                          )}
                          {m.status === 'confirmed' && (
                            <span className="text-xs text-gray-600 inline-flex items-center gap-1">
                              <CheckCircleIcon className="h-4 w-4" />
                              {t('owner_matches_mark_completed_first', 'Mark booking as completed first.')}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {matches.length > 0 && (
          <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between gap-3">
            <div className="text-xs text-gray-500">
              {t('owner_matches_showing', 'Showing {{visible}} of {{total}} matches', { visible: Math.min(visibleCount, matches.length), total: matches.length })}
            </div>
            {canShowMore && (
              <Button variant="outline" size="sm" onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}>
                {t('fields_load_more', 'Show more')}
              </Button>
            )}
          </div>
        )}

        <CardBody className="px-6 py-4 text-xs text-gray-500">
          {t('owner_matches_tip', 'Click any match card to open the result form.')}
        </CardBody>
      </Card>
    </div>
  );
};

export default OwnerMatchesPage;
