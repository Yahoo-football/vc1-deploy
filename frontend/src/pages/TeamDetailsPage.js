import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../context/RealtimeContext';
import { useLanguage } from '../context/LanguageContext';
import teamService from '../services/teamService';
import ratingService from '../services/ratingService';
import MemberDetailsModal from '../components/ui/MemberDetailsModal';
import {
  UsersIcon,
  MapPinIcon,
  ShieldCheckIcon,
  CheckIcon,
  XMarkIcon,
  PhotoIcon,
  ArrowUpTrayIcon,
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  ClockIcon,
  TrophyIcon,
  FlagIcon,
  HandThumbUpIcon,
  UserGroupIcon,
  StarIcon,
  ArrowTopRightOnSquareIcon,
} 
from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import { ImagePreviewModal, useToast } from '../components/ui';
import { getTeamJerseyColors } from '../utils/teamColors';
import { compressImageForUpload } from '../utils/imageCompression';
import { buildGoogleMapsLocationUrl, buildLocationLabel } from '../utils/googleMaps';

const MAX_TEAM_LOGO_SIZE_MB = 5;
const MAX_TEAM_LOGO_SIZE_BYTES = MAX_TEAM_LOGO_SIZE_MB * 1024 * 1024;
const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';
const API_ORIGIN =
  typeof window !== 'undefined' && API_BASE_URL.startsWith('/')
    ? window.location.origin
    : API_BASE_URL.replace(/\/api\/?$/, '');
const DEFAULT_PROFILE_PATH = '/uploads/profile/default_profile.jpg';

const resolveTeamLogoUrl = (rawLogo) => {
  if (!rawLogo) return null;
  if (/^https?:\/\//i.test(rawLogo) || /^data:image\//i.test(rawLogo)) return rawLogo;
  const normalized = String(rawLogo).startsWith('/') ? rawLogo : `/${rawLogo}`;
  return `${API_ORIGIN}${normalized}`;
};

const TeamMatchLogo = ({ teamName, logoUrl }) => {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = !!logoUrl && !imageFailed;

  useEffect(() => {
    setImageFailed(false);
  }, [logoUrl]);

  return (
    <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-gray-200 bg-white shadow-sm">
      {showImage ? (
        <img
          src={logoUrl}
          alt={`${teamName} logo`}
          className="h-full w-full object-contain p-1"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gray-50 text-gray-400">
          <PhotoIcon className="h-5 w-5" />
        </div>
      )}
    </div>
  );
};

const formatCaptainName = (captain) => {
  if (!captain) return 'Unknown captain';
  const fullName = `${captain.firstName || ''} ${captain.lastName || ''}`.trim();
  return fullName || captain.username || 'Unknown captain';
};

const MatchDetailsModal = ({
  match,
  teamName,
  teamCaptainName,
  opponentCaptainName,
  teamLogoUrl,
  opponentLogoUrl,
  teamHref,
  opponentTeamHref,
  fieldLabel,
  matchDate,
  matchSummary,
  onOpenCaptain,
  onOpenOpponentCaptain,
  onClose
}) => {
  if (!match) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.28)] sm:max-h-[calc(100vh-3rem)]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="match-details-title"
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700 ring-1 ring-emerald-200">
              Match Details
            </span>
            <h3 id="match-details-title" className="mt-3 text-2xl font-bold tracking-tight text-slate-900">
              {teamName} vs {match?.opponentTeamName || 'Opponent'}
            </h3>
            <p className="mt-1 text-sm text-slate-500">{matchSummary}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close match details"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4 sm:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  {teamHref ? (
                    <Link to={teamHref} onClick={(event) => event.stopPropagation()} className="shrink-0">
                      <TeamMatchLogo teamName={teamName} logoUrl={teamLogoUrl} />
                    </Link>
                  ) : (
                    <TeamMatchLogo teamName={teamName} logoUrl={teamLogoUrl} />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Team</p>
                    {teamHref ? (
                      <Link
                        to={teamHref}
                        onClick={(event) => event.stopPropagation()}
                        className="truncate text-base font-semibold text-slate-900 underline-offset-4 hover:text-emerald-700 hover:underline"
                      >
                        {teamName}
                      </Link>
                    ) : (
                      <p className="truncate text-base font-semibold text-slate-900">{teamName}</p>
                    )}
                    <button
                      type="button"
                      onClick={() => onOpenCaptain?.()}
                      className="mt-1 truncate text-left text-xs text-emerald-700 underline-offset-4 hover:text-emerald-800 hover:underline"
                    >
                      Captain: {teamCaptainName}
                    </button>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Score</div>
                  <div className="mt-1.5 text-2xl font-bold text-slate-900">{match?.finalScore || 'Pending'}</div>
                </div>
                <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
                  <div className="min-w-0 text-right">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Opponent</p>
                    {opponentTeamHref ? (
                      <Link
                        to={opponentTeamHref}
                        onClick={(event) => event.stopPropagation()}
                        className="truncate text-base font-semibold text-slate-900 underline-offset-4 hover:text-emerald-700 hover:underline"
                      >
                        {match?.opponentTeamName || 'Opponent'}
                      </Link>
                    ) : (
                      <p className="truncate text-base font-semibold text-slate-900">{match?.opponentTeamName || 'Opponent'}</p>
                    )}
                    <button
                      type="button"
                      onClick={() => onOpenOpponentCaptain?.()}
                      className="mt-1 truncate text-right text-xs text-emerald-700 underline-offset-4 hover:text-emerald-800 hover:underline"
                    >
                      Captain: {opponentCaptainName}
                    </button>
                  </div>
                  {opponentTeamHref ? (
                    <Link to={opponentTeamHref} onClick={(event) => event.stopPropagation()} className="shrink-0">
                      <TeamMatchLogo teamName={match?.opponentTeamName || 'Opponent'} logoUrl={opponentLogoUrl} />
                    </Link>
                  ) : (
                    <TeamMatchLogo teamName={match?.opponentTeamName || 'Opponent'} logoUrl={opponentLogoUrl} />
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Date</p>
              <p className="mt-2 text-sm font-semibold text-slate-800">{matchDate}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Result</p>
              <p className="mt-2 text-sm font-semibold text-slate-800">{match?.result || 'Pending'}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Field</p>
              <div className="mt-2 text-sm font-semibold text-slate-800">
                {match?.fieldId ? (
                  <Link
                    to={`/fields/${match.fieldId}`}
                    onClick={(event) => event.stopPropagation()}
                    className="text-emerald-700 underline-offset-4 hover:text-emerald-800 hover:underline"
                  >
                    {fieldLabel}
                  </Link>
                ) : (
                  fieldLabel
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Summary</p>
              <p className="mt-2 text-sm text-slate-700">{matchSummary}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Booking ID</p>
              <p className="mt-2 text-sm text-slate-700">{match?.bookingId || 'Not linked'}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Match ID</p>
              <p className="mt-2 text-sm text-slate-700">{match?.id || 'Not available'}</p>
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
  );
};

const TeamDetailsPage = () => {
  const { id } = useParams();
  const { user, isAdmin } = useAuth();
  const { version } = useRealtime();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const basePath = location.pathname.startsWith('/owner') ? '/owner' : '/app';
  const { showToast } = useToast();
  const { t } = useLanguage();

  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [pageError, setPageError] = useState(null);
  const [logoCandidateIndex, setLogoCandidateIndex] = useState(0);
  const [pendingLogoPreview, setPendingLogoPreview] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);
  const [matchHistory, setMatchHistory] = useState({ stats: { total: 0, wins: 0, losses: 0, draws: 0 }, matches: [] });
  const [matchHistoryLoading, setMatchHistoryLoading] = useState(false);
  const [matchHistoryError, setMatchHistoryError] = useState(null);
  const [ratingModalMatch, setRatingModalMatch] = useState(null);
  const [viewRatingMatch, setViewRatingMatch] = useState(null);
  const [ratingForm, setRatingForm] = useState({
    rating: 0,
    review: '',
    categories: {
      skillLevel: 0,
      sportsmanship: 0,
      punctuality: 0,
      teamOrganization: 0
    }
  });
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [ratingValidationVisible, setRatingValidationVisible] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState('all');
  const activeTab = searchParams.get('tab') === 'history' ? 'history' : searchParams.get('tab') === 'members' ? 'members' : 'overview';
  const isAdminUser = isAdmin();
  const [selectedMatch, setSelectedMatch] = useState(null);

  const isCaptainOfTeam = useMemo(() => {
    if (!team || !user) return false;
    return team.captainId === user.id;
  }, [team, user]);

  const setTab = useCallback(
    (tab) => {
      const next = new URLSearchParams(searchParams);
      if (tab === 'overview') {
        next.delete('tab');
      } else {
        next.set('tab', tab);
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const membership = useMemo(() => {
    if (!team || !user) return null;
    const members = Array.isArray(team.teamMembers) ? team.teamMembers : [];
    return members.find((m) => m.userId === user.id) || null;
  }, [team, user]);

  const isInvited = useMemo(() => {
    return membership && membership.status === 'pending' && membership.isActive === false;
  }, [membership]);

  const rawTeamLogo = useMemo(() => {
    const rawLogo = team?.logoUrl || team?.logo_url || team?.logo;
    if (!rawLogo) return null;
    if (/^https?:\/\//i.test(rawLogo)) return rawLogo;
    return rawLogo.startsWith('/') ? rawLogo : `/${rawLogo}`;
  }, [team]);

  const logoCandidates = useMemo(() => {
    if (!rawTeamLogo) return [];
    if (/^https?:\/\//i.test(rawTeamLogo)) return [rawTeamLogo];

    const browserOrigin = typeof window !== 'undefined' ? window.location.origin : API_ORIGIN;

    return Array.from(
      new Set([
        `${API_ORIGIN}${rawTeamLogo}`,
        `${browserOrigin}${rawTeamLogo}`
      ])
    );
  }, [rawTeamLogo]);

  const teamLogoUrl = pendingLogoPreview || logoCandidates[logoCandidateIndex] || null;

  useEffect(() => {
    return () => {
      if (pendingLogoPreview) {
        URL.revokeObjectURL(pendingLogoPreview);
      }
    };
  }, [pendingLogoPreview]);

  useEffect(() => {
    setLogoCandidateIndex(0);
  }, [rawTeamLogo]);

  const refreshTeam = useCallback(async () => {
    const response = await teamService.getTeamById(id);
    const teamData = response.data || null;
    if (!teamData) {
      setTeam(null);
      return;
    }

    setTeam((prev) => ({
      ...teamData,
      // Preserve known logo when API payload does not include it consistently.
      logoUrl: teamData.logoUrl || teamData.logo_url || teamData.logo || prev?.logoUrl || prev?.logo_url || prev?.logo || null
    }));
  }, [id]);

  useEffect(() => {
    const fetchTeam = async () => {
      try {
        setLoading(true);
        setPageError(null);
        const teamResponse = await teamService.getTeamById(id);

        const teamData = teamResponse.data || null;
        if (!teamData) {
          setTeam(null);
        } else {
          setTeam((prev) => ({
            ...teamData,
            logoUrl: teamData.logoUrl || teamData.logo_url || teamData.logo || prev?.logoUrl || prev?.logo_url || prev?.logo || null
          }));
        }
      } catch (err) {
        console.error('Failed to fetch team:', err);
        setPageError('Failed to load team');
      } finally {
        setLoading(false);
      }
    };

    fetchTeam();
  }, [id, refreshTeam, version]);

  useEffect(() => {
    if (!team) return;

    let cancelled = false;

    const fetchMatchHistory = async () => {
      try {
        setMatchHistoryLoading(true);
        setMatchHistoryError(null);

        const historyResponse = await teamService.getTeamMatchHistory(id, { limit: 50, status: 'completed' });

        if (cancelled) return;

        const historyData = historyResponse?.data || {};
        setMatchHistory({
          stats: historyData?.stats || { total: 0, wins: 0, losses: 0, draws: 0 },
          matches: Array.isArray(historyData?.matches) ? historyData.matches : []
        });
      } catch (err) {
        if (!cancelled) {
          setMatchHistoryError(err?.error || 'Failed to load match history');
        }
      } finally {
        if (!cancelled) {
          setMatchHistoryLoading(false);
        }
      }
    };

    fetchMatchHistory();

    return () => {
      cancelled = true;
    };
  }, [id, team, version]);

  const handleJoin = async () => {
    try {
      setActionLoading(true);
      setPageError(null);
      const response = await teamService.joinTeam(id);
      if (response.success) {
        showToast('Join request submitted!', { type: 'success', duration: 3200 });
        await refreshTeam();
      }
    } catch (err) {
      showToast(err?.error || 'Failed to submit join request', { type: 'error', duration: 3600 });
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeave = async () => {
    try {
      setActionLoading(true);
      setPageError(null);
      const response = await teamService.leaveTeam(id);
      if (response.success) {
        showToast(response.message || 'Leave request sent to captain for approval.', { type: 'success', duration: 3200 });
        await refreshTeam();
      }
    } catch (err) {
      showToast(err?.error || 'Failed to submit leave request', { type: 'error', duration: 3600 });
    } finally {
      setActionLoading(false);
    }
  };

  const handleAccept = async () => {
    try {
      setActionLoading(true);
      const response = await teamService.acceptInvite(id);
      if (response.success) {
        showToast('You have joined the team', { type: 'success', duration: 3200 });
        await refreshTeam();
      }
    } catch (err) {
      showToast(err?.error || 'Failed to accept invitation', { type: 'error', duration: 3600 });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDecline = async () => {
    try {
      setActionLoading(true);
      const response = await teamService.declineInvite(id);
      if (response.success) {
        showToast('Invitation declined', { type: 'success', duration: 3200 });
        await refreshTeam();
      }
    } catch (err) {
      showToast(err?.error || 'Failed to decline invitation', { type: 'error', duration: 3600 });
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file size
    if (file.size > MAX_TEAM_LOGO_SIZE_BYTES) {
      showToast(`Logo file size must be less than ${MAX_TEAM_LOGO_SIZE_MB}MB`, { type: 'error', duration: 3600 });
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file', { type: 'error', duration: 3600 });
      return;
    }

    try {
      setActionLoading(true);
      setPageError(null);

      const compressedFile = await compressImageForUpload(file, {
        maxWidth: 900,
        maxHeight: 900,
        targetMaxBytes: 450 * 1024,
        minCompressBytes: 150 * 1024
      });

      if (pendingLogoPreview) {
        URL.revokeObjectURL(pendingLogoPreview);
      }
      setPendingLogoPreview(URL.createObjectURL(compressedFile));
      
      const formData = new FormData();
      formData.append('logo', compressedFile);

      const response = await teamService.uploadTeamLogo(id, formData);
      if (response.success) {
        const uploadedLogoUrl = response.data?.logoUrl || response.data?.logo_url || response.data?.logo || null;
        if (uploadedLogoUrl) {
          setTeam((prev) => (prev ? { ...prev, logoUrl: uploadedLogoUrl } : prev));
        }
        setPendingLogoPreview(null);
        showToast('Team logo updated successfully!', { type: 'success', duration: 3200 });
        await refreshTeam();
      }
    } catch (err) {
      showToast(err?.error || 'Failed to upload logo', { type: 'error', duration: 3600 });
    } finally {
      setActionLoading(false);
      // Clear the file input
      e.target.value = '';
    }
  };

  const activeMembers = Array.isArray(team?.teamMembers)
    ? team.teamMembers.filter((m) => m.status === 'active' && m.isActive !== false)
    : [];
  const openMemberDetails = (member) => setSelectedMember(member);
  const closeMemberDetails = () => setSelectedMember(null);
  const captainName = team?.captain?.firstName || team?.captain?.username || 'Unknown';
  const createdDate = team?.createdAt ? new Date(team.createdAt).toLocaleDateString() : 'Unknown';
  const teamJerseyColors = getTeamJerseyColors(team);
  const teamHomeFieldAddress = buildLocationLabel(team?.homeField || {});
  const teamHomeFieldLocationUrl = buildGoogleMapsLocationUrl(team?.homeField || {});
  const history = matchHistory;
  const teamRecordCards = [
    {
      label: 'MP',
      value: history.stats?.total || 0,
      className: 'border-blue-100/80 bg-gradient-to-br from-white/90 via-blue-50/55 to-blue-100/60 shadow-blue-100/40 backdrop-blur-sm',
      labelClassName: 'text-blue-600',
      valueClassName: 'text-blue-950'
    },
    {
      label: 'W',
      value: history.stats?.wins || 0,
      className: 'border-emerald-100/80 bg-gradient-to-br from-white/90 via-emerald-50/55 to-emerald-100/60 shadow-emerald-100/40 backdrop-blur-sm',
      labelClassName: 'text-emerald-600',
      valueClassName: 'text-emerald-950'
    },
    {
      label: 'D',
      value: history.stats?.draws || 0,
      className: 'border-amber-100/80 bg-gradient-to-br from-white/90 via-amber-50/55 to-amber-100/60 shadow-amber-100/40 backdrop-blur-sm',
      labelClassName: 'text-amber-600',
      valueClassName: 'text-amber-950'
    },
    {
      label: 'L',
      value: history.stats?.losses || 0,
      className: 'border-rose-100/80 bg-gradient-to-br from-white/90 via-rose-50/55 to-rose-100/60 shadow-rose-100/40 backdrop-blur-sm',
      labelClassName: 'text-rose-600',
      valueClassName: 'text-red-950'
    }
  ];
  const recentMatches = Array.isArray(history.matches) ? history.matches.slice(0, 5) : [];
  const teamOverviewDetails = [
    { label: t('team_details_name', 'Team Name'), value: team?.name || t('team_details_unnamed', 'Unnamed team') },
    { label: t('team_details_captain', 'Captain'), value: captainName },
    { label: t('team_details_active_members', 'Active Members'), value: `${activeMembers.length}/${team?.maxPlayers || 0}` },
    { label: t('team_details_skill_level', 'Skill Level'), value: team?.skillLevel ? t(`teams_skill_${team.skillLevel}`, team.skillLevel) : t('team_details_not_set', 'Not set') },
    {
      label: t('team_details_home_field', 'Home Field'),
      value: team?.homeField?.name || t('profile_no_home_field', 'No home field assigned'),
      renderValue: team?.homeField ? (
        <div className="mt-2 space-y-2">
          <p className="text-sm font-semibold text-gray-800">{team.homeField?.name}</p>
          {teamHomeFieldAddress && <p className="text-xs leading-5 text-gray-500">{teamHomeFieldAddress}</p>}
          {teamHomeFieldLocationUrl && (
            <a
              href={teamHomeFieldLocationUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
            >
              <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
              {t('team_details_location', 'Location')}
            </a>
          )}
        </div>
      ) : null
    },
    { label: t('team_details_jersey_colors', 'Jersey Colors'), value: `${teamJerseyColors.length} ${t('team_details_colors_selected', 'colors selected')}` },
    { label: t('common_created', 'Created'), value: createdDate },
    { label: t('team_details_max_players', 'Max Players'), value: team?.maxPlayers || 0 },
    { label: t('team_details_status', 'Team Status'), value: team?.status ? team.status.charAt(0).toUpperCase() + team.status.slice(1) : t('team_details_active', 'Active') },
    {
      label: t('teams_jersey', 'Jersey'),
      value: teamJerseyColors.length > 0 ? `${teamJerseyColors.length} ${t(teamJerseyColors.length === 1 ? 'team_details_color' : 'team_details_colors', teamJerseyColors.length === 1 ? 'color' : 'colors')}` : t('team_details_not_set', 'Not set'),
      renderValue:
        teamJerseyColors.length > 0 ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {teamJerseyColors.map((color, index) => (
              <span
                key={`${color}-${index}`}
                className="h-6 w-6 rounded-full border border-gray-300 shadow-sm"
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
        ) : null
      }
  ];

  const formatMatchDate = (match) => {
    const dateValue = match?.dateTime || match?.matchDate || match?.date;
    return dateValue ? new Date(dateValue).toLocaleDateString() : 'Date unavailable';
  };

  const formatMatchResult = (match) => {
    if (match?.result) {
      return match.result;
    }

    const ourScore = match?.teamScore ?? match?.homeScore ?? match?.scoreFor;
    const opponentScore = match?.opponentScore ?? match?.awayScore ?? match?.scoreAgainst;

    if (ourScore !== undefined && opponentScore !== undefined) {
      return `${ourScore} - ${opponentScore}`;
    }

    if (match?.score) {
      return match.score;
    }

    return 'Pending';
  };

  const formatMatchSummary = (match) => {
    if (match?.competitionName) {
      return match.competitionName;
    }

    if (match?.venueName) {
      return match.venueName;
    }

    if (match?.status) {
      return match.status;
    }

    return 'Team match';
  };

  const formatMatchFieldName = (match) => {
    return match?.fieldName || 'Field unavailable';
  };

  const getMatchTeamLogoUrl = (match) => {
    return resolveTeamLogoUrl(match?.teamLogoUrl || team?.logoUrl || team?.logo_url || team?.logo);
  };

  const getMatchOpponentLogoUrl = (match) => {
    return resolveTeamLogoUrl(match?.opponentTeamLogoUrl);
  };

  const currentTeamCaptainName = formatCaptainName(team?.captain);

  const openCaptainDetails = (captain) => {
    if (!captain) return;
    const captainMembership = activeMembers.find(
      (member) =>
        Number(member?.userId || member?.user?.id) === Number(captain?.id || captain?.userId || captain?.user?.id)
    );

    setSelectedMember({
      ...(captainMembership || {}),
      ...captain,
      user: captainMembership?.user || captain.user || null,
      role: captain.role || 'captain',
      status: captain.status || captainMembership?.status || 'active',
      joinedAt: captainMembership?.joinedAt || captain.joinedAt || captain.createdAt || null
    });
  };
  const resolveUserAvatarUrl = (memberUser) => {
    const rawAvatar = memberUser?.avatarUrl || memberUser?.avatar_url || null;
    const normalizedPath = rawAvatar
      ? rawAvatar.startsWith('/')
        ? rawAvatar
        : `/${rawAvatar}`
      : DEFAULT_PROFILE_PATH;

    if (/^https?:\/\//i.test(normalizedPath)) {
      return normalizedPath;
    }

    return `${API_ORIGIN}${normalizedPath}`;
  };

  const availableSeasons = useMemo(() => {
    const years = Array.from(
      new Set(
        (Array.isArray(matchHistory.matches) ? matchHistory.matches : [])
          .map((match) => {
            const date = match?.date ? new Date(match.date) : null;
            return Number.isNaN(date?.getTime?.()) ? null : String(date.getFullYear());
          })
          .filter(Boolean)
      )
    ).sort((a, b) => Number(b) - Number(a));

    return ['all', ...years];
  }, [matchHistory.matches]);

  const filteredMatches = useMemo(() => {
    const rows = Array.isArray(matchHistory.matches) ? matchHistory.matches : [];
    if (selectedSeason === 'all') {
      return rows;
    }

    return rows.filter((match) => {
      const date = match?.date ? new Date(match.date) : null;
      if (!date || Number.isNaN(date.getTime())) return false;
      return String(date.getFullYear()) === selectedSeason;
    });
  }, [matchHistory.matches, selectedSeason]);

  const filteredStats = useMemo(() => {
    return filteredMatches.reduce(
      (acc, match) => {
        acc.total += 1;
        if (match.result === 'Win') acc.wins += 1;
        else if (match.result === 'Loss') acc.losses += 1;
        else acc.draws += 1;
        return acc;
      },
      { total: 0, wins: 0, losses: 0, draws: 0 }
    );
  }, [filteredMatches]);

  const historyStatCards = [
    {
      key: 'total',
      label: 'Total Matches',
      value: filteredStats.total,
      icon: CalendarDaysIcon,
      iconClassName: 'bg-indigo-100 text-indigo-600',
      valueClassName: 'text-slate-900'
    },
    {
      key: 'wins',
      label: 'Wins',
      value: filteredStats.wins,
      icon: TrophyIcon,
      iconClassName: 'bg-emerald-100 text-emerald-600',
      valueClassName: 'text-emerald-600'
    },
    {
      key: 'losses',
      label: 'Losses',
      value: filteredStats.losses,
      icon: FlagIcon,
      iconClassName: 'bg-rose-100 text-rose-500',
      valueClassName: 'text-rose-500'
    },
    {
      key: 'draws',
      label: 'Draws',
      value: filteredStats.draws,
      icon: UsersIcon,
      iconClassName: 'bg-amber-100 text-amber-500',
      valueClassName: 'text-amber-700'
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="text-center py-12">
        <h1 className="text-xl font-semibold text-gray-900">Team not found</h1>
        <Link to={`${basePath}/teams`} className="mt-4 inline-block text-green-700 hover:text-green-800">
          Back to Teams
        </Link>
      </div>
    );
  }

  const getResultPillClasses = (result) => {
    if (result === 'Win') return 'bg-emerald-100 text-emerald-700';
    if (result === 'Loss') return 'bg-rose-100 text-rose-700';
    return 'bg-slate-100 text-slate-700';
  };

  const openRatingModal = (match) => {
    setRatingModalMatch(match);
    setRatingSubmitted(false);
    setRatingForm({
      rating: 0,
      review: '',
      categories: {
        skillLevel: 0,
        sportsmanship: 0,
        punctuality: 0,
        teamOrganization: 0
      }
    });
    setRatingValidationVisible(false);
    setPageError(null);
  };

  const closeRatingModal = (force = false) => {
    if (ratingSubmitting && !force) return;
    setRatingModalMatch(null);
    setRatingSubmitted(false);
    setRatingForm({
      rating: 0,
      review: '',
      categories: {
        skillLevel: 0,
        sportsmanship: 0,
        punctuality: 0,
        teamOrganization: 0
      }
    });
    setRatingValidationVisible(false);
  };

  const handleSubmitRating = async () => {
    if (!ratingModalMatch?.bookingId) return;
    const categoryValues = Object.values(ratingForm.categories || {});
    if (!ratingForm.rating || categoryValues.some((value) => !value)) {
      setRatingValidationVisible(true);
      return;
    }

    try {
      setRatingSubmitting(true);
      setRatingValidationVisible(false);
      setPageError(null);

      await ratingService.createOpponentRating({
        bookingId: ratingModalMatch.bookingId,
        rating: ratingForm.rating,
        review: ratingForm.review.trim(),
        sportsmanshipScore: ratingForm.categories.sportsmanship,
        skillLevelScore: ratingForm.categories.skillLevel,
        punctualityScore: ratingForm.categories.punctuality,
        teamOrganizationScore: ratingForm.categories.teamOrganization
      });

      setRatingSubmitted(true);
      showToast('Opponent rating submitted successfully.', { type: 'success', duration: 3200 });

      const historyResponse = await teamService.getTeamMatchHistory(id, { limit: 50, status: 'completed' });

      const historyData = historyResponse?.data || {};
      setMatchHistory({
        stats: historyData?.stats || { total: 0, wins: 0, losses: 0, draws: 0 },
        matches: Array.isArray(historyData?.matches) ? historyData.matches : []
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));
      closeRatingModal(true);
      setTab('history');
    } catch (err) {
      showToast(err?.error || 'Failed to submit rating', { type: 'error', duration: 3600 });
    } finally {
      setRatingSubmitting(false);
    }
  };

  const renderStars = (value, interactive = false, onSelect = null, options = {}) => (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!interactive}
          onClick={() => onSelect?.(star)}
          className={interactive ? `transition hover:scale-110 ${options.buttonClassName || ''}` : `cursor-default ${options.buttonClassName || ''}`}
        >
          {star <= value ? (
            <StarSolidIcon className={`${options.iconClassName || 'h-5 w-5'} ${options.activeClassName || 'text-amber-400'}`} />
          ) : (
            <StarIcon className={`${options.iconClassName || 'h-5 w-5'} ${options.inactiveClassName || 'text-slate-300'}`} />
          )}
        </button>
      ))}
    </div>
  );

  const ratingCategories = [
    { key: 'skillLevel', label: 'Skill Level', icon: TrophyIcon },
    { key: 'sportsmanship', label: 'Sportsmanship', icon: HandThumbUpIcon },
    { key: 'punctuality', label: 'Punctuality', icon: ClockIcon },
    { key: 'teamOrganization', label: 'Team Organization', icon: UserGroupIcon }
  ];
  
  return (
    <div className="space-y-6">
      {selectedMember && <MemberDetailsModal member={selectedMember} onClose={closeMemberDetails} />}
      {selectedMatch && (
        <MatchDetailsModal
          match={selectedMatch}
          teamName={selectedMatch?.teamName || team?.name || 'This Team'}
          teamCaptainName={currentTeamCaptainName || selectedMatch?.teamCaptainName || 'Unknown captain'}
          opponentCaptainName={selectedMatch?.opponentCaptainName || 'Unknown captain'}
          teamLogoUrl={getMatchTeamLogoUrl(selectedMatch)}
          opponentLogoUrl={getMatchOpponentLogoUrl(selectedMatch)}
          teamHref={team?.id ? `${basePath}/teams/${team.id}` : null}
          opponentTeamHref={selectedMatch?.opponentTeamId ? `${basePath}/teams/${selectedMatch.opponentTeamId}` : null}
          fieldLabel={formatMatchFieldName(selectedMatch)}
          matchDate={formatMatchDate(selectedMatch)}
          matchSummary={formatMatchSummary(selectedMatch)}
          onOpenCaptain={() => openCaptainDetails(selectedMatch?.teamCaptain || team?.captain)}
          onOpenOpponentCaptain={() => openCaptainDetails(selectedMatch?.opponentCaptain)}
          onClose={() => setSelectedMatch(null)}
        />
      )}
      {pageError && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md text-sm">
          {pageError}
        </div>
      )}

      <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.16),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.14),_transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] p-5 shadow-sm sm:p-6">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
          <div className="group rounded-[30px] border border-white/80 bg-white/90 p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">{t('team_details_identity', 'Team Identity')}</div>
                <h2 className="mt-2 text-2xl font-bold text-slate-950">{t('team_details_logo', 'Team Logo')}</h2>
              </div>
            </div>
            <div className="relative mx-auto mt-5 flex h-[280px] w-[280px] max-w-full items-center justify-center overflow-hidden rounded-[34px] border border-slate-200 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.98),rgba(240,249,255,0.9)_55%,rgba(236,253,245,0.92))] shadow-inner transition duration-200 group-hover:scale-[1.02]">
              {teamLogoUrl ? (
                <img
                  src={teamLogoUrl}
                  alt={`${team.name} logo`}
                  className="h-full w-full object-contain p-4 transition duration-300 group-hover:scale-105"
                  onError={() => {
                    setLogoCandidateIndex((prev) => prev + 1);
                  }}
                />
              ) : (
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-[28px] bg-white shadow-sm ring-1 ring-slate-200 transition duration-200 group-hover:scale-105 group-hover:ring-emerald-200">
                    <PhotoIcon className="h-12 w-12 text-slate-400 transition duration-200 group-hover:text-emerald-500" />
                  </div>
                  <p className="text-base font-medium text-slate-500">{t('team_details_no_logo', 'No logo')}</p>
                </div>
              )}

              {isCaptainOfTeam && (
                <button
                  type="button"
                  onClick={() => document.getElementById('logo-upload').click()}
                  disabled={actionLoading}
                  className="absolute bottom-4 right-4 inline-flex h-14 w-14 items-center justify-center rounded-full border-4 border-white bg-emerald-500 text-white shadow-lg shadow-emerald-200 transition duration-200 hover:scale-110 hover:bg-emerald-600 hover:shadow-xl hover:shadow-emerald-200 disabled:opacity-50"
                >
                  <ArrowUpTrayIcon className="h-7 w-7" />
                </button>
              )}
            </div>

            <input
              id="logo-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoUpload}
            />
          </div>

          <div className="rounded-[30px] border border-white/80 bg-white/80 p-5 shadow-sm">
          <div className="space-y-5">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">{t('team_details_name', 'Team Name')}</div>
                <h1 className="mt-1 break-words text-4xl font-black tracking-tight text-slate-950">{team.name || t('team_details_unnamed', 'Unnamed team')}</h1>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">{t('team_details_jersey_colors', 'Jersey Colors')}</div>
                  <div className="inline-flex items-center gap-2">
                    {teamJerseyColors.length > 0 ? (
                      teamJerseyColors.map((color, index) => (
                        <span
                          key={`${color}-${index}`}
                          className="h-4 w-4 rounded-full border border-white shadow-sm ring-1 ring-slate-200 transition duration-200 hover:scale-125 hover:ring-slate-300"
                          style={{ backgroundColor: color }}
                        />
                      ))
                    ) : (
                      <span className="text-sm font-medium text-slate-500">{t('team_details_no_colors', 'No colors selected')}</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:min-w-[376px]">
                {teamRecordCards.map((item) => (
                  <div
                    key={item.label}
                    className={`rounded-[24px] border px-4 py-3 text-center shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg ${item.className}`}
                  >
                    <div className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${item.labelClassName}`}>{item.label}</div>
                    <div className={`mt-2 text-[1.75rem] font-bold leading-none ${item.valueClassName}`}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-3xl border border-white/70 bg-white/85 px-4 py-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-emerald-100 hover:shadow-md">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">{t('team_details_captain', 'Captain')}</div>
                <div className="mt-2 text-base font-semibold text-slate-800">{captainName}</div>
              </div>
              <div className="rounded-3xl border border-white/70 bg-white/85 px-4 py-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-blue-100 hover:shadow-md">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">{t('team_details_active_members', 'Active Members')}</div>
                <div className="mt-2 text-base font-semibold text-slate-800">{activeMembers.length}/{team.maxPlayers || 0}</div>
              </div>
              <div className="rounded-3xl border border-white/70 bg-white/85 px-4 py-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-violet-100 hover:shadow-md">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">{t('team_details_skill_level', 'Skill Level')}</div>
                <div className="mt-2 text-base font-semibold text-slate-800">
                  {team.skillLevel ? t(`teams_skill_${team.skillLevel}`, team.skillLevel) : t('team_details_not_set', 'Not set')}
                </div>
              </div>
              <div className="rounded-3xl border border-white/70 bg-white/85 px-4 py-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-amber-100 hover:shadow-md">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">{t('team_details_home_field', 'Home Field')}</div>
                <div className="mt-2 text-base font-semibold text-slate-800">{team.homeField?.name || t('profile_no_home_field', 'No home field assigned')}</div>
                {teamHomeFieldAddress && <div className="mt-1 text-sm leading-5 text-slate-500">{teamHomeFieldAddress}</div>}
                {teamHomeFieldLocationUrl && (
                  <a
                    href={teamHomeFieldLocationUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
                  >
                    <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                    {t('team_details_open_location', 'Open Location')}
                  </a>
                )}
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6 space-y-6">
        <div className="border-b border-gray-200">
          <div className="-mx-2 overflow-x-auto px-2">
            <div className="flex min-w-max items-center gap-5 sm:gap-8">
            <button
              type="button"
              onClick={() => setTab('overview')}
              className={`shrink-0 whitespace-nowrap border-b-2 px-1 py-3 text-sm font-semibold transition sm:text-base ${
                activeTab === 'overview'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t('team_details_overview', 'Overview')}
            </button>
            <button
              type="button"
              onClick={() => setTab('members')}
              className={`shrink-0 whitespace-nowrap border-b-2 px-1 py-3 text-sm font-semibold transition sm:text-base ${
                activeTab === 'members'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t('team_details_members', 'Members')}
            </button>
            <button
              type="button"
              onClick={() => setTab('history')}
              className={`shrink-0 whitespace-nowrap border-b-2 px-1 py-3 text-sm font-semibold transition sm:text-base ${
                activeTab === 'history'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {t('team_details_match_history', 'Match History')}
            </button>
            {isCaptainOfTeam && (
                <button
                  type="button"
                  onClick={() => navigate(`${basePath}/teams/${id}/manage`)}
                  className="shrink-0 whitespace-nowrap border-b-2 border-transparent px-1 py-3 text-sm font-semibold text-slate-500 transition hover:text-slate-700 sm:text-base"
                >
                  {t('team_details_manage_team', 'Manage Team')}
                </button>
              )}
            </div>
          </div>
        </div>

        {activeTab === 'overview' ? (
          <div className="space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{t('team_details_about', 'About This Team')}</h2>
                  <p className="mt-1 text-sm text-gray-500">{t('team_details_about_desc', 'Overview and profile details in one place.')}</p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                {teamOverviewDetails.map((item) => (
                  <div key={item.label} className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{item.label}</p>
                    {item.renderValue ? item.renderValue : <p className="mt-2 text-sm font-semibold text-gray-800">{item.value}</p>}
                  </div>
                ))}
                <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 md:col-span-2 xl:col-span-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{t('team_details_description', 'Description')}</p>
                  <p className="mt-2 text-sm leading-6 text-gray-700">{team.description || t('team_details_no_description', 'No team description yet.')}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <div className="rounded-2xl border border-gray-200 bg-white p-5 xl:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">{t('team_details_recent_history', 'Recent History')}</h3>
                    <p className="mt-1 text-sm text-gray-500">{t('team_details_recent_history_desc', 'Latest results, opponents, and match dates for this team.')}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                    {t('team_details_shown', '{{count}} shown', { count: recentMatches.length })}
                  </span>
                </div>

                <div className="mt-5">
                  {recentMatches.length > 0 ? (
                    <div className="space-y-3">
                      {recentMatches.map((match, index) => (
                        <div
                          key={match.id || `${match.opponentTeamName || 'opponent'}-${index}`}
                          className="cursor-pointer rounded-2xl border border-gray-200 bg-gray-50/70 px-4 py-4 transition hover:border-emerald-100 hover:shadow-sm"
                          onClick={() => setSelectedMatch(match)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              setSelectedMatch(match);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <div className="flex min-w-0 flex-1 items-center gap-2">
                                  <TeamMatchLogo
                                    teamName={match?.teamName || team.name || 'This Team'}
                                    logoUrl={getMatchTeamLogoUrl(match)}
                                  />
                                  <span className="truncate text-sm font-bold text-gray-900 sm:text-base">
                                    {match?.teamName || team.name || 'This Team'}
                                  </span>
                                </div>
                                <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.18em] text-gray-400 sm:text-sm">vs</span>
                                <div className="flex min-w-0 flex-1 items-center gap-2">
                                  <TeamMatchLogo
                                    teamName={match?.opponentTeamName || 'Opponent'}
                                    logoUrl={getMatchOpponentLogoUrl(match)}
                                  />
                                  <span className="truncate text-sm font-bold text-gray-900 sm:text-base">
                                    {match.opponentTeamName || 'Opponent'}
                                  </span>
                                </div>
                              </div>
                              <div className="mt-1 text-xs text-gray-500">{formatMatchSummary(match)}</div>
                              <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-600">
                                <div>
                                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">Date</div>
                                  <div className="mt-1 font-medium text-gray-700">{formatMatchDate(match)}</div>
                                </div>
                                <div>
                                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">Field</div>
                                  <div className="mt-1">
                                    {match?.fieldId ? (
                                      <Link
                                        to={`/fields/${match.fieldId}`}
                                        onClick={(event) => event.stopPropagation()}
                                        className="font-medium text-emerald-700 underline-offset-4 hover:text-emerald-800 hover:underline"
                                      >
                                        {formatMatchFieldName(match)}
                                      </Link>
                                    ) : (
                                      <span className="font-medium text-emerald-700">{formatMatchFieldName(match)}</span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="mt-4 flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setSelectedMatch(match);
                                  }}
                                  className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                                >
                                  View Details
                                </button>
                                {match?.fieldId && (
                                  <Link
                                    to={`/fields/${match.fieldId}`}
                                    onClick={(event) => event.stopPropagation()}
                                    className="inline-flex items-center rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-100"
                                  >
                                    Open Field
                                  </Link>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-3 self-stretch">
                              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-center shadow-sm">
                                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Score</div>
                                <div className="mt-1.5 text-xl font-bold text-slate-900">
                                  {match.finalScore || formatMatchResult(match)}
                                </div>
                              </div>
                              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-center shadow-sm">
                                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Result</div>
                                <div className="mt-1.5 text-sm font-semibold text-slate-900">
                                  {match.result || formatMatchResult(match)}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/60 px-4 py-8 text-center text-sm text-gray-500">
                      {t('team_details_no_recent_matches', 'No recent completed matches yet.')}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <h3 className="text-base font-semibold text-gray-900">{t('team_details_notes', 'Team Notes')}</h3>
                <p className="mt-1 text-sm text-gray-500">{t('team_details_notes_desc', 'Supporting details that are not already shown in the top summary card.')}</p>
                <div className="mt-5 space-y-4 text-sm text-gray-700">
                  <div className="flex items-center gap-3">
                    <UsersIcon className="h-5 w-5 text-gray-400" />
                    <span>{t('team_details_squad_capacity', 'Squad capacity: {{count}} players', { count: team.maxPlayers || 0 })}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <ShieldCheckIcon className="h-5 w-5 text-gray-400" />
                    <span>{t('team_details_status_line', 'Team status: {{status}}', { status: team.status ? team.status.charAt(0).toUpperCase() + team.status.slice(1) : t('team_details_active', 'Active') })}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <MapPinIcon className="h-5 w-5 text-gray-400" />
                    <span>{t('team_details_created_on', 'Created on {{date}}', { date: createdDate })}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1.5">
                      {teamJerseyColors.map((color, index) => (
                        <span key={`${color}-${index}`} className="h-5 w-5 rounded-full border border-gray-300" style={{ backgroundColor: color }} />
                      ))}
                    </span>
                    <span>{t('team_details_jersey_selected', '{{count}} jersey colors selected', { count: teamJerseyColors.length })}</span>
                  </div>
                  <div className="rounded-2xl bg-gray-50 px-4 py-4 text-sm leading-6 text-gray-600">
                    {t('team_details_notes_helper', 'The top summary card now holds the main identity details, and this section keeps only the extra context.')}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {isAdminUser ? (
                <div className="text-sm text-gray-700">{t('team_details_admin_view', 'Admin view of this team profile, members, and recent history.')}</div>
              ) : isCaptainOfTeam ? (
                <div className="text-sm text-gray-700">{t('team_details_you_are_captain', 'You are the captain of this team.')}</div>
              ) : isInvited ? (
                <div className="flex flex-wrap gap-3">
                  <div className="text-sm text-gray-700">{t('team_details_invited', 'You have been invited to join this team.')}</div>
                  <button
                    onClick={handleAccept}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-white bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 shadow disabled:opacity-50"
                  >
                    <CheckIcon className="h-4 w-4" />
                    {actionLoading ? '...' : 'Accept'}
                  </button>
                  <button
                    onClick={handleDecline}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-white bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow disabled:opacity-50"
                  >
                    <XMarkIcon className="h-4 w-4" />
                    {actionLoading ? '...' : 'Decline'}
                  </button>
                </div>
              ) : membership?.status === 'pending' ? (
                <div className="text-sm text-gray-700">{t('team_details_join_pending', 'Join request pending approval.')}</div>
              ) : membership?.status === 'active' ? (
                <button
                  onClick={handleLeave}
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                >
                  {actionLoading ? t('team_details_leaving', 'Leaving...') : t('team_details_leave_team', 'Leave Team')}
                </button>
              ) : (
                <button
                  onClick={handleJoin}
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                >
                  {actionLoading ? 'Requesting...' : 'Request to Join'}
                </button>
              )}
            </div>
          </div>
        ) : activeTab === 'members' ? (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-900">{t('team_details_members', 'Members')}</h2>
              <span className="text-xs text-gray-500">{activeMembers.length}/{team.maxPlayers} {t('team_details_players', 'players')}</span>
            </div>
            <div className="mt-3 divide-y divide-gray-200 border border-gray-200 rounded-md overflow-hidden">
              {activeMembers.length > 0 ? (
                activeMembers.map((m) => (
                  <div
                    key={m.userId}
                    className="cursor-pointer px-4 py-3 transition hover:bg-gray-50"
                    onClick={() => openMemberDetails(m)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openMemberDetails(m);
                      }
                    }}
                    tabIndex={0}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <img
                          src={resolveUserAvatarUrl(m.user)}
                          alt={`${m.user?.firstName || m.user?.username || 'User'} avatar`}
                          className="h-8 w-8 cursor-zoom-in rounded-full border border-gray-200 bg-gray-100 object-cover"
                          onClick={(event) => {
                            event.stopPropagation();
                            setPreviewImage({
                              url: resolveUserAvatarUrl(m.user),
                              title: `${m.user?.firstName || m.user?.username || 'User'} photo`
                            });
                          }}
                          onError={(e) => {
                            const fallbackUrl = `${API_ORIGIN}${DEFAULT_PROFILE_PATH}`;
                            if (e.currentTarget.src !== fallbackUrl) {
                              e.currentTarget.src = fallbackUrl;
                            }
                          }}
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {m.user?.firstName || m.user?.username || 'User'} {m.user?.lastName || ''}
                          </div>
                          <div className="text-xs text-gray-500">
                            @{m.user?.username || 'member'}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-500 capitalize">{m.role}</div>
                        <div className="text-xs text-gray-400">
                          {new Date(m.createdAt || m.joinedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-4 py-6 text-sm text-gray-500 text-center">{t('team_details_no_active_members', 'No active members yet.')}</div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Match History</h2>
                <p className="mt-1 text-sm text-gray-500">
                  Review completed matches and {isCaptainOfTeam ? 'rate opponent teams after the final whistle.' : 'track team performance.'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <label htmlFor="history-season" className="text-sm text-gray-500">
                  Filter by:
                </label>
                <select
                  id="history-season"
                  value={selectedSeason}
                  onChange={(e) => setSelectedSeason(e.target.value)}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm focus:border-green-500 focus:outline-none"
                >
                  {availableSeasons.map((season) => (
                    <option key={season} value={season}>
                      {season === 'all' ? 'All Seasons' : season}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {matchHistoryError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {matchHistoryError}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
              {historyStatCards.map((card) => {
                const IconComponent = card.icon;
                return (
                  <div key={card.key} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${card.iconClassName}`}>
                        <IconComponent className="h-8 w-8" />
                      </div>
                      <div>
                        <p className="text-[15px] font-semibold text-slate-500">{card.label}</p>
                        <p className={`mt-2 text-4xl font-bold leading-none ${card.valueClassName}`}>{card.value}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-200 px-6 py-5">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Completed Matches</h3>
                  <p className="mt-1 text-sm text-gray-500">Only completed matches can be rated.</p>
                </div>
              </div>

              {matchHistoryLoading ? (
                <div className="px-6 py-12 text-center text-sm text-gray-500">Loading match history...</div>
              ) : filteredMatches.length === 0 ? (
                <div className="px-6 py-12 text-center text-sm text-gray-500">No completed matches found for this team yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <th className="px-6 py-4">Date</th>
                        <th className="px-6 py-4">Opponent</th>
                        <th className="px-6 py-4">Result / Score</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Actions</th>
                      </tr>
                    </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                      {filteredMatches.map((match) => {
                        const canRate = Boolean(isCaptainOfTeam && match?.canRate);

                        return (
                          <tr key={`${match.id}-${match.bookingId || match.date}`} className="align-top">
                            <td className="px-6 py-4 text-sm font-medium text-slate-700">{formatMatchDate(match)}</td>
                            <td className="px-6 py-4">
                              <div className="font-semibold text-slate-900">{match.opponentTeamName}</div>
                              <div className="mt-1 text-xs text-slate-500">{match.fieldName || 'Field not recorded'}</div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${getResultPillClasses(match.result)}`}>
                                {match.finalScore} ({match.result === 'Win' ? 'W' : match.result === 'Loss' ? 'L' : 'D'})
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-medium text-blue-600">
                                Completed
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              {match?.rating ? (
                                <div className="flex justify-center">
                                  <button
                                    type="button"
                                    onClick={() => setViewRatingMatch(match)}
                                    className="inline-flex min-w-[116px] items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-700"
                                  >
                                    View Rating
                                  </button>
                                </div>
                              ) : canRate ? (
                                <div className="flex justify-center">
                                  <button
                                    type="button"
                                    onClick={() => openRatingModal(match)}
                                    className="inline-flex min-w-[116px] items-center justify-center rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700"
                                  >
                                    Rate Opponent
                                  </button>
                                </div>
                              ) : (
                                <div className="flex justify-center">
                                  <button
                                    type="button"
                                    onClick={() => openRatingModal(match)}
                                    className="inline-flex min-w-[116px] items-center justify-center rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700"
                                  >
                                    Rate Opponent
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {ratingModalMatch && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/40 px-4 py-6">
          <div className="flex min-h-full items-start justify-center">
            <div className="max-h-[calc(100vh-3rem)] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
                  <StarIcon className="h-6 w-6 text-violet-500" />
                  Rate Your Opponent
                </h3>
              </div>
              <button
                type="button"
                onClick={closeRatingModal}
                className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 space-y-8">
              <div className="border-t border-slate-200 pt-6 text-center">
                <div className="mx-auto flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-50 shadow-sm">
                  {resolveTeamLogoUrl(ratingModalMatch.opponentTeamLogoUrl) ? (
                    <img
                      src={resolveTeamLogoUrl(ratingModalMatch.opponentTeamLogoUrl)}
                      alt={`${ratingModalMatch.opponentTeamName} logo`}
                      className="h-full w-full object-contain p-2"
                    />
                  ) : (
                    <span className="text-3xl font-bold text-slate-400">
                      {String(ratingModalMatch.opponentTeamName || '?').charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <h4 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">{ratingModalMatch.opponentTeamName}</h4>
                <div className="mt-2 flex items-center justify-center gap-2 text-sm text-slate-500">
                  <span>{formatMatchDate(ratingModalMatch)}</span>
                  <span>&bull;</span>
                  <span>{ratingModalMatch.fieldName || 'Field not recorded'}</span>
                </div>
                <div className="mx-auto mt-4 inline-flex rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-xl font-bold text-slate-900 shadow-sm">
                  Final Score: {ratingModalMatch.finalScore}
                </div>
              </div>

              <div>
                <label className="text-base font-semibold text-slate-900">Overall Rating</label>
                <div className="mt-4 flex justify-center">
                  {renderStars(
                    ratingForm.rating,
                    true,
                    (star) => setRatingForm((prev) => ({ ...prev, rating: star })),
                    { iconClassName: 'h-12 w-12', activeClassName: 'text-amber-400', inactiveClassName: 'text-slate-300' }
                  )}
                </div>
                <p className="mt-3 text-center text-sm text-slate-500">Click to rate</p>
              </div>

              <div className="space-y-4">
                <h4 className="text-base font-semibold text-slate-900">Rate by Category</h4>
                {ratingCategories.map((category) => {
                  const IconComponent = category.icon;
                  const value = ratingForm.categories[category.key];
                  return (
                    <div key={category.key} className="rounded-3xl bg-slate-50 px-5 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-base font-semibold text-slate-900">
                          <IconComponent className="h-5 w-5 text-violet-500" />
                          <span>{category.label}</span>
                        </div>
                        <span className="text-sm text-slate-500">{value ? `${value}/5` : 'Not rated'}</span>
                      </div>
                      <div className="mt-4 flex justify-between gap-2">
                        {renderStars(
                          value,
                          true,
                          (star) =>
                            setRatingForm((prev) => ({
                              ...prev,
                              categories: {
                                ...prev.categories,
                                [category.key]: star
                              }
                            })),
                          { iconClassName: 'h-8 w-8', activeClassName: 'text-amber-400', inactiveClassName: 'text-slate-300', buttonClassName: 'flex-1 justify-center' }
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div>
                <label className="inline-flex items-center gap-2 text-base font-semibold text-slate-900">
                  <ChatBubbleLeftRightIcon className="h-4 w-4 text-slate-400" />
                  Additional Feedback (Optional)
                </label>
                <textarea
                  value={ratingForm.review}
                  onChange={(e) => setRatingForm((prev) => ({ ...prev, review: e.target.value }))}
                  maxLength={500}
                  rows={5}
                  className="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-green-500"
                />
                <div className="mt-2 text-right text-xs text-slate-400">{ratingForm.review.length}/500</div>
              </div>
            </div>

            <div className="mt-6 border-t border-slate-200 pt-6">
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeRatingModal}
                  disabled={ratingSubmitting || ratingSubmitted}
                  className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmitRating}
                  disabled={ratingSubmitting || ratingSubmitted}
                  className={`rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50 ${
                    ratingSubmitted ? 'bg-emerald-700' : 'bg-[#128C4A] hover:bg-[#0f7a40]'
                  }`}
                >
                  {ratingSubmitting ? 'Submitting...' : ratingSubmitted ? 'Submitted Already' : 'Submit Rating'}
                </button>
              </div>
              {ratingValidationVisible && (
                <p className="mt-3 text-center text-sm text-rose-500">
                  Please provide an overall rating and rate all categories
                </p>
              )}
            </div>
          </div>
          </div>
        </div>
      )}
      {viewRatingMatch?.rating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Opponent Rating</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Rating submitted for <span className="font-semibold text-slate-700">{viewRatingMatch.opponentTeamName}</span>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewRatingMatch(null)}
                className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <CalendarDaysIcon className="h-4 w-4 text-slate-400" />
                  <span>{formatMatchDate(viewRatingMatch)}</span>
                </div>
                <div className="mt-2 font-medium text-slate-800">
                  Final score: {viewRatingMatch.finalScore} ({viewRatingMatch.result})
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700">Rating</label>
                <div className="mt-3">{renderStars(viewRatingMatch.rating.value)}</div>
              </div>

              <div>
                <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <ClockIcon className="h-4 w-4 text-slate-400" />
                  Submitted
                </label>
                <p className="mt-2 text-sm text-slate-600">
                  {viewRatingMatch.rating.createdAt ? new Date(viewRatingMatch.rating.createdAt).toLocaleString() : 'Date unavailable'}
                </p>
              </div>

              <div>
                <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <ChatBubbleLeftRightIcon className="h-4 w-4 text-slate-400" />
                  Comment
                </label>
                <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
                  {viewRatingMatch.rating.review || 'No comment left for this match.'}
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setViewRatingMatch(null)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      <ImagePreviewModal
        open={Boolean(previewImage)}
        imageUrl={previewImage?.url}
        title={previewImage?.title || 'Member photo'}
        onClose={() => setPreviewImage(null)}
      />
    </div>
  );
};

export default TeamDetailsPage;
