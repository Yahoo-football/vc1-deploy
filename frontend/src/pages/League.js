import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CalendarIcon, 
  TrophyIcon, 
  UsersIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  MinusIcon
} from '@heroicons/react/24/outline';

const APP_TIMEZONE = process.env.REACT_APP_TIMEZONE || 'Asia/Bangkok';
const PUBLIC_URL = process.env.PUBLIC_URL || '';

// Get public asset url for the current view.
const getPublicAssetUrl = (assetPath) => {
  const normalizedPath = assetPath.startsWith('/') ? assetPath : `/${assetPath}`;
  return `${PUBLIC_URL}${encodeURI(normalizedPath)}`;
};

const LEAGUES = [
  {
    code: 'PL',
    name: 'Premier League',
    logo: getPublicAssetUrl('/logos/PremierLeague.svg')
  },
  {
    code: 'PD',
    name: 'La Liga',
    logo: getPublicAssetUrl('/logos/Laliga.svg')
  },
  {
    code: 'SA',
    name: 'Serie A',
    logo: getPublicAssetUrl('/logos/SerieA.svg')
  },
  {
    code: 'BL1',
    name: 'Bundesliga',
    logo: getPublicAssetUrl('/logos/Bundesliga.svg')
  },
  {
    code: 'FL1',
    name: 'Ligue 1',
    logo: getPublicAssetUrl('/logos/Ligue1.svg')
  }
];

// Get date parts in timezone for the current view.
const getDatePartsInTimezone = (value, timeZone) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(new Date(value));
  const year = Number(parts.find(part => part.type === 'year')?.value);
  const month = Number(parts.find(part => part.type === 'month')?.value);
  const day = Number(parts.find(part => part.type === 'day')?.value);
  return { year, month, day };
};

// Format date key in timezone for display.
const formatDateKeyInTimezone = (value, timeZone) => {
  const { year, month, day } = getDatePartsInTimezone(value, timeZone);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

// Get today anchor in timezone for the current view.
const getTodayAnchorInTimezone = (timeZone) => {
  const { year, month, day } = getDatePartsInTimezone(new Date(), timeZone);
  return new Date(Date.UTC(year, month - 1, day));
};

// Get week date items for the current view.
const getWeekDateItems = () => {
  const anchor = getTodayAnchorInTimezone(APP_TIMEZONE);
  const start = new Date(anchor);
  start.setUTCDate(anchor.getUTCDate() - 1); // yesterday

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    const dateISO = formatDateKeyInTimezone(date, APP_TIMEZONE);

    let label = '';
    if (index === 0) label = 'Yesterday';
    else if (index === 1) label = 'Today';
    else if (index === 2) label = 'Tomorrow';
    else {
      const day = new Intl.DateTimeFormat('en-US', { timeZone: APP_TIMEZONE, day: '2-digit' }).format(date);
      const weekday = new Intl.DateTimeFormat('en-US', { timeZone: APP_TIMEZONE, weekday: 'short' }).format(date);
      label = `${day} ${weekday}`;
    }

    return { dateISO, label };
  });
};

// Render the league page.
const League = () => {
  const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';
  const [activeTab, setActiveTab] = useState('matches');
  const [matches, setMatches] = useState([]);
  const [standings, setStandings] = useState([]);
  const [selectedLeague, setSelectedLeague] = useState('PL');
  const [weekDates] = useState(() => getWeekDateItems());
  const [selectedDateKey, setSelectedDateKey] = useState(() => getWeekDateItems()[1]?.dateISO || '');
  const [loading, setLoading] = useState(false);

  const fetchLeagueData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch matches from backend with league filter
      const matchesResponse = await fetch(`${API_BASE_URL}/matches?league=${selectedLeague}`);
      if (!matchesResponse.ok) {
        throw new Error(`Matches request failed: ${matchesResponse.status}`);
      }
      const matchesData = await matchesResponse.json();
      
      // Extract matches from grouped data structure
      const allMatches = [];
      if (Array.isArray(matchesData)) {
        matchesData.forEach(dateGroup => {
          if (dateGroup.matches && Array.isArray(dateGroup.matches)) {
            allMatches.push(...dateGroup.matches);
          }
        });
      }

      setMatches(allMatches);

      // Fetch standings from backend
      const standingsResponse = await fetch(`${API_BASE_URL}/leagues/standings?league=${selectedLeague}`);
      if (!standingsResponse.ok) {
        throw new Error(`Standings request failed: ${standingsResponse.status}`);
      }
      const standingsData = await standingsResponse.json();
      setStandings(standingsData[selectedLeague]?.table || []);
    } catch (error) {
      console.error('Error fetching league data:', error);
      // Set empty arrays when backend is not available
      setMatches([]);
      setStandings([]);
    } finally {
      setLoading(false);
    }
  }, [API_BASE_URL, selectedLeague]);

  useEffect(() => {
    fetchLeagueData();
  }, [fetchLeagueData]);

  // Get form icon for the current view.
  const getFormIcon = (form) => {
    if (!form) return <MinusIcon className="w-4 h-4 text-gray-400" />;
    
    const lastResult = form[form.length - 1];
    switch (lastResult) {
      case 'W':
        return <ArrowTrendingUpIcon className="w-4 h-4 text-green-500" />;
      case 'L':
        return <ArrowTrendingDownIcon className="w-4 h-4 text-red-500" />;
      case 'D':
        return <MinusIcon className="w-4 h-4 text-yellow-500" />;
      default:
        return <MinusIcon className="w-4 h-4 text-gray-400" />;
    }
  };

  // Get position color for the current view.
  const getPositionColor = (position) => {
    if (position <= 4) return 'text-green-600 font-bold'; // Champions League
    if (position <= 6) return 'text-blue-600'; // Europa League
    if (position >= 18) return 'text-red-600'; // Relegation
    return 'text-gray-800';
  };

  // Format match date for display.
  const formatMatchDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      timeZone: APP_TIMEZONE,
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get match status for the current view.
  const getMatchStatus = (status) => {
    switch (status) {
      case 'FINISHED':
        return { text: 'Full Time', color: 'text-green-600' };
      case 'IN_PLAY':
        return { text: 'Live', color: 'text-red-600' };
      case 'POSTPONED':
        return { text: 'Postponed', color: 'text-gray-500' };
      default:
        return { text: 'Upcoming', color: 'text-blue-600' };
    }
  };

  // Get match date key for the current view.
  const getMatchDateKey = (dateString) => formatDateKeyInTimezone(dateString, APP_TIMEZONE);
  const matchDateKeys = useMemo(
    () => new Set(matches.map(match => getMatchDateKey(match.dateTime))),
    [matches]
  );
  const hasMatchesForDate = useCallback(
    (dateISO) => matchDateKeys.has(dateISO),
    [matchDateKeys]
  );
  const filteredMatches = matches.filter(match => getMatchDateKey(match.dateTime) === selectedDateKey);

  useEffect(() => {
    if (matches.length === 0) return;

    if (!hasMatchesForDate(selectedDateKey)) {
      const todayItem = weekDates[1];
      const fallback =
        (todayItem && hasMatchesForDate(todayItem.dateISO) && todayItem) ||
        weekDates.find(item => hasMatchesForDate(item.dateISO));

      if (fallback) {
        setSelectedDateKey(fallback.dateISO);
      }
    }
  }, [matches, selectedDateKey, weekDates, hasMatchesForDate]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-3">
            <h1 className="text-lg sm:text-2xl font-bold text-gray-900">Football Leagues</h1>
            <div className="hidden sm:block text-sm text-gray-500">Live scores and standings</div>
          </div>
        </div>
      </div>

      {/* League Selector */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1 overflow-x-auto py-2">
            {LEAGUES.map((league) => (
              <button
                key={league.code}
                onClick={() => {
                  setSelectedLeague(league.code);
                }}
                aria-label={league.name}
                title={league.name}
                className={`w-16 h-16 rounded-2xl transition-colors flex items-center justify-center ${
                  selectedLeague === league.code
                    ? 'bg-blue-600'
                    : 'bg-white hover:bg-gray-100 border border-gray-200'
                }`}
              >
                <div className="w-9 h-9 flex items-center justify-center">
                  <img
                    src={league.logo}
                    alt={league.name}
                    className="max-w-full max-h-full object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-5 sm:space-x-8">
            <button
              onClick={() => setActiveTab('matches')}
              className={`py-4 px-1 border-b-2 font-medium text-sm sm:text-base transition-colors ${
                activeTab === 'matches'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4" />
                Matches
              </div>
            </button>
            <button
              onClick={() => setActiveTab('table')}
              className={`py-4 px-1 border-b-2 font-medium text-sm sm:text-base transition-colors ${
                activeTab === 'table'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <TrophyIcon className="w-4 h-4" />
                Table
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading league data...</p>
          </div>
        ) : (
          <>
            {activeTab === 'matches' && (
              <div className="space-y-6">
                <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto pb-2">
                  {weekDates.map((item) => (
                    <button
                      key={item.dateISO}
                      onClick={() => setSelectedDateKey(item.dateISO)}
                      disabled={!hasMatchesForDate(item.dateISO)}
                      className={`min-w-[104px] sm:min-w-[132px] px-2.5 sm:px-4 py-2 sm:py-3 rounded-2xl border text-xs sm:text-base font-semibold tracking-tight transition-all duration-200 ${
                        selectedDateKey === item.dateISO
                          ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm'
                          : hasMatchesForDate(item.dateISO)
                            ? 'border-gray-200 text-gray-800 bg-white hover:border-blue-300 hover:text-blue-700 hover:shadow-sm'
                            : 'border-gray-200 text-gray-400 bg-gray-100 cursor-not-allowed opacity-70'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <h2 className="text-base sm:text-xl font-bold text-gray-900 mb-4">Latest Matches</h2>
                <div className="space-y-4">
                  {filteredMatches.map((match, index) => {
                    const status = getMatchStatus(match.status);
                    const hasResult =
                      match.homeTeam.score !== null && match.awayTeam.score !== null;
                    return (
                      <div key={`${match.id}-${index}`} className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-start mb-4">
                          <div className="flex items-center gap-2 text-[11px] sm:text-sm text-gray-500 min-w-0">
                            <CalendarIcon className="w-4 h-4" />
                            <span className="truncate">{formatMatchDate(match.dateTime)}</span>
                          </div>
                          <span className={`self-start text-[10px] sm:text-xs font-medium px-2 py-1 rounded-full ${
                            status.color === 'text-red-600' ? 'bg-red-100 text-red-700' :
                            status.color === 'text-green-600' ? 'bg-green-100 text-green-700' :
                            status.color === 'text-blue-600' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {status.text}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-4">
                          <div className="flex flex-col items-center text-center min-w-0">
                            {match.homeTeam.logo && (
                              <img 
                                src={match.homeTeam.logo} 
                                alt={match.homeTeam.name} 
                                className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 object-contain flex-shrink-0"
                              />
                            )}
                            <span
                              className="mt-2 font-medium text-gray-900 text-[11px] sm:text-sm md:text-base leading-tight break-words overflow-hidden"
                              style={{
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical'
                              }}
                            >
                              {match.homeTeam.name}
                            </span>
                          </div>
                          
                          <div className="px-2.5 sm:px-4 py-2 sm:py-2.5 bg-gray-100 rounded-lg min-w-[78px] sm:min-w-[96px] text-center flex-shrink-0">
                            <span className="text-base sm:text-xl md:text-2xl font-bold text-gray-900 leading-none">
                              {hasResult
                                ? `${match.homeTeam.score} : ${match.awayTeam.score}`
                                : '- : -'}
                            </span>
                          </div>
                          
                          <div className="flex flex-col items-center text-center min-w-0">
                            {match.awayTeam.logo && (
                              <img 
                                src={match.awayTeam.logo} 
                                alt={match.awayTeam.name} 
                                className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 object-contain flex-shrink-0"
                              />
                            )}
                            <span
                              className="mt-2 font-medium text-gray-900 text-[11px] sm:text-sm md:text-base leading-tight break-words overflow-hidden"
                              style={{
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical'
                              }}
                            >
                              {match.awayTeam.name}
                            </span>
                          </div>
                        </div>
                        
                        <div className="mt-4 text-xs text-gray-500 flex items-center gap-1">
                          <UsersIcon className="w-3 h-3" />
                          {match.competition}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {filteredMatches.length === 0 && (
                  <div className="bg-white border border-gray-200 rounded-lg p-6 text-center text-gray-600">
                    No matches for this date.
                  </div>
                )}
              </div>
            )}

            {activeTab === 'table' && (
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-4">League Table</h2>
                <div className="bg-white rounded-lg shadow-md overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">MP</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">W</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">D</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">L</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">GD</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Pts</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Form</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {standings.map((team, index) => (
                          <tr key={team.position} className="hover:bg-gray-50 transition-colors">
                            <td className={`px-4 py-3 text-sm ${getPositionColor(index + 1)}`}>
                              {index + 1}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <div className="flex items-center gap-3">
                                {team.logo && (
                                  <img 
                                    src={team.logo} 
                                    alt={team.team} 
                                    className="w-6 h-6 object-contain"
                                  />
                                )}
                                <span className="font-medium text-gray-900">{team.team}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-center text-gray-600">{team.playedGames}</td>
                            <td className="px-4 py-3 text-sm text-center text-green-600 font-medium">{team.won}</td>
                            <td className="px-4 py-3 text-sm text-center text-yellow-600">{team.draw}</td>
                            <td className="px-4 py-3 text-sm text-center text-red-600">{team.lost}</td>
                            <td className="px-4 py-3 text-sm text-center text-gray-600">{team.goalDifference || '-'}</td>
                            <td className="px-4 py-3 text-sm text-center font-bold text-gray-900">{team.points}</td>
                            <td className="px-4 py-3 text-sm">
                              <div className="flex items-center gap-1">
                                {getFormIcon(team.form)}
                                <span className="text-xs text-gray-500">{team.form || '-'}</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
export default League;
