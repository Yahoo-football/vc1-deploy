import React, { useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  ArrowRightIcon,
  Bars3Icon,
  BuildingOffice2Icon,
  HomeIcon,
  ArrowTopRightOnSquareIcon,
  PowerIcon,
  TrophyIcon,
  UserGroupIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { Button, useDialog, useToast } from '../ui';
import { APP_CONFIG } from '../../config/appConfig';
import LanguageSwitcher from '../common/LanguageSwitcher';
import ThemeToggle from '../common/ThemeToggle';

// Render the public layout for shared page structure.
const PublicLayout = () => {
  const { user, isAuthenticated, loading, isLoggingOut, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { confirm } = useDialog();
  const { showToast } = useToast();
  const { t } = useLanguage();

  const dashboardHref = user?.role === 'field_owner' ? '/owner/dashboard' : '/app/dashboard';
  const hasResolvedUser = Boolean(user?.id || user?.username || user?.email);
  const showAuthenticatedActions = !loading && isAuthenticated && hasResolvedUser;

  // Handle logout interactions.
  const handleLogout = async () => {
    if (isLoggingOut) return;
    const confirmed = await confirm(t('public_logout_message', 'តើអ្នកចង់ចាកចេញមែនទេ?'), {
      title: t('action_logout', 'ចាកចេញ'),
      confirmText: t('action_logout', 'ចាកចេញ'),
      cancelText: t('action_cancel', 'បោះបង់'),
      badgeLabel: t('dialog_confirmation', 'ការបញ្ជាក់')
    });
    if (!confirmed) return;
    await logout();
    navigate('/', { replace: true });
  };

  const navItems = useMemo(
    () => [
      { to: '/', label: t('nav_home', 'ទំព័រដើម'), icon: HomeIcon },
      { to: '/fields', label: t('nav_fields', 'ទីលាន'), icon: BuildingOffice2Icon },
      { to: '/league', label: t('nav_league', 'លីគ'), icon: TrophyIcon },
      { to: '/teams', label: t('nav_teams', 'ក្រុម'), icon: UserGroupIcon }
    ],
    [t]
  );

  // Check whether active path is true.
  const isActivePath = (path) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
  const isHomePage = location.pathname === '/';
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';
  const authRouteState = { backgroundLocation: location };

  React.useEffect(() => {
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

  if (isAuthPage) {
    return (
      <div className="min-h-screen bg-slate-950">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(22,163,74,0.12),_transparent_28%),linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)]">
      <header className="sticky top-0 z-20 border-b border-emerald-100/80 bg-[linear-gradient(180deg,rgba(247,254,250,0.98)_0%,rgba(236,253,245,0.94)_100%)] shadow-[0_10px_30px_rgba(15,23,42,0.05)] backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex min-h-[64px] flex-wrap items-center justify-between gap-3 py-1.5 xl:flex-nowrap xl:gap-4">
            <Link
              to="/"
              className="group flex shrink-0 items-center gap-3 rounded-[20px] border border-white/80 bg-white/92 px-4 py-1.5 shadow-[0_10px_24px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_14px_30px_rgba(15,23,42,0.08)]"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-[18px] bg-gradient-to-br from-emerald-500 via-green-600 to-lime-500 text-[1.05rem] font-black tracking-wide text-white shadow-[0_12px_28px_rgba(22,163,74,0.28)]">
                FB
              </span>
              <span className="min-w-0 py-0.5">
                <span className="khmer-brand-font block text-[0.95rem] font-semibold leading-[1.05] text-slate-900 sm:text-[1.3rem]">
                  {APP_CONFIG.brand.displayName}
                </span>
              </span>
            </Link>

            <nav className="hidden min-w-0 flex-1 items-center justify-center xl:flex">
              <div className="flex items-center rounded-full border border-white/80 bg-white/92 p-1 shadow-[0_12px_28px_rgba(15,23,42,0.06)]">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={`group inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                      isActivePath(item.to)
                        ? 'bg-emerald-600 text-white shadow-[0_10px_24px_rgba(5,150,105,0.28)]'
                        : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                    }`}
                  >
                    <item.icon
                      className={`h-4 w-4 ${
                        isActivePath(item.to) ? 'text-white' : 'text-slate-400 group-hover:text-emerald-600'
                      }`}
                    />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </nav>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <ThemeToggle className="h-11 w-11" />
              <LanguageSwitcher className="hidden lg:inline-flex" />
              <button
                type="button"
                onClick={() => setMobileOpen((v) => !v)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 md:hidden"
                aria-label="Toggle menu"
              >
                {mobileOpen ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
              </button>

              {showAuthenticatedActions ? (
                <>
                  <Button
                    as={Link}
                    to={dashboardHref}
                    variant="outline"
                    size="sm"
                    className="hidden rounded-2xl border-white/80 bg-white/92 px-4 text-slate-800 shadow-[0_8px_20px_rgba(15,23,42,0.06)] hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 lg:inline-flex"
                  >
                    <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                    {t('action_go_dashboard', 'ទៅកាន់ផ្ទាំងគ្រប់គ្រង')}
                  </Button>
                  <Button
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    size="sm"
                    className="hidden rounded-2xl bg-gradient-to-r from-emerald-600 to-green-600 px-4 text-white shadow-[0_10px_24px_rgba(22,163,74,0.24)] hover:-translate-y-0.5 hover:from-emerald-700 hover:to-green-700 lg:inline-flex"
                  >
                    <PowerIcon className="h-4 w-4" />
                    {isLoggingOut ? t('public_logging_out', 'កំពុងចាកចេញ...') : t('action_logout', 'ចាកចេញ')}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    as={Link}
                    to="/login"
                    state={authRouteState}
                    variant="outline"
                    size="sm"
                    className="hidden rounded-2xl border-white/80 bg-white/92 px-4 lg:inline-flex"
                  >
                    {t('nav_login', 'ចូលគណនី')}
                  </Button>
                  <Button
                    as={Link}
                    to="/register"
                    state={authRouteState}
                    size="sm"
                    className="hidden rounded-2xl px-4 shadow-[0_12px_24px_rgba(22,163,74,0.22)] lg:inline-flex"
                  >
                    {t('nav_register', 'ចុះឈ្មោះ')}
                    <ArrowRightIcon className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {mobileOpen && (
            <div className="pb-5 md:hidden">
              <div className="overflow-hidden rounded-3xl border border-emerald-100 bg-white/95 p-3 shadow-[0_18px_44px_rgba(15,23,42,0.09)]">
                <div className="space-y-1">
                  <div className="px-1 pb-2">
                    <div className="flex items-center gap-2">
                      <ThemeToggle className="h-11 w-11 shrink-0" />
                      <LanguageSwitcher className="w-full justify-between" />
                    </div>
                  </div>
                  {navItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold transition ${
                        isActivePath(item.to)
                          ? 'bg-emerald-600 text-white shadow-[0_12px_24px_rgba(5,150,105,0.22)]'
                          : 'text-slate-700 hover:bg-emerald-50 hover:text-emerald-700'
                      }`}
                    >
                      <item.icon
                        className={`h-5 w-5 ${isActivePath(item.to) ? 'text-white' : 'text-slate-400'}`}
                      />
                      {item.label}
                    </NavLink>
                  ))}
                </div>

                <div className="mt-4 flex gap-2">
                  {showAuthenticatedActions ? (
                    <>
                      <Button
                        as={Link}
                        to={dashboardHref}
                        variant="outline"
                        size="sm"
                        className="flex-1 rounded-full border-slate-300 bg-white"
                      >
                        {t('nav_dashboard', 'ផ្ទាំងគ្រប់គ្រង')}
                      </Button>
                      <Button onClick={handleLogout} disabled={isLoggingOut} size="sm" className="flex-1 rounded-full">
                        {isLoggingOut ? t('public_logging_out', 'កំពុងចាកចេញ...') : t('action_logout', 'ចាកចេញ')}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        as={Link}
                        to="/login"
                        state={authRouteState}
                        variant="outline"
                        size="sm"
                        className="flex-1 rounded-full border-slate-300 bg-white"
                      >
                        {t('nav_login', 'ចូលគណនី')}
                      </Button>
                      <Button
                        as={Link}
                        to="/register"
                        state={authRouteState}
                        size="sm"
                        className="flex-1 rounded-full"
                      >
                        {t('nav_register', 'ចុះឈ្មោះ')}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className={`mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 ${isHomePage ? 'py-0' : 'py-8'}`}>
        <Outlet />
      </main>
    </div>
  );
};

export default PublicLayout;
