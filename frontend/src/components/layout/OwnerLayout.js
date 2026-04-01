import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useRealtime } from '../../context/RealtimeContext';
import {
  HomeIcon,
  BuildingOfficeIcon,
  CalendarIcon,
  TrophyIcon,
  ArrowLeftIcon,
  Cog6ToothIcon,
  BellAlertIcon,
  ClipboardDocumentCheckIcon,
  ChatBubbleLeftRightIcon,
  EyeIcon,
  InboxIcon,
  Bars3Icon,
  XMarkIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon
} from '@heroicons/react/24/outline';
import notificationService from '../../services/notificationService';
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

// Render the owner layout for shared page structure.
const OwnerLayout = () => {
  const { user } = useAuth();
  const { version } = useRealtime();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('ownerDesktopSidebarCollapsed') === 'true';
  });
  const [notifications, setNotifications] = useState([]);
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [notificationsMenuOpen, setNotificationsMenuOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationActionLoading, setNotificationActionLoading] = useState(false);
  const notificationsMenuRef = useRef(null);
  const { showToast } = useToast();
  const { t } = useLanguage();

  const userDisplayName =
    `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.username || 'User';
  const settingsItem = {
    name: t('nav_settings', 'Settings'),
    href: '/owner/settings',
    icon: Cog6ToothIcon,
    current: location.pathname === '/owner/settings'
  };
  const profileCurrent = location.pathname === '/owner/profile';

  const navigation = [
    {
      name: t('nav_dashboard', 'Dashboard'),
      href: '/owner/dashboard',
      icon: HomeIcon,
      current: location.pathname === '/owner/dashboard'
    },
    {
      name: t('nav_my_fields', 'My Fields'),
      href: '/owner/fields',
      icon: BuildingOfficeIcon,
      current: location.pathname.startsWith('/owner/fields')
    },
    {
      name: t('nav_leagues', 'Leagues'),
      href: '/owner/league',
      icon: TrophyIcon,
      current: location.pathname.startsWith('/owner/league')
    },
    {
      name: t('nav_bookings', 'Bookings'),
      href: '/owner/bookings',
      icon: CalendarIcon,
      current: location.pathname.startsWith('/owner/bookings')
    },
    {
      name: t('nav_chat', 'Chat'),
      href: '/owner/chat',
      icon: ChatBubbleLeftRightIcon,
      current: location.pathname.startsWith('/owner/chat')
    },
    {
      name: t('nav_matches', 'Matches'),
      href: '/owner/matches',
      icon: TrophyIcon,
      current: location.pathname.startsWith('/owner/matches')
    }
  ].filter(Boolean);
  const desktopSidebarWidthClass = desktopSidebarCollapsed ? 'md:w-20' : 'md:w-64';
  const desktopContentOffsetClass = desktopSidebarCollapsed ? 'md:pl-20' : 'md:pl-64';

  // Format role for display.
  const formatRole = (role) => {
    return formatRoleLabel(role, 'Field Owner');
  };

  // Resolve avatar url into a display-safe value.
  const resolveAvatarUrl = () => {
    return buildAssetUrl(user?.avatarUrl || user?.avatar_url);
  };

  // Resolve notification sender name into a display-safe value.
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

  // Support mark notification read for this module.
  const markNotificationRead = async (notificationId) => {
    await notificationService.markRead(notificationId);
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

    if (notification.metadata?.bookingId || notification.type === 'booking') {
      navigate('/owner/bookings');
      return;
    }

    navigate('/owner/dashboard');
  };

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
    window.localStorage.setItem('ownerDesktopSidebarCollapsed', String(desktopSidebarCollapsed));
  }, [desktopSidebarCollapsed]);

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
                  className={`group flex items-center rounded-md px-2 py-2 text-sm font-medium transition-all duration-200 ${
                    item.current
                      ? 'translate-x-1 rounded-xl bg-green-100 text-green-900 shadow-[0_10px_24px_rgba(34,197,94,0.14)]'
                      : 'text-gray-600 hover:translate-x-1 hover:bg-green-50 hover:text-green-900 hover:shadow-sm'
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon
                    className={`mr-3 h-5 w-5 flex-shrink-0 ${
                      item.current ? 'text-green-500' : 'text-gray-400 group-hover:text-green-700'
                    }`}
                  />
                  {item.name}
                </Link>
              ))}
            </nav>

            <div className="border-t border-gray-200 p-3 space-y-2">
              <Link
                to="/owner/profile"
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
                  <item.icon
                    className={`${desktopSidebarCollapsed ? '' : 'mr-3'} h-5 w-5 flex-shrink-0 ${
                      item.current ? 'text-green-500' : 'text-gray-400 group-hover:text-green-700'
                    }`}
                  />
                  {!desktopSidebarCollapsed && item.name}
                </Link>
              ))}
            </nav>

            <div className={`border-t border-gray-200 space-y-2 ${desktopSidebarCollapsed ? 'p-2' : 'p-3'}`}>
              <Link
                to="/owner/profile"
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

            <div className="ml-4 min-w-0">
              <Link
                to="/"
                className={backButtonClass}
                aria-label="Go back to home"
              >
                <ArrowLeftIcon className="h-[18px] w-[18px] transition-transform duration-200 group-hover:-translate-x-0.5" />
                Back
              </Link>
            </div>

            <div className="ml-auto flex items-center space-x-3">
              <ThemeToggle className="h-11 w-11" />
              <LanguageSwitcher className="hidden lg:inline-flex" />
              <div className="relative" ref={notificationsMenuRef}>
                <button
                  onClick={() => setNotificationsMenuOpen((prev) => !prev)}
                  className="relative rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                  aria-label="Notifications"
                  aria-expanded={notificationsMenuOpen}
                  aria-haspopup="menu"
                >
                  <BellAlertIcon className="h-6 w-6" />
                  {unreadNotifications > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                      {unreadNotifications > 99 ? '99+' : unreadNotifications}
                    </span>
                  )}
                </button>

                {notificationsMenuOpen && (
                  <div className="absolute right-0 top-full z-30 w-[min(92vw,380px)] pt-2">
                    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
                      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                        <p className="text-sm font-semibold text-gray-900">Notifications</p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleMarkAllAsRead}
                            disabled={notificationActionLoading || unreadNotifications === 0}
                            className="text-xs font-medium text-gray-600 hover:text-gray-800 disabled:opacity-50"
                          >
                            Mark all read
                          </button>
                          <button
                            onClick={() => {
                              setNotificationsMenuOpen(false);
                              navigate('/owner/notifications');
                            }}
                            className="text-xs font-medium text-blue-700 hover:text-blue-800"
                          >
                            View all
                          </button>
                        </div>
                      </div>

                      <div className="max-h-[420px] overflow-y-auto">
                        {notificationsLoading ? (
                          <div className="px-4 py-8 text-center text-sm text-gray-500">Loading...</div>
                        ) : latestNotifications.length === 0 ? (
                          <div className="px-4 py-8 text-center">
                            <InboxIcon className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                            <p className="text-sm text-gray-500">No notifications yet.</p>
                          </div>
                        ) : (
                          <div className="divide-y divide-gray-100">
                            {latestNotifications.map((notification) => (
                              <div
                                key={notification.id}
                                className={`cursor-pointer px-4 py-3 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset ${notification.isRead ? 'bg-white' : 'bg-blue-50/40'}`}
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
                                    <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                                      <ClipboardDocumentCheckIcon className="h-4 w-4 text-blue-500" />
                                      <span className="truncate">{notification.title}</span>
                                    </p>
                                    <p
                                      className="mt-1 overflow-hidden text-xs text-gray-600"
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
                                          className="h-4 w-4 rounded-full border border-gray-200 bg-gray-100 object-cover"
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
                                    <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                                      New
                                    </span>
                                  )}
                                </div>

                                <div className="mt-2 flex flex-wrap gap-1.5" onClick={(event) => event.stopPropagation()}>
                                  {(notification.metadata?.bookingId || notification.type === 'booking') && (
                                    <button
                                      onClick={() => navigate('/owner/bookings')}
                                      className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50"
                                    >
                                      <EyeIcon className="h-3.5 w-3.5" />
                                      Open Booking
                                    </button>
                                  )}

                                  {!notification.isRead && (
                                    <button
                                      onClick={() => handleMarkAsRead(notification.id)}
                                      disabled={notificationActionLoading}
                                      className="inline-flex items-center rounded-md border border-blue-200 px-2 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                                    >
                                      Mark read
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

        <main className="flex-1">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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

export default OwnerLayout;



