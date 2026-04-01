import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useRealtime } from '../../context/RealtimeContext';
import {
  HomeIcon, 
  BuildingOfficeIcon, 
  UsersIcon, 
  CalendarIcon, 
  UserCircleIcon,
  Cog6ToothIcon,
  BellAlertIcon,
  ArrowLeftIcon,
  CheckIcon,
  ClipboardDocumentCheckIcon,
  EyeIcon,
  InboxIcon,
  Bars3Icon,
  XMarkIcon,
  TrophyIcon,
  BanknotesIcon,
  ChatBubbleLeftRightIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon
} from '@heroicons/react/24/outline';
import notificationService from '../../services/notificationService';
import teamService from '../../services/teamService';
import bookingService from '../../services/bookingService';
import { ImagePreviewModal, useToast } from '../ui';
import LanguageSwitcher from '../common/LanguageSwitcher';
import ThemeToggle from '../common/ThemeToggle';
import { useLanguage } from '../../context/LanguageContext';
import { APP_CONFIG, buildAssetUrl } from '../../config/appConfig';
import { formatRoleLabel } from '../../utils/formatters';

const BRAND_NAME = APP_CONFIG.brand.displayName;
const topControlButtonClass =
  'group inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white/95 text-slate-500 shadow-[0_10px_24px_rgba(15,23,42,0.06)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 hover:shadow-[0_14px_28px_rgba(16,185,129,0.14)] active:translate-y-0 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 focus-visible:ring-offset-2';
const backButtonClass =
  'group ml-4 inline-flex items-center gap-2.5 rounded-full border border-slate-200 bg-white/95 px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-[0_10px_24px_rgba(15,23,42,0.06)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50/70 hover:text-emerald-700 hover:shadow-[0_14px_28px_rgba(16,185,129,0.14)] active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 focus-visible:ring-offset-2';

const SidebarBrand = ({ collapsed = false }) => (
  <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
    <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 via-green-600 to-teal-500 text-lg font-black tracking-wide text-white shadow-[0_14px_28px_rgba(22,163,74,0.28)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.35),_transparent_55%)]" />
      {APP_CONFIG.brand.shortName}
    </div>
    {!collapsed && (
      <div className="min-w-0 py-0.5">
        <div className="khmer-brand-font text-[20px] font-extrabold leading-[1.2] text-slate-950">
          {BRAND_NAME}
        </div>
      </div>
    )}
  </div>
);

// Render the app layout for shared page structure.
const AppLayout = () => {
  const { user } = useAuth();
  const { version } = useRealtime();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('appDesktopSidebarCollapsed') === 'true';
  });
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [notificationsMenuOpen, setNotificationsMenuOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationActionLoading, setNotificationActionLoading] = useState(false);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const notificationsMenuRef = useRef(null);
  const { showToast } = useToast();
  const { t } = useLanguage();

  const userDisplayName =
    `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.username || 'User';
  const settingsItem = {
    name: t('nav_settings', 'Settings'),
    href: '/app/settings',
    icon: Cog6ToothIcon,
    current: location.pathname === '/app/settings' || location.pathname === '/app/admin/settings'
  };
  const profileCurrent = location.pathname === '/app/profile';

  const navigation = [
    {
      name: t('nav_dashboard', 'Dashboard'),
      href: '/app/dashboard',
      icon: HomeIcon,
      current: location.pathname === '/app/dashboard'
    },
    {
      name: t('nav_fields', 'Fields'),
      href: '/app/fields',
      icon: BuildingOfficeIcon,
      current: location.pathname.startsWith('/app/fields')
    },
    {
      name: t('nav_leagues', 'Leagues'),
      href: '/app/league',
      icon: TrophyIcon,
      current: location.pathname.startsWith('/app/league')
    },
    {
      name: t('nav_teams', 'Teams'),
      href: '/app/teams',
      icon: UsersIcon,
      current: location.pathname.startsWith('/app/teams')
    },
    {
      name: t('nav_chat', 'Chat'),
      href: '/app/chat',
      icon: ChatBubbleLeftRightIcon,
      current: location.pathname.startsWith('/app/chat')
    },
    ...(['player', 'captain', 'field_owner'].includes(user?.role)
      ? [
          {
            name: t('nav_bookings', 'Bookings'),
            href: '/app/bookings',
            icon: CalendarIcon,
            current: location.pathname.startsWith('/app/bookings')
          }
        ]
      : []),
    ...(user?.role === 'admin'
      ? [
          {
            name: t('nav_manage_users', 'Manage Users'),
            href: '/app/admin/users',
            icon: UserCircleIcon,
            current: location.pathname.startsWith('/app/admin/users')
          },
          {
            name: t('nav_role_requests', 'Role Requests'),
            href: '/app/admin/role-requests',
            icon: ClipboardDocumentCheckIcon,
            current: location.pathname.startsWith('/app/admin/role-requests')
          },
          {
            name: t('nav_payments', 'Payments'),
            href: '/app/admin/payments',
            icon: BanknotesIcon,
            current: location.pathname.startsWith('/app/admin/payments')
          }
        ]
      : []),
    ...(['captain', 'field_owner'].includes(user?.role)
      ? [
          {
            name: t('nav_open_matches', 'Open Matches'),
            href: '/app/open-matches',
            icon: UsersIcon,
            current: location.pathname.startsWith('/app/open-matches')
          }
        ]
      : [])
  ];

  const pageInfo = useMemo(() => {
    const path = location.pathname;
    const entries = [
      { match: '/app/dashboard', title: t('nav_dashboard', 'Dashboard'), subtitle: t('page_dashboard_subtitle', 'Overview of your activity and updates') },
      { match: '/app/fields', title: t('nav_fields', 'Fields'), subtitle: t('page_fields_subtitle', 'Browse and discover available football fields') },
      { match: '/app/league', title: t('nav_league', 'League'), subtitle: t('page_league_subtitle', 'Track fixtures, results, and standings') },
      { match: '/app/teams', title: t('nav_teams', 'Teams'), subtitle: t('page_teams_subtitle', 'Manage your team and membership requests') },
      { match: '/app/chat', title: t('nav_chat', 'Chat'), subtitle: t('page_chat_subtitle', 'Talk directly with users across the platform') },
      { match: '/app/bookings', title: t('nav_bookings', 'Bookings'), subtitle: t('page_bookings_subtitle', 'Create and manage your field bookings') },
      { match: '/app/open-matches', title: t('nav_open_matches', 'Open Matches'), subtitle: t('page_open_matches_subtitle', 'Find and respond to open opponent matches') },
      { match: '/app/notifications', title: t('nav_notifications', 'Notifications'), subtitle: t('page_notifications_subtitle', 'Review invitations and request updates') },
      { match: '/app/profile', title: t('nav_profile', 'Profile'), subtitle: t('page_profile_subtitle', 'Update your account and preferences') },
      { match: '/app/settings', title: t('nav_settings', 'Settings'), subtitle: t('page_settings_subtitle', 'Manage account preferences and role requests') },
      { match: '/app/admin/users', title: t('nav_manage_users', 'Manage Users'), subtitle: t('page_manage_users_subtitle', 'Admin user management area') },
      { match: '/app/admin/role-requests', title: t('nav_role_requests', 'Role Requests'), subtitle: 'Review captain and field owner access requests' },
      { match: '/app/admin/payments', title: t('nav_payments', 'Payments'), subtitle: 'Review payment proofs and track upgrade revenue' },
      { match: '/app/admin/settings', title: t('nav_settings', 'Settings'), subtitle: 'Admin configuration and controls' }
    ];
    const current = entries.find((entry) => path.startsWith(entry.match));
    return current || { title: APP_CONFIG.brand.displayName, subtitle: t('workspace_player', 'Player & Captain Panel') };
  }, [location.pathname, t]);
  const showBackHomeButton = location.pathname.startsWith('/app');
  const desktopSidebarWidthClass = desktopSidebarCollapsed ? 'md:w-20' : 'md:w-64';
  const desktopContentOffsetClass = desktopSidebarCollapsed ? 'md:pl-20' : 'md:pl-64';

  // Format role for display.
  const formatRole = (role) => {
    return formatRoleLabel(role, 'Player');
  };

  // Support render nav icon for this module.
  const renderNavIcon = (item) => {
    return (
      <item.icon
        className={`${desktopSidebarCollapsed ? '' : 'mr-3'} h-5 w-5 flex-shrink-0 ${
          item.current ? 'text-green-500' : 'text-gray-400 group-hover:text-gray-500'
        }`}
      />
    );
  };

  // Resolve avatar url into a display-safe value.
  const resolveAvatarUrl = () => {
    return buildAssetUrl(user?.avatarUrl || user?.avatar_url);
  };

  const resolveNotificationSenderName = (notification) => {
    return notification?.sender?.name || notification?.sender?.username || 'Unknown user';
  };

  // Resolve notification sender avatar into a display-safe value.
  const resolveNotificationSenderAvatar = (notification) => {
    return buildAssetUrl(notification?.sender?.avatarUrl);
  };

  const latestNotifications = useMemo(() => {
    return [...notifications]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10);
  }, [notifications]);

  const loadNotifications = useCallback(async () => {
    setNotificationsLoading(true);
    try {
      const response = await notificationService.getAll();
      const list = Array.isArray(response.data) ? response.data : [];
      setNotifications(list);
      setUnreadNotifications(list.filter((item) => !item.isRead).length);
    } catch {
      setNotifications([]);
      setUnreadNotifications(0);
    } finally {
      setNotificationsLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = notificationService.subscribe((list) => {
      setNotifications(list);
      setUnreadNotifications(list.filter((item) => !item.isRead).length);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [location.pathname, loadNotifications]);

  useEffect(() => {
    notificationService.refresh().catch(() => {});
  }, [version]);

  useEffect(() => {
    const interval = setInterval(() => {
      notificationService.refresh().catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const markNotificationRead = async (notificationId) => {
    await notificationService.markRead(notificationId);
  };

  // Check whether respond to invite is allowed.
  const canRespondToInvite = (notification) => {
    return (
      !notification?.isRead &&
      notification?.type === 'team_invite'
    );
  };

  // Check whether respond to leave request is allowed.
  const canRespondToLeaveRequest = (notification) => {
    const title = String(notification?.title || '').toLowerCase();
    return (
      !notification?.isRead &&
      (
        notification?.metadata?.event === 'team_leave_request' ||
        title.startsWith('leave request for ')
      )
    );
  };

  // Check whether respond to join request is allowed.
  const canRespondToJoinRequest = (notification) => {
    const title = String(notification?.title || '').toLowerCase();
    const message = String(notification?.message || '').toLowerCase();
    const isBookingJoinLike =
      notification?.metadata?.event === 'booking_join_request' ||
      (title.startsWith('join request for ') && message.includes('open match'));
    return (
      !notification?.isRead &&
      !isBookingJoinLike &&
      (
        notification?.metadata?.event === 'team_join_request' ||
        title.startsWith('join request for ')
      )
    );
  };

  // Check whether respond to booking join request is allowed.
  const canRespondToBookingJoinRequest = (notification) => {
    const title = String(notification?.title || '').toLowerCase();
    const message = String(notification?.message || '').toLowerCase();
    return (
      !notification?.isRead &&
      (
        notification?.metadata?.event === 'booking_join_request' ||
        (
          title.startsWith('join request for ') &&
          message.includes('open match')
        )
      )
    );
  };

  // Support extract booking host team name for this module.
  const extractBookingHostTeamName = (notification) => {
    const title = String(notification?.title || '');
    const titlePrefix = 'Join request for ';
    if (title.startsWith(titlePrefix)) {
      return title.slice(titlePrefix.length).trim().toLowerCase();
    }
    return '';
  };

  // Support extract booking requester team name for this module.
  const extractBookingRequesterTeamName = (notification) => {
    const message = String(notification?.message || '');
    const match = message.match(/^(.*?)\s+requested to join your open match/i);
    return match?.[1]?.trim().toLowerCase() || '';
  };

  // Resolve booking join request context into a display-safe value.
  const resolveBookingJoinRequestContext = async (notification) => {
    let bookingId = Number(notification?.metadata?.bookingId);
    let requestId = Number(notification?.metadata?.requestId);

    if (Number.isInteger(bookingId) && Number.isInteger(requestId)) {
      return { bookingId, requestId };
    }

    const hostTeamName = extractBookingHostTeamName(notification);
    const requesterTeamName = extractBookingRequesterTeamName(notification);

    const bookingsRes = await bookingService.getAllBookings();
    const bookings = Array.isArray(bookingsRes?.data) ? bookingsRes.data : [];
    const myHostBookings = bookings.filter((booking) => {
      if (!booking?.team || Number(booking?.team?.captainId) !== Number(user?.id)) return false;
      if (hostTeamName && String(booking.team.name || '').trim().toLowerCase() !== hostTeamName) return false;
      return true;
    });

    for (const booking of myHostBookings) {
      const joinRes = await bookingService.getBookingJoinRequests(booking.id);
      const joinRequests = Array.isArray(joinRes?.data) ? joinRes.data : [];
      const pending = joinRequests.filter((item) => item?.status === 'pending');
      const byName = requesterTeamName
        ? pending.find(
            (item) => String(item?.requesterTeam?.name || '').trim().toLowerCase() === requesterTeamName
          )
        : null;
      const target = byName || (pending.length === 1 ? pending[0] : null);
      if (target?.id) {
        return { bookingId: booking.id, requestId: target.id };
      }
    }

    return { bookingId: null, requestId: null };
  };

  // Support extract leave request team name for this module.
  const extractLeaveRequestTeamName = (notification) => {
    const title = String(notification?.title || '');
    const titlePrefix = 'Leave request for ';
    if (title.startsWith(titlePrefix)) {
      return title.slice(titlePrefix.length).trim().toLowerCase();
    }
    const message = String(notification?.message || '');
    const quoted = message.match(/"([^"]+)"/);
    if (quoted?.[1]) return quoted[1].trim().toLowerCase();
    return '';
  };

  // Support extract leave requester name for this module.
  const extractLeaveRequesterName = (notification) => {
    const message = String(notification?.message || '');
    const match = message.match(/^(.*?)\s+requested to leave/i);
    return match?.[1]?.trim().toLowerCase() || '';
  };

  // Resolve leave request context into a display-safe value.
  const resolveLeaveRequestContext = async (notification) => {
    let teamId = notification?.metadata?.teamId || null;
    let requesterId = notification?.metadata?.requesterId || notification?.sender?.id || null;

    if (!teamId) {
      const captainedRes = await teamService.getCaptainedTeams();
      const captainedTeams = Array.isArray(captainedRes?.data) ? captainedRes.data : [];
      const teamName = extractLeaveRequestTeamName(notification);
      const byName = teamName
        ? captainedTeams.find((team) => String(team?.name || '').trim().toLowerCase() === teamName)
        : null;
      teamId = byName?.id || (captainedTeams.length === 1 ? captainedTeams[0]?.id : null);
    }

    if (!requesterId && teamId) {
      const membersRes = await teamService.getTeamMembers(teamId);
      const members = Array.isArray(membersRes?.data) ? membersRes.data : [];
      const senderName = String(resolveNotificationSenderName(notification) || '').trim().toLowerCase();
      const requesterName = extractLeaveRequesterName(notification);
      const byName = members.find((member) => {
        const userData = member?.user || {};
        const fullName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim().toLowerCase();
        const username = String(userData.username || '').trim().toLowerCase();
        return (
          (senderName && (fullName === senderName || username === senderName)) ||
          (requesterName && (fullName === requesterName || username === requesterName))
        );
      });
      requesterId = byName?.userId || byName?.user?.id || null;
    }

    return { teamId, requesterId };
  };

  // Support extract join request team name for this module.
  const extractJoinRequestTeamName = (notification) => {
    const title = String(notification?.title || '');
    const titlePrefix = 'Join request for ';
    if (title.startsWith(titlePrefix)) {
      return title.slice(titlePrefix.length).trim().toLowerCase();
    }
    const message = String(notification?.message || '');
    const quoted = message.match(/"([^"]+)"/);
    if (quoted?.[1]) return quoted[1].trim().toLowerCase();
    return '';
  };

  // Support extract join requester name for this module.
  const extractJoinRequesterName = (notification) => {
    const message = String(notification?.message || '');
    const match = message.match(/^(.*?)\s+requested to join/i);
    return match?.[1]?.trim().toLowerCase() || '';
  };

  // Resolve join request context into a display-safe value.
  const resolveJoinRequestContext = async (notification) => {
    let teamId = notification?.metadata?.teamId || null;
    let requesterId = notification?.metadata?.requesterId || notification?.sender?.id || null;

    if (!teamId) {
      const captainedRes = await teamService.getCaptainedTeams();
      const captainedTeams = Array.isArray(captainedRes?.data) ? captainedRes.data : [];
      const teamName = extractJoinRequestTeamName(notification);
      const byName = teamName
        ? captainedTeams.find((team) => String(team?.name || '').trim().toLowerCase() === teamName)
        : null;
      teamId = byName?.id || (captainedTeams.length === 1 ? captainedTeams[0]?.id : null);
    }

    if (!requesterId && teamId) {
      const membersRes = await teamService.getTeamMembers(teamId);
      const members = Array.isArray(membersRes?.data) ? membersRes.data : [];
      const senderName = String(resolveNotificationSenderName(notification) || '').trim().toLowerCase();
      const requesterName = extractJoinRequesterName(notification);
      const byName = members.find((member) => {
        if (member?.status !== 'pending') return false;
        const userData = member?.user || {};
        const fullName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim().toLowerCase();
        const username = String(userData.username || '').trim().toLowerCase();
        return (
          (senderName && (fullName === senderName || username === senderName)) ||
          (requesterName && (fullName === requesterName || username === requesterName))
        );
      });
      requesterId = byName?.userId || byName?.user?.id || null;
    }

    return { teamId, requesterId };
  };

  // Support extract team name from notification for this module.
  const extractTeamNameFromNotification = (notification) => {
    const title = notification?.title || '';
    const titlePrefix = 'Invitation to join ';
    if (title.startsWith(titlePrefix)) {
      return title.slice(titlePrefix.length).trim().toLowerCase();
    }

    const message = notification?.message || '';
    const quoted = message.match(/"([^"]+)"/);
    if (quoted?.[1]) return quoted[1].trim().toLowerCase();
    return '';
  };

  // Resolve invite team id into a display-safe value.
  const resolveInviteTeamId = async (notification) => {
    if (notification?.metadata?.teamId) return notification.metadata.teamId;

    const invitationsResponse = await teamService.getMyInvitations();
    const invitations = Array.isArray(invitationsResponse?.data) ? invitationsResponse.data : [];
    if (invitations.length === 0) return null;

    const targetTeamName = extractTeamNameFromNotification(notification);
    const inviterId = notification?.metadata?.inviterId;

    const byName = targetTeamName
      ? invitations.find((team) => (team?.name || '').trim().toLowerCase() === targetTeamName)
      : null;
    if (byName?.id) return byName.id;

    const byInviter = inviterId
      ? invitations.find((team) => Number(team?.captain?.id) === Number(inviterId))
      : null;
    if (byInviter?.id) return byInviter.id;

    if (invitations.length === 1 && invitations[0]?.id) return invitations[0].id;
    return null;
  };

  // Handle invite action interactions.
  const handleInviteAction = async (notification, action) => {
    try {
      setNotificationActionLoading(true);
      const teamId = await resolveInviteTeamId(notification);
      if (!teamId) return;
      if (action === 'accept') {
        await teamService.acceptInvite(teamId);
      } else {
        await teamService.declineInvite(teamId);
      }
      await markNotificationRead(notification.id);
      await loadNotifications();
    } finally {
      setNotificationActionLoading(false);
    }
  };

  // Handle leave request action interactions.
  const handleLeaveRequestAction = async (notification, action) => {
    try {
      setNotificationActionLoading(true);
      const { teamId, requesterId } = await resolveLeaveRequestContext(notification);
      if (!teamId || !requesterId) return;
      await teamService.respondLeaveRequest(teamId, requesterId, action);
      await markNotificationRead(notification.id);
      await loadNotifications();
    } catch (err) {
      showToast(err?.error || 'Failed to process leave request', { type: 'error' });
    } finally {
      setNotificationActionLoading(false);
    }
  };

  // Handle join request action interactions.
  const handleJoinRequestAction = async (notification, action) => {
    try {
      setNotificationActionLoading(true);
      const { teamId, requesterId } = await resolveJoinRequestContext(notification);
      if (!teamId || !requesterId) return;
      await teamService.updateMember(teamId, requesterId, {
        status: action === 'accept' ? 'active' : 'inactive'
      });
      await markNotificationRead(notification.id);
      await loadNotifications();
    } catch (err) {
      showToast(err?.error || 'Failed to process join request', { type: 'error' });
    } finally {
      setNotificationActionLoading(false);
    }
  };

  // Handle booking join request action interactions.
  const handleBookingJoinRequestAction = async (notification, action) => {
    try {
      setNotificationActionLoading(true);
      const { bookingId, requestId } = await resolveBookingJoinRequestContext(notification);
      if (!bookingId || !requestId) {
        showToast('Could not identify that match request. Open Bookings page and accept from Join Requests.', {
          type: 'error'
        });
        return;
      }
      await bookingService.respondToJoinRequest(bookingId, requestId, action === 'accept' ? 'accept' : 'reject');
      await markNotificationRead(notification.id);
      await loadNotifications();
      showToast(action === 'accept' ? 'Match request accepted.' : 'Match request declined.', {
        type: 'success'
      });
    } catch (error) {
      showToast(error?.error || `Failed to ${action} match request`, { type: 'error' });
    } finally {
      setNotificationActionLoading(false);
    }
  };

  // Handle mark as read interactions.
  const handleMarkAsRead = async (notificationId) => {
    try {
      setNotificationActionLoading(true);
      await markNotificationRead(notificationId);
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    } finally {
      setNotificationActionLoading(false);
    }
  };

  // Handle notification click interactions.
  const handleNotificationClick = async (notification) => {
    if (!notification || notificationActionLoading) return;

    try {
      if (!notification.isRead) {
        setNotificationActionLoading(true);
        await markNotificationRead(notification.id);
        await loadNotifications();
      }
    } catch (error) {
      console.error('Failed to process notification click:', error);
    } finally {
      setNotificationActionLoading(false);
      setNotificationsMenuOpen(false);
    }

    if (notification.metadata?.teamId) {
      navigate(`/app/teams/${notification.metadata.teamId}`);
      return;
    }

    navigate('/app/notifications');
  };

  // Handle mark all as read interactions.
  const handleMarkAllAsRead = async () => {
    try {
      setNotificationActionLoading(true);
      const unread = latestNotifications.filter((item) => !item.isRead);
      if (unread.length === 0) return;
      await notificationService.markManyRead(unread.map((item) => item.id));
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    } finally {
      setNotificationActionLoading(false);
    }
  };

  useEffect(() => {
    const successMessage = location.state?.successMessage;
    const errorMessage = location.state?.errorMessage;

    if (!successMessage && !errorMessage) return;

    showToast(successMessage || errorMessage, {
      type: successMessage ? 'success' : 'error'
    });

    navigate(`${location.pathname}${location.search}${location.hash}`, {
      replace: true,
      state: {}
    });
  }, [location, navigate, showToast]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('appDesktopSidebarCollapsed', String(desktopSidebarCollapsed));
  }, [desktopSidebarCollapsed]);

  useEffect(() => {
    if (!notificationsMenuOpen) return undefined;

    // Handle pointer down interactions.
    const handlePointerDown = (event) => {
      if (!notificationsMenuRef.current?.contains(event.target)) {
        setNotificationsMenuOpen(false);
      }
    };

    // Handle escape interactions.
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setNotificationsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [notificationsMenuOpen]);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-50 transition-opacity duration-300 ${sidebarOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}>
        <div
          className={`fixed inset-0 bg-slate-950/35 backdrop-blur-[2px] transition-opacity duration-300 ${sidebarOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setSidebarOpen(false)}
        />
        <div className={`fixed inset-y-0 left-0 flex w-64 flex-col bg-white shadow-[18px_0_42px_rgba(15,23,42,0.16)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex h-16 items-center justify-between px-4">
            <SidebarBrand />
            <button
              onClick={() => setSidebarOpen(false)}
              className={`${topControlButtonClass} h-10 w-10 rounded-xl border-slate-200 text-slate-500 shadow-sm`}
              aria-label="Close navigation"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
          <div className="flex flex-1 flex-col overflow-y-auto">
            <nav className="flex-1 space-y-1 px-2 py-4">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  aria-current={item.current ? 'page' : undefined}
                  className={`group flex items-center rounded-md px-2 py-2 text-sm font-medium transition-all duration-150 ${
                    item.current
                      ? 'translate-x-1 rounded-xl bg-green-100 text-green-900 shadow-[0_10px_24px_rgba(34,197,94,0.14)]'
                      : 'text-gray-600 hover:translate-x-1 hover:bg-green-50 hover:text-green-900 hover:shadow-sm'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  {renderNavIcon(item)}
                  {item.name}
                </Link>
              ))}
            </nav>

            <div className="border-t border-gray-200 p-3 space-y-2">
              <Link
                to="/app/profile"
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 transition-all duration-200 ${
                  profileCurrent
                    ? 'bg-green-100 text-green-900 shadow-[0_10px_24px_rgba(34,197,94,0.14)]'
                    : 'text-gray-700 hover:translate-x-1 hover:bg-green-50 hover:text-green-900 hover:shadow-sm'
                }`}
              >
                <img
                  src={resolveAvatarUrl()}
                  alt={`${userDisplayName} avatar`}
                  className="h-10 w-10 cursor-zoom-in rounded-full bg-gray-100 object-cover"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setImagePreviewOpen(true);
                  }}
                  onError={(e) => {
                    const fallbackUrl = buildAssetUrl();
                    if (e.currentTarget.src !== fallbackUrl) {
                      e.currentTarget.src = fallbackUrl;
                    }
                  }}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{userDisplayName}</p>
                  <p className="text-xs text-gray-500 truncate">{formatRole(user?.role)}</p>
                </div>
              </Link>
              <Link
                to={settingsItem.href}
                onClick={() => setSidebarOpen(false)}
                className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all duration-200 ${
                  settingsItem.current
                    ? 'bg-green-100 text-green-900 shadow-[0_10px_24px_rgba(34,197,94,0.14)]'
                    : 'text-gray-700 hover:translate-x-1 hover:bg-green-50 hover:text-green-900 hover:shadow-sm'
                }`}
              >
                <settingsItem.icon
                  className={`h-5 w-5 flex-shrink-0 ${
                    settingsItem.current ? 'text-green-500' : 'text-gray-400 group-hover:text-gray-500'
                  }`}
                />
                {settingsItem.name}
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className={`hidden md:fixed md:inset-y-0 md:flex md:flex-col ${desktopSidebarWidthClass}`}>
        <div className="flex flex-col flex-grow border-r border-emerald-100 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fffb_100%)] shadow-[8px_0_30px_rgba(15,23,42,0.03)]">
          <div className={`flex h-20 items-center border-b border-emerald-100/80 ${desktopSidebarCollapsed ? 'justify-center px-3' : 'px-5'}`}>
            <SidebarBrand collapsed={desktopSidebarCollapsed} />
          </div>
          <div className="flex flex-1 flex-col overflow-y-auto">
            <nav className={`flex-1 space-y-1 py-4 ${desktopSidebarCollapsed ? 'px-3' : 'px-2'}`}>
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  title={item.name}
                  aria-current={item.current ? 'page' : undefined}
                  className={`group flex items-center rounded-md px-2 py-2 text-sm font-medium transition-all duration-200 ${
                    item.current
                      ? 'rounded-xl bg-green-100 text-green-900 shadow-[0_10px_24px_rgba(34,197,94,0.12)]'
                      : 'text-gray-600 hover:translate-x-1 hover:bg-green-50 hover:text-green-900 hover:shadow-sm'
                  } ${desktopSidebarCollapsed ? 'justify-center' : ''}`}
                >
                  {renderNavIcon(item)}
                  {!desktopSidebarCollapsed && item.name}
                </Link>
              ))}
            </nav>

            <div className={`border-t border-gray-200 space-y-2 ${desktopSidebarCollapsed ? 'p-2' : 'p-3'}`}>
              <Link
                to="/app/profile"
                title={userDisplayName}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 transition-all duration-200 ${
                  profileCurrent
                    ? 'bg-green-100 text-green-900 shadow-[0_10px_24px_rgba(34,197,94,0.12)]'
                    : 'text-gray-700 hover:translate-x-1 hover:bg-green-50 hover:text-green-900 hover:shadow-sm'
                } ${desktopSidebarCollapsed ? 'justify-center px-2' : ''}`}
              >
                <img
                  src={resolveAvatarUrl()}
                  alt={`${userDisplayName} avatar`}
                  className="h-10 w-10 cursor-zoom-in rounded-full bg-gray-100 object-cover"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setImagePreviewOpen(true);
                  }}
                  onError={(e) => {
                    const fallbackUrl = buildAssetUrl();
                    if (e.currentTarget.src !== fallbackUrl) {
                      e.currentTarget.src = fallbackUrl;
                    }
                  }}
                />
                {!desktopSidebarCollapsed && (
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{userDisplayName}</p>
                    <p className="text-xs text-gray-500 truncate">{formatRole(user?.role)}</p>
                  </div>
                )}
              </Link>
              <Link
                to={settingsItem.href}
                title={settingsItem.name}
                className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all duration-200 ${
                  settingsItem.current
                    ? 'bg-green-100 text-green-900 shadow-[0_10px_24px_rgba(34,197,94,0.12)]'
                    : 'text-gray-700 hover:translate-x-1 hover:bg-green-50 hover:text-green-900 hover:shadow-sm'
                } ${desktopSidebarCollapsed ? 'justify-center px-2' : ''}`}
              >
                <settingsItem.icon
                  className={`h-5 w-5 flex-shrink-0 ${
                    settingsItem.current ? 'text-green-500' : 'text-gray-400 group-hover:text-gray-500'
                  }`}
                />
                {!desktopSidebarCollapsed && settingsItem.name}
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className={desktopContentOffsetClass}>
        {/* Top navigation */}
        <div className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/88 shadow-[0_8px_24px_rgba(15,23,42,0.05)] backdrop-blur-xl">
          <div className="flex h-16 items-center px-4 sm:px-6 lg:px-8">
            <div className="flex items-center min-w-0">
              <button
                onClick={() => setSidebarOpen(true)}
                className={`${topControlButtonClass} md:hidden`}
                aria-label="Open navigation"
              >
                <Bars3Icon className="h-6 w-6" />
              </button>

              <button
                type="button"
                onClick={() => setDesktopSidebarCollapsed((prev) => !prev)}
                className={`hidden md:inline-flex ${topControlButtonClass}`}
                aria-label={desktopSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                title={desktopSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {desktopSidebarCollapsed ? (
                  <ChevronDoubleRightIcon className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-0.5" />
                ) : (
                  <ChevronDoubleLeftIcon className="h-5 w-5 transition-transform duration-200 group-hover:-translate-x-0.5" />
                )}
              </button>

              {showBackHomeButton && (
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className={backButtonClass}
                  aria-label="Go back to home"
                >
                  <ArrowLeftIcon className="h-[18px] w-[18px] transition-transform duration-200 group-hover:-translate-x-0.5" />
                  <span className="hidden sm:inline">Back</span>
                </button>
              )}
            </div>

            <div className="ml-auto flex items-center space-x-3">
              <ThemeToggle className="h-11 w-11" />
              <LanguageSwitcher className="hidden lg:inline-flex" />
              {/* Notifications dropdown */}
              <div
                className="relative"
                ref={notificationsMenuRef}
              >
                <button
                  onClick={() => setNotificationsMenuOpen((prev) => !prev)}
                  className="relative p-2 text-gray-500 hover:text-gray-700 rounded-md hover:bg-gray-100"
                  aria-label="Notifications"
                  aria-expanded={notificationsMenuOpen}
                  aria-haspopup="menu"
                >
                  <BellAlertIcon className="h-6 w-6" />
                  {unreadNotifications > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
                      {unreadNotifications > 99 ? '99+' : unreadNotifications}
                    </span>
                  )}
                </button>

                {notificationsMenuOpen && (
                  <div className="absolute right-0 top-full pt-2 z-30 w-[min(92vw,380px)]">
                    <div className="rounded-xl border border-gray-200 bg-white shadow-xl overflow-hidden">
                      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                        <p className="text-sm font-semibold text-gray-900">{t('nav_notifications', 'Notifications')}</p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleMarkAllAsRead}
                            disabled={notificationActionLoading || unreadNotifications === 0}
                            className="text-xs font-medium text-gray-600 hover:text-gray-800 disabled:opacity-50"
                          >
                            {t('notifications_mark_all_read', 'Mark all read')}
                          </button>
                          <button
                            onClick={() => {
                              setNotificationsMenuOpen(false);
                              navigate('/app/notifications');
                            }}
                            className="text-xs font-medium text-emerald-700 hover:text-emerald-800"
                          >
                            {t('dashboard_view_all', 'View all')}
                          </button>
                        </div>
                      </div>

                      <div className="max-h-[420px] overflow-y-auto">
                        {notificationsLoading ? (
                          <div className="px-4 py-8 text-center text-sm text-gray-500">{t('common_loading', 'Loading...')}</div>
                        ) : latestNotifications.length === 0 ? (
                          <div className="px-4 py-8 text-center">
                            <InboxIcon className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                            <p className="text-sm text-gray-500">{t('notifications_empty_title', 'No notifications yet.')}</p>
                          </div>
                        ) : (
                          <div className="divide-y divide-gray-100">
                            {latestNotifications.map((notification) => (
                              <div
                                key={notification.id}
                                className={`px-4 py-3 cursor-pointer transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-inset ${notification.isRead ? 'bg-white' : 'bg-emerald-50/40'}`}
                                onClick={() => handleNotificationClick(notification)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    handleNotificationClick(notification);
                                  }
                                }}
                                role="button"
                                tabIndex={0}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-gray-900 inline-flex items-center gap-1.5">
                                      {notification.type === 'team_invite' ? (
                                        <BellAlertIcon className="h-4 w-4 text-amber-500" />
                                      ) : (
                                        <ClipboardDocumentCheckIcon className="h-4 w-4 text-blue-500" />
                                      )}
                                      <span className="truncate">{notification.title}</span>
                                    </p>
                                    <p
                                      className="mt-1 text-xs text-gray-600 overflow-hidden"
                                      style={{
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical'
                                      }}
                                    >
                                      {notification.message}
                                    </p>
                                    {notification.sender && (
                                      <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-gray-50 px-2 py-1">
                                        <img
                                          src={resolveNotificationSenderAvatar(notification)}
                                          alt={`${resolveNotificationSenderName(notification)} avatar`}
                                          className="h-4 w-4 rounded-full object-cover border border-gray-200 bg-gray-100"
                                          onError={(e) => {
                                            const fallbackUrl = buildAssetUrl();
                                            if (e.currentTarget.src !== fallbackUrl) {
                                              e.currentTarget.src = fallbackUrl;
                                            }
                                          }}
                                        />
                                        <span className="text-[10px] text-gray-700">
                                          {resolveNotificationSenderName(notification)}
                                        </span>
                                      </div>
                                    )}
                                    <p className="mt-1 text-[11px] text-gray-400">
                                      {new Date(notification.createdAt).toLocaleString()}
                                    </p>
                                  </div>
                                  {!notification.isRead && (
                                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-700">
                                      {t('common_new', 'New')}
                                    </span>
                                  )}
                                </div>

                                <div className="mt-2 flex flex-wrap gap-1.5" onClick={(event) => event.stopPropagation()}>
                                  {canRespondToInvite(notification) && (
                                    <>
                                      <button
                                        onClick={() => handleInviteAction(notification, 'accept')}
                                        disabled={notificationActionLoading}
                                        className="inline-flex items-center gap-1 rounded-md bg-green-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-green-700 disabled:opacity-50"
                                      >
                                        <CheckIcon className="h-3.5 w-3.5" />
                                         {t('teams_accept', 'Accept')}
                                      </button>
                                      <button
                                        onClick={() => handleInviteAction(notification, 'decline')}
                                        disabled={notificationActionLoading}
                                        className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-red-700 disabled:opacity-50"
                                      >
                                        <XMarkIcon className="h-3.5 w-3.5" />
                                         {t('teams_decline', 'Decline')}
                                      </button>
                                    </>
                                  )}

                                  {canRespondToLeaveRequest(notification) && (
                                    <>
                                      <button
                                        onClick={() => handleLeaveRequestAction(notification, 'accept')}
                                        disabled={notificationActionLoading}
                                        className="inline-flex items-center gap-1 rounded-md bg-green-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-green-700 disabled:opacity-50"
                                      >
                                        <CheckIcon className="h-3.5 w-3.5" />
                                         {t('notifications_approve_leave', 'Approve Leave')}
                                      </button>
                                      <button
                                        onClick={() => handleLeaveRequestAction(notification, 'decline')}
                                        disabled={notificationActionLoading}
                                        className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-red-700 disabled:opacity-50"
                                      >
                                        <XMarkIcon className="h-3.5 w-3.5" />
                                         {t('teams_decline', 'Decline')}
                                      </button>
                                    </>
                                  )}

                                  {canRespondToJoinRequest(notification) && (
                                    <>
                                      <button
                                        onClick={() => handleJoinRequestAction(notification, 'accept')}
                                        disabled={notificationActionLoading}
                                        className="inline-flex items-center gap-1 rounded-md bg-green-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-green-700 disabled:opacity-50"
                                      >
                                        <CheckIcon className="h-3.5 w-3.5" />
                                         {t('booking_approve_join', 'Approve Join')}
                                      </button>
                                      <button
                                        onClick={() => handleJoinRequestAction(notification, 'decline')}
                                        disabled={notificationActionLoading}
                                        className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-red-700 disabled:opacity-50"
                                      >
                                        <XMarkIcon className="h-3.5 w-3.5" />
                                         {t('teams_decline', 'Decline')}
                                      </button>
                                    </>
                                  )}

                                  {canRespondToBookingJoinRequest(notification) && (
                                    <>
                                      <button
                                        onClick={() => handleBookingJoinRequestAction(notification, 'accept')}
                                        disabled={notificationActionLoading}
                                        className="inline-flex items-center gap-1 rounded-md bg-green-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-green-700 disabled:opacity-50"
                                      >
                                        <CheckIcon className="h-3.5 w-3.5" />
                                         {t('booking_approve_join', 'Approve Join')}
                                      </button>
                                      <button
                                        onClick={() => handleBookingJoinRequestAction(notification, 'decline')}
                                        disabled={notificationActionLoading}
                                        className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-red-700 disabled:opacity-50"
                                      >
                                        <XMarkIcon className="h-3.5 w-3.5" />
                                         {t('teams_decline', 'Decline')}
                                      </button>
                                    </>
                                  )}

                                  {notification.metadata?.teamId && (
                                    <button
                                      onClick={() => navigate(`/app/teams/${notification.metadata.teamId}`)}
                                      className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50"
                                    >
                                      <EyeIcon className="h-3.5 w-3.5" />
                                      {t('notifications_view_team', 'View Team')}
                                    </button>
                                  )}

                                  {!notification.isRead && (
                                    <button
                                      onClick={() => handleMarkAsRead(notification.id)}
                                      disabled={notificationActionLoading}
                                      className="inline-flex items-center rounded-md border border-emerald-200 px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                                    >
                                      {t('notifications_mark_read', 'Mark read')}
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="sr-only" aria-live="polite">
                <h1>{pageInfo.title}</h1>
                <p>{pageInfo.subtitle}</p>
              </div>
              <Outlet />
            </div>
          </div>
        </main>
      </div>
      <ImagePreviewModal
        open={imagePreviewOpen}
        imageUrl={resolveAvatarUrl()}
        title="Profile photo"
        onClose={() => setImagePreviewOpen(false)}
      />
    </div>
  );
};

export default AppLayout;



