import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../context/RealtimeContext';
import { useLanguage } from '../context/LanguageContext';
import apiService from '../services/api';
import authService from '../services/authService';
import bookingService from '../services/bookingService';
import fieldService from '../services/fieldService';
import teamService from '../services/teamService';
import userService from '../services/userService';
import { formatRoleLabel } from '../utils/formatters';
import {
  ArrowRightIcon,
  BanknotesIcon,
  BellAlertIcon,
  BuildingOfficeIcon,
  CalendarIcon,
  CheckIcon,
  ClipboardDocumentCheckIcon,
  UserCircleIcon,
  XMarkIcon,
  TrophyIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';
import { AnimatedStatValue, Badge, Button, Card, CardBody, CardHeader, EmptyState, Spinner } from '../components/ui';
import {
  buildPaymentRoleBreakdown,
  buildPaymentSummary,
  buildPaymentTimeline,
  formatUsd,
  getPaymentStatusPercentages
} from '../utils/adminPayments';

// Support status tone for this page.
const statusTone = (status) => {
  const tones = { pending: 'yellow', confirmed: 'green', cancellation_pending: 'orange', completed: 'blue', cancelled: 'red' };
  return tones[status] || 'gray';
};

const statusTranslationKey = (status) => {
  const map = {
    pending: 'common_pending',
    confirmed: 'common_confirmed',
    cancellation_pending: 'owner_bookings_cancellation_pending',
    completed: 'common_completed',
    cancelled: 'common_cancelled'
  };
  return map[status] || null;
};

const roleTheme = {
  captain: {
    badge: 'Captain Overview',
    description: 'Manage your teams, approve join requests, and keep bookings under control.',
    accent: 'from-emerald-50 via-white to-blue-50'
  },
  field_owner: {
    badge: 'Field Owner App View',
    description: 'Use the app workspace to manage teams, review invitations, and create bookings as an owner.',
    accent: 'from-sky-50 via-white to-emerald-50'
  },
  player: {
    badge: 'Player Overview',
    description: 'Track invitations, team activity, and your next bookings in one place.',
    accent: 'from-blue-50 via-white to-violet-50'
  },
  admin: {
    badge: 'Platform Overview',
    description: 'Review account activity, role requests, and the latest bookings across the app.',
    accent: 'from-slate-50 via-white to-amber-50'
  },
  unknown: {
    badge: 'Account Overview',
    description: 'Review your latest activity and updates.',
    accent: 'from-slate-50 via-white to-slate-100'
  }
};

// Render the dashboard page.
const DashboardPage = () => {
  const { user } = useAuth();
  const { version } = useRealtime();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const role = user?.role;
  const isCaptain = role === 'captain';
  const isFieldOwner = role === 'field_owner';
  const isPlayerWorkspace = role === 'player' || isFieldOwner;
  const canCreateBooking = isCaptain || isFieldOwner;

  const [stats, setStats] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [myTeams, setMyTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [adminRoleRequests, setAdminRoleRequests] = useState([]);
  const [captainedTeams, setCaptainedTeams] = useState([]);
  const [joinRequestsByTeam, setJoinRequestsByTeam] = useState([]);
  const [inviteActionLoading, setInviteActionLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Support load for this page.
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        if (!role) {
          setStats({ role: 'unknown', fields: 0, teams: 0, bookings: 0, activeBookings: 0 });
          setBookings([]);
          setMyTeams([]);
          setUsers([]);
          setAdminRoleRequests([]);
          setCaptainedTeams([]);
          setJoinRequestsByTeam([]);
          return;
        }

        const [statsRes, bookingsRes, myTeamsRes, captainedRes, fieldsRes, notificationsRes, usersRes, adminRequestsRes] =
          await Promise.all([
            apiService.get('/dashboard/stats'),
            bookingService.getAllBookings({ limit: 50 }),
            role === 'player' || role === 'captain' || role === 'field_owner'
              ? teamService.getMyTeams()
              : Promise.resolve({ data: [] }),
            isCaptain ? teamService.getCaptainedTeams() : Promise.resolve({ data: [] }),
            fieldService.getAllFields({ limit: 50, status: 'available' }),
            apiService.get('/notifications'),
            role === 'admin' ? userService.getAllUsers() : Promise.resolve({ data: [] }),
            role === 'admin' ? authService.getAdminRoleRequests('') : Promise.resolve({ data: { requests: [] } })
          ]);

        const statsData = statsRes.data && typeof statsRes.data === 'object' ? statsRes.data : {};
        const bookingData = Array.isArray(bookingsRes.data) ? bookingsRes.data : [];
        const myTeamsData = Array.isArray(myTeamsRes.data) ? myTeamsRes.data : [];
        const captainedData = Array.isArray(captainedRes.data) ? captainedRes.data : [];
        const fieldsData = Array.isArray(fieldsRes.data) ? fieldsRes.data : [];
        const notificationsData = Array.isArray(notificationsRes.data) ? notificationsRes.data : [];
        const usersData = Array.isArray(usersRes.data) ? usersRes.data : [];
        const adminRequestsData = Array.isArray(adminRequestsRes.data?.requests) ? adminRequestsRes.data.requests : [];

        setStats({
          role,
          ...statsData,
          fields: statsData.fields ?? fieldsData.length
        });
        setBookings(bookingData);
        setMyTeams(myTeamsData);
        setUsers(usersData);
        setNotifications(notificationsData);
        setAdminRoleRequests(adminRequestsData);
        setCaptainedTeams(captainedData);

        if (isCaptain) {
          const requests = await Promise.all(
            captainedData.map(async (team) => {
              const response = await teamService.getJoinRequests(team.id);
              const pending = Array.isArray(response.data) ? response.data : [];
              return { teamId: team.id, teamName: team.name, pendingCount: pending.length };
            })
          );
          setJoinRequestsByTeam(requests.filter((item) => item.pendingCount > 0).sort((a, b) => b.pendingCount - a.pendingCount));
        } else {
          setJoinRequestsByTeam([]);
        }
      } catch (err) {
        setError(err?.error || t('dashboard_load_failed', 'Failed to load dashboard'));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [isCaptain, role, t, version]);

  const upcomingBookings = useMemo(() => {
    const now = Date.now();
    return bookings
      .filter((booking) => booking?.startTime && (booking.status === 'pending' || booking.status === 'confirmed'))
      .filter((booking) => new Date(booking.startTime).getTime() >= now)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      .slice(0, 5);
  }, [bookings]);

  const statCards = useMemo(() => {
    if (isCaptain) {
      const pendingJoinRequests =
        stats?.pendingJoinRequests ?? joinRequestsByTeam.reduce((sum, item) => sum + item.pendingCount, 0);

      return [
        {
          name: t('dashboard_captained_teams', 'Captained Teams'),
          value: captainedTeams.length,
          icon: TrophyIcon,
          iconWrap: 'bg-emerald-600',
          cardClass: 'border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-emerald-100/70',
          textClass: 'text-emerald-950'
        },
        {
          name: t('stat_pending_requests', 'Pending Requests'),
          value: pendingJoinRequests,
          icon: ClipboardDocumentCheckIcon,
          iconWrap: 'bg-amber-500',
          cardClass: 'border-amber-100 bg-gradient-to-br from-amber-50 via-white to-amber-100/70',
          textClass: 'text-amber-950'
        },
        {
          name: t('dashboard_my_bookings', 'My Bookings'),
          value: stats?.bookings ?? bookings.length,
          icon: CalendarIcon,
          iconWrap: 'bg-blue-600',
          cardClass: 'border-blue-100 bg-gradient-to-br from-blue-50 via-white to-blue-100/70',
          textClass: 'text-blue-950'
        },
        {
          name: t('dashboard_fields_available', 'Fields Available'),
          value: stats?.fields ?? 0,
          icon: BuildingOfficeIcon,
          iconWrap: 'bg-cyan-600',
          cardClass: 'border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-cyan-100/70',
          textClass: 'text-cyan-950'
        }
      ];
    }

    if (isPlayerWorkspace) {
      const pendingInvites = notifications.filter((notification) => notification.type === 'team_invite' && !notification.isRead).length;

      return [
        {
          name: t('dashboard_player_my_teams', 'My Teams'),
          value: stats?.teams ?? myTeams.length,
          icon: UserGroupIcon,
          iconWrap: 'bg-emerald-600',
          cardClass: 'border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-emerald-100/70',
          textClass: 'text-emerald-950'
        },
        {
          name: t('dashboard_player_invitations', 'Invitations'),
          value: pendingInvites,
          icon: BellAlertIcon,
          iconWrap: 'bg-amber-500',
          cardClass: 'border-amber-100 bg-gradient-to-br from-amber-50 via-white to-amber-100/70',
          textClass: 'text-amber-950'
        },
        {
          name: t('dashboard_player_team_bookings', 'Team Bookings'),
          value: stats?.bookings ?? bookings.length,
          icon: CalendarIcon,
          iconWrap: 'bg-blue-600',
          cardClass: 'border-blue-100 bg-gradient-to-br from-blue-50 via-white to-blue-100/70',
          textClass: 'text-blue-950'
        },
        {
          name: t('dashboard_player_upcoming', 'Upcoming'),
          value: upcomingBookings.length,
          icon: CheckIcon,
          iconWrap: 'bg-violet-600',
          cardClass: 'border-violet-100 bg-gradient-to-br from-violet-50 via-white to-violet-100/70',
          textClass: 'text-violet-950'
        }
      ];
    }

    const pendingRoleRequests = adminRoleRequests.filter((request) => request.status === 'pending').length;

    return [
      {
        name: 'Users',
        value: stats?.users ?? 0,
        icon: UserCircleIcon,
        iconWrap: 'bg-indigo-600',
        cardClass: 'border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-indigo-100/70',
        textClass: 'text-indigo-950'
      },
      {
        name: 'Fields',
        value: stats?.fields ?? 0,
        icon: BuildingOfficeIcon,
        iconWrap: 'bg-blue-600',
        cardClass: 'border-blue-100 bg-gradient-to-br from-blue-50 via-white to-blue-100/70',
        textClass: 'text-blue-950'
      },
      {
        name: 'Teams',
        value: stats?.teams ?? 0,
        icon: UserGroupIcon,
        iconWrap: 'bg-emerald-600',
        cardClass: 'border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-emerald-100/70',
        textClass: 'text-emerald-950'
      },
      {
        name: 'Pending Requests',
        value: pendingRoleRequests,
        icon: ClipboardDocumentCheckIcon,
        iconWrap: 'bg-amber-500',
        cardClass: 'border-amber-100 bg-gradient-to-br from-amber-50 via-white to-amber-100/70',
        textClass: 'text-amber-950'
      }
    ];
  }, [
    isCaptain,
    isPlayerWorkspace,
    stats,
    joinRequestsByTeam,
    captainedTeams.length,
    bookings.length,
    myTeams.length,
    notifications,
    upcomingBookings.length,
    adminRoleRequests,
    t
  ]);

  const pendingAdminRoleRequests = useMemo(() => {
    return adminRoleRequests
      .filter((request) => request.status === 'pending')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(0, 5);
  }, [adminRoleRequests]);

  const adminPaymentSummary = useMemo(() => buildPaymentSummary(adminRoleRequests), [adminRoleRequests]);
  const adminPaymentTimeline = useMemo(() => buildPaymentTimeline(adminRoleRequests, 6), [adminRoleRequests]);
  const adminPaymentRoleBreakdown = useMemo(() => buildPaymentRoleBreakdown(adminRoleRequests), [adminRoleRequests]);
  const adminPaymentPercentages = useMemo(
    () => getPaymentStatusPercentages(adminPaymentSummary),
    [adminPaymentSummary]
  );

  const adminPaymentTimelineMax = useMemo(() => {
    const max = Math.max(
      ...adminPaymentTimeline.map((item) => item.approvedAmount + item.pendingAmount + item.rejectedAmount),
      0
    );
    return max || 1;
  }, [adminPaymentTimeline]);

  const recentUsers = useMemo(() => {
    return [...users]
      .sort((a, b) => {
        const aTime = new Date(a.createdAt || 0).getTime();
        const bTime = new Date(b.createdAt || 0).getTime();
        if (aTime !== bTime) return bTime - aTime;
        return Number(b.id || 0) - Number(a.id || 0);
      })
      .slice(0, 5);
  }, [users]);

  const recentBookings = useMemo(() => {
    return [...bookings]
      .sort((a, b) => {
        const aTime = new Date(a.createdAt || a.startTime || 0).getTime();
        const bTime = new Date(b.createdAt || b.startTime || 0).getTime();
        return bTime - aTime;
      })
      .slice(0, 6);
  }, [bookings]);

  const inviteNotifications = useMemo(() => {
    return notifications
      .filter((notification) => notification.type === 'team_invite' && !notification.isRead && notification.metadata?.teamId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 6);
  }, [notifications]);

  const spotlightStats = useMemo(() => {
    if (isCaptain) {
      return [
        {
          label: t('dashboard_next_booking', 'Next booking'),
          value: upcomingBookings[0]?.field?.name || t('dashboard_nothing_scheduled', 'Nothing scheduled'),
          note: upcomingBookings[0]?.startTime ? new Date(upcomingBookings[0].startTime).toLocaleString() : t('dashboard_create_booking_start', 'Create a booking to get started')
        },
        {
          label: t('dashboard_teams_managed', 'Teams managed'),
          value: String(captainedTeams.length),
          note: captainedTeams.length > 0 ? t('dashboard_active_captain_workspaces', 'Active captain workspaces') : t('dashboard_create_or_captain_team', 'Create or captain a team')
        },
        {
          label: t('dashboard_join_queue', 'Join queue'),
          value: String(joinRequestsByTeam.reduce((sum, item) => sum + item.pendingCount, 0)),
          note: t('dashboard_requests_waiting_review', 'Requests waiting for your review')
        }
      ];
    }

    if (isPlayerWorkspace) {
      return [
        {
          label: t('dashboard_player_next_match_day', 'Next match day'),
          value: upcomingBookings[0]?.field?.name || t('dashboard_player_no_upcoming_booking', 'No upcoming booking'),
          note: upcomingBookings[0]?.startTime ? new Date(upcomingBookings[0].startTime).toLocaleString() : t('dashboard_player_watch_activity', 'Watch for team activity and invites')
        },
        {
          label: t('dashboard_player_my_teams_small', 'My teams'),
          value: String(myTeams.length),
          note: myTeams.length > 0 ? t('dashboard_player_current_teams', 'Teams you currently belong to') : t('dashboard_player_join_team_unlock', 'Join a team to unlock match activity')
        },
        {
          label: t('dashboard_player_open_invites', 'Open invites'),
          value: String(inviteNotifications.length),
          note: t('dashboard_player_unread_invites', 'Unread team invitations')
        }
      ];
    }

    return [
      {
        label: 'Pending amount',
        value: formatUsd(adminPaymentSummary.pendingAmount),
        note: t('dashboard_admin_pending_approvals', 'Pending approvals requiring admin action')
      },
      {
        label: 'Verified revenue',
        value: formatUsd(adminPaymentSummary.approvedAmount),
        note: 'Approved role-upgrade payments'
      },
      {
        label: 'Role queue',
        value: String(pendingAdminRoleRequests.length),
        note: `${adminPaymentSummary.pendingCount} payment requests waiting for review`
      }
    ];
  }, [
    isCaptain,
    isPlayerWorkspace,
    upcomingBookings,
    captainedTeams.length,
    joinRequestsByTeam,
    myTeams.length,
    inviteNotifications.length,
    pendingAdminRoleRequests.length,
    adminPaymentSummary.pendingAmount,
    adminPaymentSummary.approvedAmount,
    adminPaymentSummary.pendingCount,
    t
  ]);

  const quickActions = useMemo(() => {
    if (isCaptain) {
      return [
        { label: t('dashboard_create_booking', 'Create booking'), helper: t('dashboard_reserve_field_team', 'Reserve a field for your team'), to: canCreateBooking ? '/app/bookings/new' : '/app/bookings' },
        { label: t('dashboard_manage_teams', 'Manage teams'), helper: t('dashboard_review_members_requests', 'Review members and requests'), to: '/app/teams' },
        { label: t('dashboard_find_fields', 'Find fields'), helper: t('dashboard_browse_venues', 'Browse available venues'), to: '/app/fields' }
      ];
    }

    if (isFieldOwner) {
      return [
        { label: t('dashboard_create_booking', 'Create booking'), helper: t('dashboard_owner_reserve_field', 'Reserve a field while using the app workspace'), to: '/app/bookings/new' },
        { label: t('dashboard_player_explore_teams', 'Explore teams'), helper: t('dashboard_owner_join_manage_team', 'Join or manage team activity'), to: '/app/teams' },
        { label: t('dashboard_player_browse_fields', 'Browse fields'), helper: t('dashboard_player_discover_venues', 'Discover venues near you'), to: '/app/fields' }
      ];
    }

    if (role === 'player') {
      return [
        { label: t('dashboard_player_view_bookings', 'View bookings'), helper: t('dashboard_player_see_upcoming_sessions', 'See your upcoming sessions'), to: '/app/bookings' },
        { label: t('dashboard_player_explore_teams', 'Explore teams'), helper: t('dashboard_player_join_squad', 'Join a squad or manage memberships'), to: '/app/teams' },
        { label: t('dashboard_player_browse_fields', 'Browse fields'), helper: t('dashboard_player_discover_venues', 'Discover venues near you'), to: '/app/fields' }
      ];
    }

    return [
      { label: 'Manage payments', helper: 'Review payment proofs and approve or reject upgrade money', to: '/app/admin/payments' },
      { label: t('dashboard_admin_review_role_requests', 'Review role requests'), helper: t('dashboard_admin_approve_access', 'Approve captain and owner access'), to: '/app/admin/role-requests' },
      { label: t('dashboard_admin_manage_users', 'Manage users'), helper: t('dashboard_admin_inspect_members', 'Inspect platform members'), to: '/app/admin/users' },
      { label: t('dashboard_admin_check_bookings', 'Check bookings'), helper: t('dashboard_admin_monitor_bookings', 'Monitor booking activity'), to: '/app/bookings' }
    ];
  }, [canCreateBooking, isCaptain, isFieldOwner, role, t]);

  const markNotificationRead = async (notificationId) => {
    await apiService.put(`/notifications/${notificationId}`, {
      isRead: true,
      readAt: new Date().toISOString()
    });
    setNotifications((prev) =>
      prev.map((notification) =>
        notification.id === notificationId
          ? { ...notification, isRead: true, readAt: new Date().toISOString() }
          : notification
      )
    );
  };

  // Handle invite action interactions.
  const handleInviteAction = async (notification, action) => {
    const teamId = notification?.metadata?.teamId;
    if (!teamId) return;

    try {
      setInviteActionLoading(true);
      setError(null);
      if (action === 'accept') {
        await teamService.acceptInvite(teamId);
      } else {
        await teamService.declineInvite(teamId);
      }
      await markNotificationRead(notification.id);
      if (action === 'accept') {
        const myTeamsRes = await teamService.getMyTeams();
        setMyTeams(Array.isArray(myTeamsRes.data) ? myTeamsRes.data : []);
      }
    } catch (err) {
      setError(err?.error || `Failed to ${action} invitation`);
    } finally {
      setInviteActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  const activeTheme = roleTheme[role] || roleTheme.unknown;

  return (
    <div className="space-y-8">
      <div className={`rounded-[28px] border border-slate-200 bg-gradient-to-br p-6 shadow-sm ${activeTheme.accent}`}>
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center rounded-full bg-white/85 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 ring-1 ring-emerald-100">
              {isCaptain
                ? t('dashboard_captain_overview_badge', activeTheme.badge)
                : role === 'player'
                  ? t('dashboard_player_overview_badge', activeTheme.badge)
                  : role === 'field_owner'
                    ? t('dashboard_owner_app_view_badge', activeTheme.badge)
                    : activeTheme.badge}
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950">{t('nav_dashboard', 'Dashboard')}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              {isCaptain
                ? t('dashboard_captain_description', activeTheme.description)
                : role === 'player'
                  ? t('dashboard_player_description', activeTheme.description)
                  : role === 'field_owner'
                    ? t('dashboard_owner_app_description', activeTheme.description)
                    : activeTheme.description}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              {quickActions.map((action) => (
                <Button
                  key={action.label}
                  as={Link}
                  to={action.to}
                  variant={action.label === quickActions[0].label ? 'primary' : 'outline'}
                  size="sm"
                  className={`rounded-xl px-4 ${action.label === quickActions[0].label ? 'shadow-sm shadow-emerald-600/20' : 'border-slate-300 bg-white/90'}`}
                >
                  {action.label}
                  {action.label === quickActions[0].label && <ArrowRightIcon className="h-4 w-4" />}
                </Button>
              ))}
            </div>
          </div>
          <div className="grid w-full max-w-3xl grid-cols-1 gap-3 md:grid-cols-3">
            {spotlightStats.map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/70 bg-white/75 p-4 shadow-sm backdrop-blur">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{item.label}</div>
                <div className="mt-2 truncate text-lg font-bold text-slate-950">{item.value}</div>
                <div className="mt-1 text-xs leading-5 text-slate-500">{item.note}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.name} className={`overflow-hidden ${stat.cardClass}`}>
            <CardBody className="px-4 py-4">
              <div className="flex items-center gap-4">
                <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-sm ${stat.iconWrap}`}>
                  <stat.icon className="h-6 w-6 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{stat.name}</div>
                  <AnimatedStatValue value={stat.value} className={`mt-1.5 text-[1.8rem] font-bold leading-none ${stat.textClass}`} />
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              {role === 'captain' ? t('dashboard_pending_join_requests', 'Pending Join Requests') : role === 'admin' ? t('dashboard_admin_pending_role_requests', 'Pending Role Requests') : t('dashboard_player_upcoming_bookings', 'Upcoming Bookings')}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {role === 'captain'
                ? t('dashboard_pending_join_requests_desc', 'Keep team membership flowing by clearing request queues quickly.')
                : role === 'admin'
                  ? t('dashboard_admin_recent_access_requests', 'Recent access requests that need review from the admin side.')
                  : t('dashboard_player_upcoming_bookings_desc', 'Your next confirmed or pending sessions in chronological order.')}
            </p>
          </div>
          {isCaptain ? (
            <Button variant="outline" size="sm" onClick={() => navigate('/app/teams')}>
              {t('nav_teams', 'Teams')}
            </Button>
          ) : role === 'admin' ? (
            <Button variant="outline" size="sm" onClick={() => navigate('/app/admin/payments')}>
              {t('dashboard_admin_review_all', 'Review All')}
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => navigate('/app/bookings')}>
              {t('nav_bookings', 'Bookings')}
            </Button>
          )}
        </CardHeader>
        <div className="bg-white">
          {isCaptain ? (
            joinRequestsByTeam.length > 0 ? (
              <div className="divide-y divide-slate-200">
                {joinRequestsByTeam.slice(0, 6).map((team) => (
                  <div key={team.teamId} className="flex items-center justify-between px-6 py-5 transition hover:bg-slate-50/80">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{team.teamName}</div>
                      <div className="text-xs text-slate-500">{t('owner_pending_count', '{{count}} pending', { count: team.pendingCount })}</div>
                    </div>
                    <Button as={Link} to={`/app/teams/${team.teamId}/manage`} size="sm">
                      {t('action_review_requests', 'Review')}
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6">
                <EmptyState
                  icon={ClipboardDocumentCheckIcon}
                  title={t('dashboard_no_pending_requests', 'No pending requests')}
                  description={t('dashboard_join_requests_appear_here', 'When players request to join, they will appear here.')}
                />
              </div>
            )
          ) : role === 'admin' ? (
            pendingAdminRoleRequests.length > 0 ? (
              <div className="divide-y divide-slate-200">
                {pendingAdminRoleRequests.map((request) => {
                  const requester = request.requester || {};
                  const requesterName =
                    `${requester.firstName || ''} ${requester.lastName || ''}`.trim() || requester.username || 'Unknown user';

                  return (
                    <div key={request.id} className="flex items-center justify-between gap-4 px-6 py-5 transition hover:bg-slate-50/80">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-gray-900">{requesterName}</div>
                        <div className="truncate text-xs text-gray-500">
                          Requested {String(request.requestedRole || '').replace('_', ' ')} access
                        </div>
                        <div className="mt-1 text-xs text-gray-400">{new Date(request.createdAt).toLocaleString()}</div>
                      </div>
                      <Button as={Link} to="/app/admin/payments" size="sm">
                        {t('action_review_requests', 'Review')}
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6">
                <EmptyState
                  icon={ClipboardDocumentCheckIcon}
                  title={t('dashboard_admin_no_pending_role_requests', 'No pending role requests')}
                  description="New captain and field owner requests will appear here for admin review."
                />
              </div>
            )
          ) : upcomingBookings.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {upcomingBookings.map((booking) => (
                <div key={booking.id} className="flex items-center justify-between px-6 py-5 transition hover:bg-slate-50/80">
                  <div>
                        <div className="text-sm font-medium text-gray-900">{booking.field?.name || 'Field'}</div>
                        <div className="text-xs text-gray-500">{new Date(booking.startTime).toLocaleString()}</div>
                      </div>
                      <Badge tone={statusTone(booking.status)} className="capitalize">
                        {t(statusTranslationKey(booking.status) || booking.status, booking.status)}
                      </Badge>
                    </div>
              ))}
            </div>
          ) : (
            <div className="p-6">
              <EmptyState
                icon={CalendarIcon}
                title={t('owner_upcoming_empty_title', 'No upcoming bookings')}
                description={
                  canCreateBooking ? t('dashboard_player_browse_create_booking', 'Browse fields and create your next booking.') : t('booking_empty_request_captain', 'Please request to become captain in Settings.')
                }
                actionLabel={canCreateBooking ? t('dashboard_player_book_field', 'Book a field') : t('booking_request_captain', 'Request Captain Access')}
                onAction={() =>
                  navigate(
                    canCreateBooking ? '/app/bookings/new' : '/app/settings',
                    canCreateBooking ? undefined : { state: { focusRoleRequest: 'captain' } }
                  )
                }
              />
            </div>
          )}
        </div>
      </Card>

      {role !== 'admin' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card className="overflow-hidden">
            <CardHeader className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">{t('dashboard_recent_bookings', 'Recent Bookings')}</h3>
                <p className="mt-1 text-sm text-slate-500">{t('dashboard_recent_bookings_desc', 'Latest booking activity connected to your account.')}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/app/bookings')}>
                {t('dashboard_view_all', 'View all')}
              </Button>
            </CardHeader>
            <div className="bg-white">
              {recentBookings.length > 0 ? (
                <div className="divide-y divide-slate-200">
                  {recentBookings.slice(0, 5).map((booking) => (
                    <div key={booking.id} className="flex items-center justify-between gap-4 px-6 py-5 transition hover:bg-slate-50/80">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-gray-900">{booking.field?.name || t('dashboard_field_booking', 'Field booking')}</div>
                        <div className="mt-1 truncate text-xs text-slate-500">
                          {booking.team?.name || t('booking_no_team', 'No team')} | {new Date(booking.startTime).toLocaleString()}
                        </div>
                      </div>
                      <Badge tone={statusTone(booking.status)} className="capitalize">
                        {t(statusTranslationKey(booking.status) || booking.status, booking.status)}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6">
                  <EmptyState
                    icon={CalendarIcon}
                    title={t('dashboard_no_recent_bookings', 'No recent bookings')}
                    description={t('dashboard_recent_bookings_appear', 'Once bookings are created, the latest activity will appear here.')}
                  />
                </div>
              )}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">{isCaptain ? t('dashboard_team_snapshot', 'Team Snapshot') : t('dashboard_player_team_activity', 'Team Activity')}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {isCaptain
                    ? t('dashboard_team_snapshot_desc', 'Quick view of the teams you lead and their pending workload.')
                    : t('dashboard_player_team_activity_desc', 'Your current team footprint and invitation activity.')}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/app/teams')}>
                {t('dashboard_open_teams', 'Open teams')}
              </Button>
            </CardHeader>
            <div className="bg-white p-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {isCaptain ? t('dashboard_captained_teams_small', 'Captained teams') : t('dashboard_player_joined_teams', 'Joined teams')}
                  </div>
                  <div className="mt-2 text-3xl font-bold text-slate-950">
                    {isCaptain ? captainedTeams.length : myTeams.length}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {isCaptain ? t('dashboard_teams_actively_manage', 'Teams you actively manage') : t('dashboard_player_member_teams', 'Teams where you are currently a member')}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {isCaptain ? t('dashboard_pending_join_requests_small', 'Pending join requests') : t('dashboard_player_pending_invitations', 'Pending invitations')}
                  </div>
                  <div className="mt-2 text-3xl font-bold text-slate-950">
                    {isCaptain
                      ? joinRequestsByTeam.reduce((sum, item) => sum + item.pendingCount, 0)
                      : inviteNotifications.length}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {isCaptain ? t('dashboard_players_waiting_decision', 'Players waiting for a decision') : t('dashboard_player_invites_waiting', 'Invites waiting for your response')}
                  </div>
                </div>
              </div>
              <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-900">
                {isCaptain
                  ? t('dashboard_captain_tip', 'Tip: clear join requests quickly to keep your squad ready for bookings and open matches.')
                  : t('dashboard_player_tip', 'Tip: accepting invitations and tracking bookings here gives you a faster path into upcoming matches.')}
              </div>
            </div>
          </Card>
        </div>
      )}

      {role === 'admin' && (
        <>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)]">
            <Card className="overflow-hidden">
              <CardHeader className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Payment Visualization</h3>
                  <p className="mt-1 text-sm text-slate-500">Monitor approved, pending, and rejected upgrade money over the last 6 months.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate('/app/admin/payments')}>
                  Open Payments
                </Button>
              </CardHeader>
              <div className="bg-white p-6">
                <div className="flex items-end gap-3 overflow-x-auto pb-2">
                  {adminPaymentTimeline.map((item) => {
                    const totalAmount = item.approvedAmount + item.pendingAmount + item.rejectedAmount;
                    const totalHeight = Math.max((totalAmount / adminPaymentTimelineMax) * 170, totalAmount > 0 ? 16 : 8);
                    const approvedHeight = totalAmount ? (item.approvedAmount / totalAmount) * totalHeight : 0;
                    const pendingHeight = totalAmount ? (item.pendingAmount / totalAmount) * totalHeight : 0;
                    const rejectedHeight = totalAmount ? (item.rejectedAmount / totalAmount) * totalHeight : 0;

                    return (
                      <div key={item.key} className="flex min-w-[78px] flex-1 flex-col items-center">
                        <div className="mb-2 text-xs font-semibold text-slate-500">{formatUsd(totalAmount)}</div>
                        <div className="flex h-[180px] w-full items-end justify-center rounded-[24px] border border-slate-200 bg-slate-50/70 px-3 py-3">
                          <div className="flex w-full max-w-[40px] flex-col justify-end overflow-hidden rounded-full bg-white shadow-inner">
                            <div style={{ height: `${approvedHeight}px` }} className="bg-emerald-500" />
                            <div style={{ height: `${pendingHeight}px` }} className="bg-amber-400" />
                            <div style={{ height: `${rejectedHeight}px` }} className="bg-rose-400" />
                          </div>
                        </div>
                        <div className="mt-3 text-sm font-semibold text-slate-900">{item.label}</div>
                        <div className="text-xs text-slate-500">{item.requestCount} requests</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>

            <div className="space-y-6">
              <Card className="overflow-hidden">
                <CardHeader className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">Payment Status</h3>
                  <BanknotesIcon className="h-5 w-5 text-emerald-600" />
                </CardHeader>
                <div className="bg-white p-6">
                  <div className="overflow-hidden rounded-full bg-slate-100">
                    <div className="flex h-4 w-full">
                      <div style={{ width: `${adminPaymentPercentages.approved}%` }} className="bg-emerald-500" />
                      <div style={{ width: `${adminPaymentPercentages.pending}%` }} className="bg-amber-400" />
                      <div style={{ width: `${adminPaymentPercentages.rejected}%` }} className="bg-rose-400" />
                    </div>
                  </div>
                  <div className="mt-5 space-y-3">
                    {[
                      { label: 'Approved', amount: adminPaymentSummary.approvedAmount, helper: `${adminPaymentSummary.approvedCount} payments`, tone: 'text-emerald-700', dot: 'bg-emerald-500' },
                      { label: 'Pending', amount: adminPaymentSummary.pendingAmount, helper: `${adminPaymentSummary.pendingCount} waiting`, tone: 'text-amber-700', dot: 'bg-amber-400' },
                      { label: 'Rejected', amount: adminPaymentSummary.rejectedAmount, helper: `${adminPaymentSummary.rejectedCount} failed`, tone: 'text-rose-700', dot: 'bg-rose-400' }
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className={`h-3 w-3 rounded-full ${item.dot}`} />
                          <div>
                            <div className="text-sm font-semibold text-slate-900">{item.label}</div>
                            <div className="text-xs text-slate-500">{item.helper}</div>
                          </div>
                        </div>
                        <div className={`text-sm font-semibold ${item.tone}`}>{formatUsd(item.amount)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              <Card className="overflow-hidden">
                <CardHeader className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">Money by Role</h3>
                  <Button variant="outline" size="sm" onClick={() => navigate('/app/admin/role-requests')}>
                    Role Requests
                  </Button>
                </CardHeader>
                <div className="bg-white p-6">
                  {adminPaymentRoleBreakdown.length > 0 ? (
                    <div className="space-y-3">
                      {adminPaymentRoleBreakdown.map((item) => (
                        <div key={item.role} className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-slate-900">
                                {formatRoleLabel(item.role, 'Unknown')}
                              </div>
                              <div className="text-xs text-slate-500">{item.count} requests</div>
                            </div>
                            <div className="text-sm font-semibold text-slate-900">{formatUsd(item.amount)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon={BanknotesIcon}
                      title="No payment data"
                      description="Payment totals will appear here when users submit upgrade payments."
                    />
                  )}
                </div>
              </Card>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Card className="overflow-hidden">
              <CardHeader className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">{t('dashboard_admin_newest_users', 'Newest Users')}</h3>
                <Button variant="outline" size="sm" onClick={() => navigate('/app/admin/users')}>
                  {t('dashboard_admin_manage_users', 'Manage users')}
                </Button>
              </CardHeader>
              <div className="bg-white">
                {recentUsers.length > 0 ? (
                  <div className="divide-y divide-slate-200">
                    {recentUsers.map((member) => {
                      const displayName =
                        `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.username || member.email;

                      return (
                        <div key={member.id} className="flex items-center justify-between gap-4 px-6 py-5 transition hover:bg-slate-50/80">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-gray-900">{displayName}</div>
                            <div className="truncate text-xs text-gray-500">@{member.username || t('common_unknown', 'user')}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge tone="gray" className="capitalize">
                              {member.role === 'field_owner'
                                ? t('role_field_owner', 'Field Owner')
                                : member.role === 'captain'
                                ? t('role_captain', 'Captain')
                                : member.role === 'admin'
                                  ? t('role_admin', 'Admin')
                                  : t('role_player', 'Player')}
                            </Badge>
                            <Badge
                              tone={member.status === 'active' ? 'green' : member.status === 'suspended' ? 'red' : 'gray'}
                              className="capitalize"
                            >
                              {member.status === 'active'
                                ? t('dashboard_admin_active', 'Active')
                                : member.status === 'suspended'
                                  ? t('dashboard_admin_suspended', 'Suspended')
                                  : member.status || t('dashboard_admin_active', 'Active')}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-6">
                    <EmptyState
                      icon={UserCircleIcon}
                      title={t('dashboard_admin_no_users', 'No users found')}
                      description={t('dashboard_admin_users_appear', 'User accounts will appear here after registration.')}
                    />
                  </div>
                )}
              </div>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">{t('dashboard_admin_latest_bookings', 'Latest Bookings')}</h3>
                <Button variant="outline" size="sm" onClick={() => navigate('/owner/bookings')}>
                  {t('dashboard_admin_view_bookings', 'View Bookings')}
                </Button>
              </CardHeader>
              <div className="bg-white">
                {recentBookings.length > 0 ? (
                  <div className="divide-y divide-slate-200">
                    {recentBookings.map((booking) => (
                      <div key={booking.id} className="flex items-center justify-between gap-4 px-6 py-5 transition hover:bg-slate-50/80">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-gray-900">{booking.field?.name || t('dashboard_field_booking', 'Field booking')}</div>
                          <div className="truncate text-xs text-gray-500">
                            {booking.team?.name || t('booking_no_team', 'No team')} | {new Date(booking.startTime).toLocaleString()}
                          </div>
                        </div>
                        <Badge tone={statusTone(booking.status)} className="capitalize">
                          {t(statusTranslationKey(booking.status) || booking.status, booking.status)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6">
                    <EmptyState
                      icon={CalendarIcon}
                      title={t('dashboard_admin_no_bookings', 'No bookings yet')}
                      description={t('dashboard_admin_bookings_appear', 'Recent bookings will appear here for quick admin review.')}
                    />
                  </div>
                )}
              </div>
            </Card>
          </div>
        </>
      )}

      {isPlayerWorkspace && (
        <Card className="overflow-hidden">
          <CardHeader className="flex items-center justify-between">
            <h3 className="inline-flex items-center gap-2 text-lg font-medium text-gray-900">
              <BellAlertIcon className="h-5 w-5 text-amber-500" />
              {t('dashboard_player_team_invitation_notifications', 'Team Invitation Notifications')}
            </h3>
            <Badge tone="yellow">{t('owner_pending_count', '{{count}} pending', { count: inviteNotifications.length })}</Badge>
          </CardHeader>
          <div className="bg-white">
            {inviteNotifications.length > 0 ? (
              <div className="divide-y divide-slate-200">
                {inviteNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="flex flex-col gap-3 px-6 py-5 transition hover:bg-slate-50/80 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <div className="text-sm font-medium text-gray-900">{notification.title}</div>
                      <div className="text-xs text-gray-500">{notification.message}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleInviteAction(notification, 'accept')}
                        disabled={inviteActionLoading}
                        className="inline-flex items-center gap-1"
                      >
                        <CheckIcon className="h-4 w-4" />
                        {t('teams_accept', 'Accept')}
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleInviteAction(notification, 'decline')}
                        disabled={inviteActionLoading}
                        className="inline-flex items-center gap-1"
                      >
                        <XMarkIcon className="h-4 w-4" />
                        {t('teams_decline', 'Decline')}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6">
                <EmptyState
                  icon={BellAlertIcon}
                  title={t('dashboard_player_no_invitation_notifications', 'No invitation notifications')}
                  description={t('dashboard_player_invitation_notifications_desc', 'When captains invite you to teams, they will appear here.')}
                />
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};

export default DashboardPage;
