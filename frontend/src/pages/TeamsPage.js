import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../context/RealtimeContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { UsersIcon, PlusIcon, CheckIcon, XMarkIcon, BellAlertIcon, ShieldCheckIcon, SparklesIcon } from '@heroicons/react/24/outline';
import teamService from '../services/teamService';
import notificationService from '../services/notificationService';
import { ImagePreviewModal } from '../components/ui';
import { getTeamJerseyColors } from '../utils/teamColors';
import { useLanguage } from '../context/LanguageContext';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';
const API_ORIGIN =
  typeof window !== 'undefined' && API_BASE_URL.startsWith('/')
    ? window.location.origin
    : API_BASE_URL.replace(/\/api\/?$/, '');

// Resolve team logo url into a display-safe value.
const resolveTeamLogoUrl = (rawLogo) => {
  if (!rawLogo) return null;
  if (/^https?:\/\//i.test(rawLogo)) return rawLogo;
  const normalizedLogoPath = rawLogo.startsWith('/') ? rawLogo : `/${rawLogo}`;
  return `${API_ORIGIN}${normalizedLogoPath}`;
};

// Normalize teams response into a consistent shape.
const normalizeTeamsResponse = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.teams)) return payload.teams;
  return [];
};

const getCaptainName = (team) => team.captain?.firstName || team.captain?.username || 'Unknown';

const TeamsPage = () => {
  const { user } = useAuth();
  const { version } = useRealtime();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [teams, setTeams] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [deletingTeamId, setDeletingTeamId] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [teamToDelete, setTeamToDelete] = useState(null);
  const [deleteMessage, setDeleteMessage] = useState('');
  const [error, setError] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const isAdmin = user?.role === 'admin';
  const canCreateTeam = !!user && !isAdmin && user?.role !== 'player';
  const basePath = location.pathname.startsWith('/owner') ? '/owner' : '/app';

  useEffect(() => {
    // Support fetch teams and invitations for this page.
    const fetchTeamsAndInvitations = async () => {
      try {
        setLoading(true);
        const [teamsRes, invitationsRes] = await Promise.all([
          isAdmin ? teamService.getAllTeams({ limit: 200 }) : teamService.getMyTeams(),
          isAdmin ? Promise.resolve({ data: [] }) : teamService.getMyInvitations()
        ]);
        setTeams(normalizeTeamsResponse(teamsRes.data));
        setInvitations(Array.isArray(invitationsRes.data) ? invitationsRes.data : []);
      } catch (err) {
        console.error('Failed to fetch teams:', err);
        setError(err?.error || t('teams_load_failed'));
      } finally {
        setLoading(false);
      }
    };

    fetchTeamsAndInvitations();
  }, [t, user?.id, isAdmin, version]);

  // Handle create team interactions.
  const handleCreateTeam = () => {
    navigate(`${basePath}/teams/create`);
  };

  // eslint-disable-next-line no-unused-vars
  const handleJoinTeam = async (teamId) => {
    try {
      await teamService.joinTeam(teamId);
      // Refresh teams list
      const response = await teamService.getAllTeams();
      const teamsData = normalizeTeamsResponse(response.data);
      setTeams(teamsData);
    } catch (err) {
      console.error('Failed to join team:', err);
      setError(t('teams_join_failed'));
    }
  };

  // Handle view team interactions.
  const handleViewTeam = (teamId) => {
    navigate(`${basePath}/teams/${teamId}`);
  };

  // Open delete dialog in the UI.
  const openDeleteDialog = (team) => {
    setTeamToDelete(team);
    setDeleteMessage('');
    setDeleteDialogOpen(true);
  };

  // Close delete dialog in the UI.
  const closeDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setTeamToDelete(null);
    setDeleteMessage('');
  };

  // Handle delete team interactions.
  const handleDeleteTeam = async () => {
    if (!teamToDelete?.id) return;
    const message = deleteMessage.trim();
    if (!message) {
      setError(t('teams_delete_message_required'));
      return;
    }

    const teamId = teamToDelete.id;
    try {
      setDeletingTeamId(teamId);
      setError(null);
      const captainUserId = teamToDelete?.captainId || teamToDelete?.captain?.id;

      if (captainUserId) {
        await notificationService.create({
          userId: captainUserId,
          type: 'system',
          title: `Team deleted by admin: ${teamToDelete.name}`,
          message,
          metadata: {
            event: 'team_deleted_by_admin',
            teamId: teamToDelete.id,
            teamName: teamToDelete.name,
            actorId: user?.id
          }
        });
      }

      await teamService.deleteTeam(teamId);
      setTeams((prev) => prev.filter((item) => item.id !== teamId));
      closeDeleteDialog();
    } catch (err) {
      setError(err?.error || t('teams_delete_failed'));
    } finally {
      setDeletingTeamId(null);
    }
  };

  // Handle accept invite interactions.
  const handleAcceptInvite = async (teamId) => {
    try {
      setActionLoading(true);
      setError(null);
      await teamService.acceptInvite(teamId);
      const [teamsRes, invitationsRes] = await Promise.all([
        teamService.getMyTeams(),
        teamService.getMyInvitations()
      ]);
      setTeams(normalizeTeamsResponse(teamsRes.data));
      setInvitations(Array.isArray(invitationsRes.data) ? invitationsRes.data : []);
    } catch (err) {
      setError(err?.error || t('teams_accept_invite_failed'));
    } finally {
      setActionLoading(false);
    }
  };

  // Handle decline invite interactions.
  const handleDeclineInvite = async (teamId) => {
    try {
      setActionLoading(true);
      setError(null);
      await teamService.declineInvite(teamId);
      const invitationsRes = await teamService.getMyInvitations();
      setInvitations(Array.isArray(invitationsRes.data) ? invitationsRes.data : []);
    } catch (err) {
      setError(err?.error || t('teams_decline_invite_failed'));
    } finally {
      setActionLoading(false);
    }
  };

  // eslint-disable-next-line no-unused-vars
  const getPreferredTimeColor = (time) => {
    const colors = {
      morning: 'bg-blue-100 text-blue-800',
      evening: 'bg-purple-100 text-purple-800',
      flexible: 'bg-green-100 text-green-800'
    };
    return colors[time] || 'bg-gray-100 text-gray-800';
  };

  // eslint-disable-next-line no-unused-vars
  const calculateWinRate = (wins, losses, draws) => {
    const total = wins + losses + draws;
    if (total === 0) return 0;
    return ((wins / total) * 100).toFixed(1);
  };

  // eslint-disable-next-line no-unused-vars
  const getMemberCount = (team) => {
    return team.TeamMembers?.filter(member => member.status === 'active' && member.isActive !== false).length || 0;
  };

  // eslint-disable-next-line no-unused-vars
  const isUserInTeam = (team) => {
    return team.TeamMembers?.some(member => 
      member.userId === user?.id && member.status === 'active' && member.isActive !== false
    );
  };

  const pageTitle = isAdmin ? t('teams_all') : t('teams_my');
  const pageDescription = isAdmin
    ? t('teams_hub_admin_desc')
    : t('teams_hub_desc');
  const summaryCards = [
    {
      label: t('teams_hub_active_teams'),
      value: teams.length,
      description: teams.length === 1 ? t('teams_hub_workspace_single') : t('teams_hub_workspace_plural'),
      icon: UsersIcon,
      accent: 'from-emerald-500/15 via-emerald-500/5 to-transparent',
      iconClassName: 'text-emerald-600'
    },
    {
      label: t('teams_hub_pending_invites'),
      value: invitations.length,
      description: invitations.length > 0 ? t('teams_hub_need_response') : t('teams_hub_nothing_waiting'),
      icon: BellAlertIcon,
      accent: 'from-amber-500/15 via-amber-500/5 to-transparent',
      iconClassName: 'text-amber-600'
    },
    {
      label: isAdmin ? t('teams_hub_admin_access') : t('teams_hub_creation'),
      value: isAdmin ? t('teams_hub_enabled') : (canCreateTeam ? t('teams_hub_ready') : t('teams_hub_locked')),
      description: isAdmin
        ? t('teams_hub_admin_manage_desc')
        : (canCreateTeam ? t('teams_hub_create_desc') : t('teams_hub_locked_desc')),
      icon: isAdmin ? ShieldCheckIcon : SparklesIcon,
      accent: 'from-sky-500/15 via-sky-500/5 to-transparent',
      iconClassName: 'text-sky-600'
    }
  ];
  const teamsGridClassName = teams.length === 1
    ? 'grid max-w-md grid-cols-1 gap-6'
    : 'grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-gradient-to-br from-white via-emerald-50/70 to-sky-50/80 shadow-sm">
        <div className="flex flex-col gap-8 px-6 py-7 lg:px-8 lg:py-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 shadow-sm">
                <ShieldCheckIcon className="h-4 w-4" />
                {t('teams_hub_badge')}
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{pageTitle}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                {pageDescription}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 xl:justify-end">
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
                {t('teams_results', '{{count}} results', { count: teams.length })}
              </span>
              <button
                onClick={() => navigate('/teams')}
                className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
              >
                {t('teams_browse')}
              </button>
              {canCreateTeam && (
                <button
                  onClick={handleCreateTeam}
                  className="inline-flex items-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                >
                  <PlusIcon className="mr-2 h-4 w-4" />
                  {t('action_create_team')}
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {summaryCards.map((card) => {
              const Icon = card.icon;

              return (
                <div
                  key={card.label}
                  className="relative overflow-hidden rounded-2xl border border-white/70 bg-white/85 p-5 shadow-sm backdrop-blur"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br opacity-90 ${card.accent}`} />
                  <div className="relative flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold text-slate-500">{card.label}</div>
                      <div className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{card.value}</div>
                      <div className="mt-2 text-sm text-slate-600">{card.description}</div>
                    </div>
                    <div className="rounded-2xl bg-slate-900/5 p-3">
                      <Icon className={`h-6 w-6 ${card.iconClassName}`} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      )}

      {invitations.length > 0 && (
        <div className="mb-8 bg-white border border-amber-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-amber-100 bg-amber-50/70 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-amber-900 inline-flex items-center gap-2">
              <BellAlertIcon className="h-4 w-4" />
              {t('teams_invitations')}
            </h2>
            <span className="text-xs text-amber-700">{t('teams_pending_count', '{{count}} pending', { count: invitations.length })}</span>
          </div>
          <div className="p-4 space-y-3">
            {invitations.map((team) => (
              <div key={team.id} className="border border-gray-200 rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-gray-900">{team.name}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {t('teams_invited_by', { name: team.captain?.firstName || team.captain?.username || t('teams_captain') })}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleAcceptInvite(team.id)}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-md text-xs font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
                  >
                    <CheckIcon className="h-4 w-4" />
                    {t('teams_accept')}
                  </button>
                  <button
                    onClick={() => handleDeclineInvite(team.id)}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-md text-xs font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
                  >
                    <XMarkIcon className="h-4 w-4" />
                    {t('teams_decline')}
                  </button>
                  <button
                    onClick={() => handleViewTeam(team.id)}
                    className="px-3 py-2 rounded-md text-xs font-medium border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    {t('notifications_view_team')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={teamsGridClassName}>
        {teams.length > 0 ? (
          teams.map((team) => {
            const teamLogoUrl = resolveTeamLogoUrl(team.logoUrl || team.logo_url || team.logo);
            const jerseyColors = getTeamJerseyColors(team);
            const captainName = getCaptainName(team);

            return (
              <div
                key={team.id}
                role="button"
                tabIndex={0}
                onClick={() => handleViewTeam(team.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleViewTeam(team.id);
                  }
                }}
                className="bg-white shadow-sm ring-1 ring-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
              >
                <div className="relative h-52 bg-gradient-to-br from-slate-50 via-white to-emerald-50">
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-100/60">
                    <UsersIcon className="h-12 w-12 text-gray-300" />
                  </div>
                {teamLogoUrl && (
                  <img
                    src={teamLogoUrl}
                    alt={`${team.name} logo`}
                    className="absolute inset-0 z-10 h-full w-full cursor-zoom-in object-contain object-center p-4"
                    onClick={(event) => {
                      event.stopPropagation();
                      setPreviewImage({ url: teamLogoUrl, title: `${team.name} image` });
                    }}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  )}
                </div>

                <div className="p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 truncate">{team.name}</h3>
                      <p className="mt-1 text-sm text-gray-600 line-clamp-2">{team.description || t('teams_no_description')}</p>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700 shrink-0">
                      {t('profile_members_count', '{{count}} members', { count: getMemberCount(team) })}
                    </span>
                  </div>

                  <div className="mt-5 text-sm text-gray-600 space-y-1">
                    <div>{t('teams_captain_label', 'Captain: {{name}}', { name: captainName })}</div>
                    {team.skillLevel && (
                      <div className="flex items-center gap-2">
                        <span>{t('teams_skill')}</span>
                        <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800 capitalize">
                          {t(`teams_skill_${team.skillLevel}`, team.skillLevel)}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span>{t('teams_jersey')}</span>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-1">
                          {jerseyColors.map((color, index) => (
                            <span key={`${color}-${index}`} className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: color }} />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex gap-2">
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        handleViewTeam(team.id);
                      }}
                    className="flex-1 border border-gray-300 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-50 transition-colors text-sm font-semibold"
                  >
                      {t('teams_view_details')}
                    </button>
                    {isAdmin && (
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          openDeleteDialog(team);
                        }}
                        disabled={deletingTeamId === team.id}
                        className="flex-1 border border-red-200 text-red-700 px-4 py-2 rounded-md hover:bg-red-50 transition-colors text-sm font-semibold disabled:opacity-60"
                      >
                        {deletingTeamId === team.id ? t('common_deleting') : t('teams_delete')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-[28px] border border-dashed border-slate-300 bg-white/80 px-6 py-14 text-center shadow-sm">
            <UsersIcon className="mx-auto h-12 w-12 text-slate-400" />
            <h3 className="mt-4 text-lg font-semibold text-slate-900">{t('teams_none_found')}</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              {t('teams_none_found_desc')}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => navigate('/teams')}
                className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                {t('teams_browse')}
              </button>
              {canCreateTeam && (
                <button
                  onClick={handleCreateTeam}
                  className="inline-flex items-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                >
                  <PlusIcon className="mr-2 h-4 w-4" />
                  {t('action_create_team')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {deleteDialogOpen && teamToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
            <div className="border-b border-gray-200 px-5 py-4">
              <h2 className="text-lg font-semibold text-gray-900">{t('teams_delete_modal_title')}</h2>
              <p className="mt-1 text-sm text-gray-600">
                {t('teams_delete_modal_desc', 'Send a message to captain before deleting {{team}}.', { team: teamToDelete.name })}
              </p>
            </div>
            <div className="px-5 py-4">
              <label className="mb-2 block text-sm font-medium text-gray-700">{t('teams_message_to_captain')}</label>
              <textarea
                value={deleteMessage}
                onChange={(e) => setDeleteMessage(e.target.value)}
                rows={4}
                placeholder={t('teams_delete_reason_placeholder')}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
              />
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-4">
              <button
                type="button"
                onClick={closeDeleteDialog}
                disabled={deletingTeamId === teamToDelete.id}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {t('action_cancel')}
              </button>
              <button
                type="button"
                onClick={handleDeleteTeam}
                disabled={deletingTeamId === teamToDelete.id}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deletingTeamId === teamToDelete.id ? t('common_deleting') : t('teams_send_delete')}
              </button>
            </div>
          </div>
        </div>
      )}
      <ImagePreviewModal
        open={Boolean(previewImage)}
        imageUrl={previewImage?.url}
        title={previewImage?.title || t('teams_image')}
        onClose={() => setPreviewImage(null)}
      />
    </div>
  );
};

export default TeamsPage;
