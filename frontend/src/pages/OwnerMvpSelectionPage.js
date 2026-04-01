import React, { useEffect, useMemo, useState } from 'react';
import { TrophyIcon, CalendarIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import { useRealtime } from '../context/RealtimeContext';
import ownerMvpService from '../services/ownerMvpService';
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Spinner } from '../components/ui';

const OwnerMvpSelectionPage = () => {
  const { version } = useRealtime();
  const [matches, setMatches] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const loadMatches = async () => {
    const response = await ownerMvpService.getCompletedMatches();
    const rows = Array.isArray(response.data) ? response.data : [];
    setMatches(rows);
    setDrafts((prev) => {
      const next = { ...prev };
      rows.forEach((match) => {
        if (next[match.id] === undefined) {
          next[match.id] = match?.matchResult?.mvpPlayerId ? String(match.matchResult.mvpPlayerId) : '';
        }
      });
      return next;
    });
  };

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        await loadMatches();
      } catch (err) {
        setError(err?.error || 'Failed to load completed matches');
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [version]);

  const sortedMatches = useMemo(
    () => [...matches].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()),
    [matches]
  );

  const updateDraft = (bookingId, value) => {
    setDrafts((prev) => ({ ...prev, [bookingId]: value }));
  };

  const saveMvp = async (match) => {
    const selectedPlayerId = Number(drafts[match.id]);
    if (!Number.isInteger(selectedPlayerId) || selectedPlayerId <= 0) {
      setError('Please choose one player before saving MVP.');
      return;
    }

    try {
      setSavingId(match.id);
      setError(null);
      setSuccessMessage(null);
      const response = await ownerMvpService.setMvp(match.id, selectedPlayerId);
      const updated = response?.data;

      setMatches((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setDrafts((prev) => ({ ...prev, [match.id]: String(selectedPlayerId) }));
      setSuccessMessage('MVP saved successfully.');
    } catch (err) {
      setError(err?.error || 'Failed to save MVP');
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">MVP Selection</h1>
        <p className="mt-1 text-sm text-gray-600">Real completed matches from your fields. Select one player and save MVP.</p>
      </div>

      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md text-sm">{successMessage}</div>
      )}
      {error && <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md text-sm">{error}</div>}

      <Card>
        <CardHeader className="px-6 py-4 flex items-center justify-between">
          <div className="text-sm font-semibold text-gray-900">Completed Matches</div>
          <Badge tone="blue">{sortedMatches.length} matches</Badge>
        </CardHeader>

        <div className="border-t border-gray-200">
          {sortedMatches.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={TrophyIcon}
                title="No completed matches"
                description="Completed matches with saved results will appear here for MVP selection."
              />
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {sortedMatches.map((match) => {
                const selectedValue = drafts[match.id] ?? '';
                const currentMvpName =
                  match?.matchResult?.mvpPlayer?.firstName || match?.matchResult?.mvpPlayer?.lastName
                    ? `${match.matchResult.mvpPlayer.firstName || ''} ${match.matchResult.mvpPlayer.lastName || ''}`.trim()
                    : match?.matchResult?.mvpPlayer?.username || null;

                return (
                  <div key={match.id} className="p-4 sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge tone="blue">Completed</Badge>
                          <span className="text-sm font-semibold text-gray-900">
                            {match.team?.name || 'Team A'} vs {match.opponentTeam?.name || 'Team B'}
                          </span>
                        </div>
                        <div className="mt-2 text-xs text-gray-600 inline-flex items-center gap-1">
                          <CalendarIcon className="h-4 w-4 text-gray-400" />
                          {match?.startTime ? new Date(match.startTime).toLocaleString() : '-'}
                        </div>
                        <div className="mt-1 text-xs text-gray-500">{match.field?.name || 'Field'}</div>
                      </div>

                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-center min-w-[96px]">
                        <div className="text-xl font-bold text-gray-900 leading-none">
                          {match?.matchResult ? `${match.matchResult.homeScore} : ${match.matchResult.awayScore}` : '- : -'}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                      <div>
                        <label className="block text-xs font-medium text-gray-700">Choose MVP Player</label>
                        <select
                          value={selectedValue}
                          onChange={(e) => updateDraft(match.id, e.target.value)}
                          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                          disabled={!match?.matchResult?.id || savingId === match.id}
                        >
                          <option value="">Select one player</option>
                          {match.eligiblePlayers.map((player) => (
                            <option key={player.id} value={player.id}>
                              {player.name} ({player.teamName})
                            </option>
                          ))}
                        </select>
                        <div className="mt-2 text-xs text-gray-500 inline-flex items-center gap-1">
                          <UserCircleIcon className="h-4 w-4" />
                          {currentMvpName ? `Current MVP: ${currentMvpName}` : 'No MVP selected yet'}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          disabled={!match?.matchResult?.id || savingId === match.id}
                          onClick={() => saveMvp(match)}
                        >
                          {savingId === match.id ? 'Saving...' : match?.matchResult?.mvpPlayerId ? 'Update MVP' : 'Set MVP'}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <CardBody className="px-6 py-4 text-xs text-gray-500">
          Only completed matches with a saved match result are eligible for MVP selection.
        </CardBody>
      </Card>
    </div>
  );
};

export default OwnerMvpSelectionPage;
