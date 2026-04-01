import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import teamService from '../services/teamService';
import notificationService from '../services/notificationService';
import { MagnifyingGlassIcon, UsersIcon } from '@heroicons/react/24/outline';
import { Badge, Button, EmptyState, ImagePreviewModal, Spinner, useToast } from '../components/ui';
import { getTeamJerseyColors } from '../utils/teamColors';

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

const translateSkillLevel = (value, t) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'beginner') return t('teams_skill_beginner', 'Beginner');
  if (normalized === 'intermediate') return t('teams_skill_intermediate', 'Intermediate');
  if (normalized === 'advanced') return t('teams_skill_advanced', 'Advanced');
  return value;
};
const normalizeSearchValue = (value) => String(value || '').trim().toLowerCase();
const buildDisplayName = (person) => `${person?.firstName || ''} ${person?.lastName || ''}`.trim();

const hasPendingJoinRequest = (team, userId) => {
  if (!team || !userId) return false;

  if (team.joinRequestPending || team.hasPendingJoinRequest || team.membershipStatus === 'pending' || team.userMembershipStatus === 'pending') {
    return true;
  }

  if (Array.isArray(team.teamMembers)) {
    return team.teamMembers.some((member) => member.userId === userId && member.status === 'pending');
  }

  return false;
};

const PublicTeamsPage = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchInputRef = useRef(null);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingTeamId, setDeletingTeamId] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [teamToDelete, setTeamToDelete] = useState(null);
  const [deleteMessage, setDeleteMessage] = useState('');
  const [previewImage, setPreviewImage] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchScope, setSearchScope] = useState('all');
  const { showSuccess, showError } = useToast();
  const { t } = useLanguage();
  const isAdmin = user?.role === 'admin';

  // Check whether request join is allowed.
  const canRequestJoin = (team) => {
    if (!isAuthenticated) return false;
    if (!user) return false;
    if (!['player', 'captain', 'field_owner', 'admin'].includes(user?.role || '')) return false;
    // Prevent captains from joining their own teams
    if (team.captainId === user?.id) return false;
    return true;
  };

  useEffect(() => {
    // Support fetch teams for this page.
    const fetchTeams = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await teamService.getPublicTeams();
        const teamsData = Array.isArray(response.data) ? response.data : [];
        setTeams(teamsData);
      } catch (err) {
        console.error('Failed to fetch public teams:', err);
        setError(err?.error || t('teams_load_failed', 'Failed to load teams'));
      } finally {
        setLoading(false);
      }
    };

    fetchTeams();
  }, [t]);

  useEffect(() => {
    const incomingQuery = searchParams.get('q') || '';
    const incomingScope = searchParams.get('type');
    const nextScope = ['captain', 'player'].includes(incomingScope) ? incomingScope : 'all';

    setSearchTerm(incomingQuery);
    setSearchScope(nextScope);
  }, [searchParams]);

  useEffect(() => {
    const focusMode = searchParams.get('focus');
    if (focusMode !== 'search') return;

    searchInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    searchInputRef.current?.focus();
  }, [searchParams]);

  // Handle request join interactions.
  const handleRequestJoin = async (teamId) => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/teams/${teamId}`, backgroundLocation: location } });
      return;
    }

    try {
      setError(null);
      const response = await teamService.joinTeam(teamId);
      if (response.success) {
        setTeams((prev) =>
          prev.map((team) =>
            team.id === teamId
              ? {
                  ...team,
                  joinRequestPending: true,
                  userMembershipStatus: 'pending'
                }
              : team
          )
        );
        showSuccess(t('teams_join_submitted', 'Join request submitted. Waiting for captain approval.'));
      }
    } catch (err) {
      if ((err?.error || '').toLowerCase().includes('already pending')) {
        setTeams((prev) =>
          prev.map((team) =>
            team.id === teamId
              ? {
                  ...team,
                  joinRequestPending: true,
                  userMembershipStatus: 'pending'
                }
              : team
          )
        );
        showSuccess(t('teams_join_still_pending', 'Your join request is still waiting for captain approval.'));
        setError(null);
        return;
      }
      showError(err?.error || t('teams_join_failed', 'Failed to submit join request'));
    }
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
      showError(t('teams_delete_message_required', 'Please enter a message to captain before deleting.'));
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
      setTeams((prev) => prev.filter((team) => team.id !== teamId));
      showSuccess(t('teams_delete_success', 'Team deleted successfully.'));
      closeDeleteDialog();
    } catch (err) {
      showError(err?.error || t('teams_delete_failed', 'Failed to delete team'));
    } finally {
      setDeletingTeamId(null);
    }
  };

  const syncSearchParams = (nextQuery, nextScope) => {
    const params = new URLSearchParams();
    const trimmedQuery = nextQuery.trim();

    if (trimmedQuery) {
      params.set('q', trimmedQuery);
    }

    if (nextScope && nextScope !== 'all') {
      params.set('type', nextScope);
    }

    setSearchParams(params);
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    syncSearchParams(searchTerm, searchScope);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setSearchScope('all');
    setSearchParams({});
    searchInputRef.current?.focus();
  };

  const filteredTeams = teams.filter((team) => {
    const normalizedSearchTerm = normalizeSearchValue(searchTerm);
    const captainName = buildDisplayName(team.captain);
    const memberTerms = Array.isArray(team.members)
      ? team.members.flatMap((member) => {
          const fullName = buildDisplayName(member);
          return [member.username, member.firstName, member.lastName, fullName];
        })
      : [];

    if (searchScope === 'captain') {
      const captainTerms = [captainName, team.captain?.username, team.name];

      if (!normalizedSearchTerm) return Boolean(team.captain);
      return captainTerms.some((term) => normalizeSearchValue(term).includes(normalizedSearchTerm));
    }

    if (searchScope === 'player') {
      if (!normalizedSearchTerm) return memberTerms.length > 0;
      return (
        memberTerms.some((term) => normalizeSearchValue(term).includes(normalizedSearchTerm)) ||
        normalizeSearchValue(team.name).includes(normalizedSearchTerm)
      );
    }

    if (!normalizedSearchTerm) return true;

    return [
      team.name,
      team.description,
      team.homeField?.name,
      team.homeField?.city,
      captainName,
      team.captain?.username,
      ...memberTerms
    ].some((term) => normalizeSearchValue(term).includes(normalizedSearchTerm));
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('nav_teams', 'Teams')}</h1>
          <p className="mt-1 text-sm text-gray-600">
            {isAdmin ? t('teams_admin_desc', 'Admin view of all teams. You can open or delete any team.') : t('teams_public_desc', 'Discover football teams and request to join.')}
          </p>
        </div>
        <Badge tone="gray">{t('teams_results', '{{count}} results', { count: filteredTeams.length })}</Badge>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      )}

      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_auto]">
          <label className="relative block">
            <span className="sr-only">{t('fields_search', 'Search')}</span>
            <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              ref={searchInputRef}
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={t('teams_search_placeholder', 'Search teams, captains, or players...')}
              className="w-full rounded-xl border border-gray-300 px-11 py-3 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
            />
          </label>

          <select
            value={searchScope}
            onChange={(event) => setSearchScope(event.target.value)}
            className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
          >
            <option value="all">{t('teams_search_scope_all', 'All teams')}</option>
            <option value="captain">{t('teams_search_scope_captains', 'Captains')}</option>
            <option value="player">{t('teams_search_scope_players', 'Players')}</option>
          </select>

          <div className="flex gap-2">
            <Button type="submit" className="flex-1 whitespace-nowrap">
              {t('landing_hero_search_button', 'Search')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleClearSearch}
              className="flex-1 whitespace-nowrap"
            >
              {t('fields_clear_filters', 'Clear filters')}
            </Button>
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTeams.length > 0 ? (
          filteredTeams.map((team) => {
            const teamLogoUrl = resolveTeamLogoUrl(team.logoUrl || team.logo_url || team.logo);
            const jerseyColors = getTeamJerseyColors(team);
            const joinRequestPending = hasPendingJoinRequest(team, user?.id);

            return (
            <div
              key={team.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/teams/${team.id}`)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  navigate(`/teams/${team.id}`);
                }
              }}
              className="bg-white shadow-sm ring-1 ring-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
            >
              <div className="relative h-52">
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                  <UsersIcon className="h-12 w-12 text-gray-300" />
                </div>
                {teamLogoUrl && (
                  <img
                    src={teamLogoUrl}
                    alt={`${team.name} ${t('teams_image', 'Team image').toLowerCase()}`}
                    className="absolute inset-0 z-10 h-full w-full cursor-zoom-in object-contain object-center p-4"
                    onClick={(event) => {
                      event.stopPropagation();
                      setPreviewImage({ url: teamLogoUrl, title: `${team.name} ${t('teams_image', 'Team image')}` });
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
                    <p className="mt-1 text-sm text-gray-600 line-clamp-2">{team.description || t('teams_no_description', 'No description available.')}</p>
                  </div>
                  <Badge tone="gray">{t('profile_members_count', '{{count}} members', { count: team.memberCount || 0 })}</Badge>
                </div>
              </div>

              <div className="px-6 text-sm text-gray-600 space-y-1">
                <div>{t('teams_captain_label', 'Captain: {{name}}', { name: team.captain?.firstName || team.captain?.username || t('common_unknown', 'Unknown') })}</div>
                {team.homeField?.name && <div>{t('teams_home_field', 'Home Field: {{name}}', { name: team.homeField.name })}</div>}
                {team.skillLevel && (
                  <div className="flex items-center gap-2">
                    <span>{t('teams_skill', 'Skill:')}</span>
                    <Badge tone="green" className="capitalize">
                      {translateSkillLevel(team.skillLevel, t)}
                    </Badge>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span>{t('teams_jersey', 'Jersey:')}</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-1">
                      {jerseyColors.map((color, index) => (
                        <span key={`${color}-${index}`} className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: color }} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex gap-2 p-6 pt-5">
                <Button
                  as={Link}
                  to={`/teams/${team.id}`}
                  onClick={(event) => event.stopPropagation()}
                  variant="outline"
                  className="flex-1"
                >
                  {t('teams_view_details', 'View Details')}
                </Button>

                {isAdmin ? (
                  <Button
                    onClick={(event) => {
                      event.stopPropagation();
                      openDeleteDialog(team);
                    }}
                    className="flex-1 bg-red-600 hover:bg-red-700"
                    disabled={deletingTeamId === team.id}
                  >
                    {deletingTeamId === team.id ? t('settings_deleting', 'Deleting...') : t('teams_delete', 'Delete')}
                  </Button>
                ) : joinRequestPending ? (
                  <Button
                    disabled
                    className="flex-1 bg-amber-100 text-amber-800 hover:bg-amber-100"
                  >
                    {t('teams_request_pending', 'Request Pending')}
                  </Button>
                ) : canRequestJoin(team) ? (
                  <Button
                    onClick={(event) => {
                      event.stopPropagation();
                      handleRequestJoin(team.id);
                    }}
                    className="flex-1"
                  >
                    {t('teams_request_join', 'Request Join')}
                  </Button>
                ) : team.captainId === user?.id ? (
                  <Button
                    disabled
                    className="flex-1"
                  >
                    {t('teams_your_team', 'Your Team')}
                  </Button>
                ) : (
                  <Button
                    onClick={(event) => {
                      event.stopPropagation();
                      navigate('/login', { state: { from: `/teams/${team.id}`, backgroundLocation: location } });
                    }}
                    className="flex-1"
                  >
                    {t('teams_login_to_join', 'Login to Join')}
                  </Button>
                )}
              </div>
            </div>
          )})
        ) : (
          <div className="col-span-full">
            <EmptyState
              icon={UsersIcon}
              title={t('teams_none_found', 'No teams found')}
              description={
                searchTerm || searchScope !== 'all'
                  ? t('teams_search_empty_desc', 'Try a different search or clear the filter to browse all public teams.')
                  : t('teams_public_empty_desc', 'Check back later, or register as a captain to create a team.')
              }
            />
          </div>
        )}
      </div>

      {deleteDialogOpen && teamToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
            <div className="border-b border-gray-200 px-5 py-4">
              <h2 className="text-lg font-semibold text-gray-900">{t('teams_delete_modal_title', 'Delete Team')}</h2>
              <p className="mt-1 text-sm text-gray-600">
                {t('teams_delete_modal_desc', 'Send a message to captain before deleting {{team}}.', { team: teamToDelete.name })}
              </p>
            </div>
            <div className="px-5 py-4">
              <label className="mb-2 block text-sm font-medium text-gray-700">{t('teams_message_to_captain', 'Message to captain')}</label>
              <textarea
                value={deleteMessage}
                onChange={(e) => setDeleteMessage(e.target.value)}
                rows={4}
                placeholder={t('teams_delete_reason_placeholder', 'Explain why this team is being deleted...')}
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
                {t('action_cancel', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={handleDeleteTeam}
                disabled={deletingTeamId === teamToDelete.id}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deletingTeamId === teamToDelete.id ? t('settings_deleting', 'Deleting...') : t('teams_send_delete', 'Send & Delete')}
              </button>
            </div>
          </div>
        </div>
      )}
      <ImagePreviewModal
        open={Boolean(previewImage)}
        imageUrl={previewImage?.url}
        title={previewImage?.title || t('teams_image', 'Team image')}
        onClose={() => setPreviewImage(null)}
      />
    </div>
  );
};

export default PublicTeamsPage;
