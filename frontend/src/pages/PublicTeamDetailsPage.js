import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import teamService from '../services/teamService';
import { UsersIcon, MapPinIcon, TrophyIcon, CalendarDaysIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { ImagePreviewModal, useToast } from '../components/ui';
import { getTeamJerseyColors } from '../utils/teamColors';
import { buildGoogleMapsLocationUrl, buildLocationLabel } from '../utils/googleMaps';

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

// Render the public team details page.
const PublicTeamDetailsPage = () => {
  const { id } = useParams();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState({ stats: { total: 0, wins: 0, losses: 0, draws: 0 }, matches: [] });
  const [historyAvailable, setHistoryAvailable] = useState(true);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const { showSuccess, showError } = useToast();

  // Check whether request join is allowed.
  const canRequestJoin = () => {
    if (!isAuthenticated) return false;
    if (!user) return false;
    if (!['player', 'captain', 'field_owner', 'admin'].includes(user?.role || '')) return false;
    // Prevent captains from joining their own teams
    if (team?.captainId === user?.id) return false;
    return true;
  };
  const joinRequestPending = team?.joinRequestPending || team?.userMembershipStatus === 'pending';

  useEffect(() => {
    // Support fetch team and history for this page.
    const fetchTeamAndHistory = async () => {
      try {
        setLoading(true);
        setError(null);
        const [teamResponse, historyResponse] = await Promise.all([
          teamService.getPublicTeamById(id),
          teamService.getPublicTeamMatchHistory(id, { limit: 5 }).catch(() => null)
        ]);

        setTeam(teamResponse.data || null);

        const historyData = historyResponse?.data;
        if (historyData && (Array.isArray(historyData.matches) || historyData.stats)) {
          setHistory({
            stats: historyData.stats || { total: 0, wins: 0, losses: 0, draws: 0 },
            matches: Array.isArray(historyData.matches) ? historyData.matches : []
          });
          setHistoryAvailable(true);
        } else {
          setHistoryAvailable(false);
        }
      } catch (err) {
        console.error('Failed to fetch team:', err);
        setError('Failed to load team');
      } finally {
        setLoading(false);
      }
    };

    fetchTeamAndHistory();
  }, [id]);

  // Handle request join interactions.
  const handleRequestJoin = async () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/teams/${id}`, backgroundLocation: location } });
      return;
    }

    try {
      setError(null);
      const response = await teamService.joinTeam(id);
      if (response.success) {
        setTeam((prev) => (
          prev
            ? {
                ...prev,
                joinRequestPending: true,
                userMembershipStatus: 'pending'
              }
            : prev
        ));
        showSuccess('Join request submitted. Waiting for captain approval.');
      }
    } catch (err) {
      if ((err?.error || '').toLowerCase().includes('already pending')) {
        setTeam((prev) => (
          prev
            ? {
                ...prev,
                joinRequestPending: true,
                userMembershipStatus: 'pending'
              }
            : prev
        ));
        showSuccess('Your join request is still waiting for captain approval.');
        setError(null);
        return;
      }
      showError(err?.error || 'Failed to submit join request');
    }
  };

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
        <Link to="/teams" className="mt-4 inline-block text-green-700 hover:text-green-800">
          Back to Teams
        </Link>
      </div>
    );
  }

  const teamLogoUrl = resolveTeamLogoUrl(team.logoUrl || team.logo_url || team.logo);
  const jerseyColors = getTeamJerseyColors(team);
  const recentMatches = Array.isArray(history.matches) ? history.matches.slice(0, 5) : [];
  const homeFieldAddress = buildLocationLabel(team.homeField || {});
  const homeFieldLocationUrl = buildGoogleMapsLocationUrl(team.homeField || {});

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="h-52 bg-gray-100 relative">
          <div className="absolute inset-0 flex items-center justify-center">
            <UsersIcon className="h-16 w-16 text-gray-300" />
          </div>
          {teamLogoUrl && (
            <img
              src={teamLogoUrl}
              alt={`${team.name} logo`}
              className="relative z-10 h-full w-full cursor-zoom-in object-contain p-4"
              onClick={() => setImagePreviewOpen(true)}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          )}
        </div>
        <div className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{team.name}</h1>
            <p className="mt-1 text-sm text-gray-600">
              Captain: {team.captain?.firstName || team.captain?.username || 'Unknown'}
            </p>
          </div>
          <div className="text-sm text-gray-600 flex items-center">
            <UsersIcon className="h-5 w-5 mr-1 text-gray-400" />
            {team.memberCount || 0} members
          </div>
        </div>

        {team.description && <p className="mt-4 text-gray-700">{team.description}</p>}

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
          {team.homeField && (
            <div className="flex items-start">
              <MapPinIcon className="h-5 w-5 mr-2 text-gray-400 mt-0.5" />
              <div>
                <div className="font-medium text-gray-900">Home Field</div>
                <div>{team.homeField.name}</div>
                {homeFieldAddress && <div className="text-xs text-gray-500">{homeFieldAddress}</div>}
                {homeFieldLocationUrl && (
                  <a
                    href={homeFieldLocationUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
                  >
                    <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                    Location
                  </a>
                )}
              </div>
            </div>
          )}

          {team.skillLevel && (
            <div>
              <div className="font-medium text-gray-900">Skill Level</div>
              <div className="capitalize">{team.skillLevel}</div>
            </div>
          )}

          <div>
            <div className="font-medium text-gray-900">Jersey Colors</div>
            <div className="mt-1 inline-flex items-center gap-1.5">
              {jerseyColors.map((color, index) => (
                <span key={`${color}-${index}`} className="h-4 w-4 rounded-full border border-gray-300" style={{ backgroundColor: color }} />
              ))}
            </div>
          </div>

          <div>
            <div className="font-medium text-gray-900">Team Created</div>
            <div>{team.createdAt ? new Date(team.createdAt).toLocaleDateString() : 'Not available'}</div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="text-xs text-gray-500">Matches</div>
            <div className="text-lg font-semibold text-gray-900">{history.stats?.total || 0}</div>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <div className="text-xs text-emerald-700">Wins</div>
            <div className="text-lg font-semibold text-emerald-800">{history.stats?.wins || 0}</div>
          </div>
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
            <div className="text-xs text-rose-700">Losses</div>
            <div className="text-lg font-semibold text-rose-800">{history.stats?.losses || 0}</div>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <div className="text-xs text-amber-700">Draws</div>
            <div className="text-lg font-semibold text-amber-800">{history.stats?.draws || 0}</div>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-900 inline-flex items-center gap-2">
              <TrophyIcon className="h-4 w-4 text-gray-500" />
              Recent Match History
            </h2>
            <span className="text-xs text-gray-500">Last 5 matches</span>
          </div>

          <div className="p-4">
            {!historyAvailable ? (
              <p className="text-sm text-gray-500">Match history is not available for this team yet.</p>
            ) : recentMatches.length === 0 ? (
              <p className="text-sm text-gray-500">No completed matches recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {recentMatches.map((match, idx) => (
                  <div key={match.id || `${match.opponentTeamName || 'opponent'}-${idx}`} className="flex items-center justify-between rounded-md border border-gray-200 p-3">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{match.opponentTeamName || 'Opponent'}</div>
                      <div className="text-xs text-gray-500 inline-flex items-center gap-1 mt-1">
                        <CalendarDaysIcon className="h-3.5 w-3.5" />
                        {match.dateTime ? new Date(match.dateTime).toLocaleDateString() : 'Date unavailable'}
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-gray-800">{match.result || match.score || '-'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md text-sm">
            {error}
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/teams"
            className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Back to Teams
          </Link>

          {joinRequestPending ? (
            <button
              disabled
              className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium text-amber-800 bg-amber-100"
            >
              Request Pending
            </button>
          ) : canRequestJoin() ? (
            <button
              onClick={handleRequestJoin}
              className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700"
            >
              Request to Join
            </button>
          ) : team?.captainId === user?.id ? (
            <button
              disabled
              className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium text-gray-500 bg-gray-300"
            >
              Your Team
            </button>
          ) : (
            <button
              onClick={() => navigate('/login', { state: { from: `/teams/${id}`, backgroundLocation: location } })}
              className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700"
            >
              Login to Request
            </button>
          )}
        </div>
        </div>
      </div>
      <ImagePreviewModal
        open={imagePreviewOpen}
        imageUrl={teamLogoUrl}
        title={`${team.name} image`}
        onClose={() => setImagePreviewOpen(false)}
      />
    </div>
  );
};

export default PublicTeamDetailsPage;

