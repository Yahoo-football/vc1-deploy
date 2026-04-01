import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRealtime } from '../context/RealtimeContext';
import { useLanguage } from '../context/LanguageContext';
import userService from '../services/userService';
import { AnimatedStatValue, ConfirmationModal, ImagePreviewModal, useDialog, useToast } from '../components/ui';
import { ChatBubbleLeftRightIcon, EllipsisVerticalIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import { buildAssetUrl } from '../config/appConfig';
import { formatRoleLabel } from '../utils/formatters';

const ROLES = ['player', 'captain', 'field_owner', 'admin'];
const STATUSES = ['active', 'inactive', 'suspended'];
const PAGE_SIZE = 10;

const ROLE_PRIORITY = {
  admin: 4,
  field_owner: 3,
  captain: 2,
  player: 1
};

const getTimestamp = (value) => {
  const timestamp = Date.parse(value || '');
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const compareNewestFirst = (leftUser, rightUser) => {
  const createdAtDiff = getTimestamp(rightUser.createdAt) - getTimestamp(leftUser.createdAt);
  if (createdAtDiff !== 0) return createdAtDiff;
  return Number(rightUser.id || 0) - Number(leftUser.id || 0);
};

const getUserActivityScore = (user) => {
  const ownedFields = Array.isArray(user?.fields) ? user.fields.length : 0;
  const teams = Array.isArray(user?.teams) ? user.teams.length : 0;
  const createdBookings = Array.isArray(user?.createdBookings) ? user.createdBookings.length : 0;
  const roleWeight = ROLE_PRIORITY[user?.role] || 0;

  return ownedFields * 10 + teams * 6 + createdBookings * 3 + roleWeight;
};

const sortUsers = (list, sortBy) => {
  const nextUsers = [...list];

  return nextUsers.sort((leftUser, rightUser) => {
    if (sortBy === 'oldest') {
      return compareNewestFirst(rightUser, leftUser);
    }

    if (sortBy === 'activity') {
      const activityDiff = getUserActivityScore(rightUser) - getUserActivityScore(leftUser);
      if (activityDiff !== 0) return activityDiff;

      const lastLoginDiff = getTimestamp(rightUser.lastLogin) - getTimestamp(leftUser.lastLogin);
      if (lastLoginDiff !== 0) return lastLoginDiff;
    }

    return compareNewestFirst(leftUser, rightUser);
  });
};

// Support status badge class for this page.
const statusBadgeClass = (status) => {
  if (status === 'active') return 'bg-green-100 text-green-700';
  if (status === 'suspended') return 'bg-red-100 text-red-700';
  return 'bg-gray-200 text-gray-700';
};

// Support role badge class for this page.
const roleBadgeClass = (role) => {
  if (role === 'admin') return 'bg-blue-100 text-blue-700';
  if (role === 'field_owner') return 'bg-amber-100 text-amber-700';
  if (role === 'captain') return 'bg-violet-100 text-violet-700';
  return 'bg-slate-100 text-slate-700';
};

const resolveAvatarUrl = (user) => {
  return buildAssetUrl(user?.avatarUrl || user?.avatar_url);
};

const AdminUsersPage = () => {
  const { version } = useRealtime();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState(null);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [openMenuUserId, setOpenMenuUserId] = useState(null);
  const [editUser, setEditUser] = useState(null);
  const [viewUser, setViewUser] = useState(null);
  const [viewUserLoading, setViewUserLoading] = useState(false);
  const [fieldOwnerViewer, setFieldOwnerViewer] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [editForm, setEditForm] = useState({ role: 'player', status: 'active' });
  const { confirm } = useDialog();
  const { showToast } = useToast();
  const { t } = useLanguage();
  const actionMenuRef = useRef(null);
  const navigate = useNavigate();

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await userService.getAllUsers();
      setUsers(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      showToast(error.error || t('admin_users_load_failed', 'Failed to load users.'), { type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [showToast, t]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers, version]);

  useEffect(() => {
    if (!openMenuUserId) return undefined;

    // Handle pointer down interactions.
    const handlePointerDown = (event) => {
      if (!actionMenuRef.current?.contains(event.target)) {
        setOpenMenuUserId(null);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [openMenuUserId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [query, roleFilter, statusFilter, sortBy]);

  const stats = useMemo(() => {
    return {
      total: users.length,
      active: users.filter((user) => (user.status || 'active') === 'active').length,
      players: users.filter((user) => user.role === 'player').length,
      captains: users.filter((user) => user.role === 'captain').length,
      fieldOwners: users.filter((user) => user.role === 'field_owner').length,
      admins: users.filter((user) => user.role === 'admin').length,
      suspended: users.filter((user) => user.status === 'suspended').length
    };
  }, [users]);

  const roleTabs = useMemo(
    () => [
      { key: 'all', label: t('admin_users_tab_all', 'All users'), count: stats.total },
      { key: 'player', label: t('role_player', 'Player'), count: stats.players },
      { key: 'captain', label: t('role_captain', 'Captain'), count: stats.captains },
      { key: 'field_owner', label: t('role_field_owner', 'Field Owner'), count: stats.fieldOwners },
      { key: 'admin', label: t('role_admin', 'Admin'), count: stats.admins }
    ],
    [stats, t]
  );

  const sortOptions = useMemo(
    () => [
      { value: 'newest', label: t('admin_users_sort_newest', 'Newest first') },
      { value: 'oldest', label: t('admin_users_sort_oldest', 'Oldest first') },
      { value: 'activity', label: t('admin_users_sort_activity', 'Most active') }
    ],
    [t]
  );

  const filteredUsers = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const matchingUsers = users.filter((user) => {
      const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim().toLowerCase();
      const matchText =
        !keyword ||
        String(user.username || '').toLowerCase().includes(keyword) ||
        String(user.email || '').toLowerCase().includes(keyword) ||
        fullName.includes(keyword);
      const matchRole = roleFilter === 'all' || user.role === roleFilter;
      const matchStatus = statusFilter === 'all' || (user.status || 'active') === statusFilter;
      return matchText && matchRole && matchStatus;
    });
    return sortUsers(matchingUsers, sortBy);
  }, [users, query, roleFilter, statusFilter, sortBy]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE)),
    [filteredUsers.length]
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const effectiveCurrentPage = Math.min(currentPage, totalPages);

  const paginatedUsers = useMemo(() => {
    const startIndex = (effectiveCurrentPage - 1) * PAGE_SIZE;
    return filteredUsers.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredUsers, effectiveCurrentPage]);

  const pageSummary = useMemo(() => {
    if (filteredUsers.length === 0) {
      return { start: 0, end: 0 };
    }

    const start = (effectiveCurrentPage - 1) * PAGE_SIZE + 1;
    const end = Math.min(filteredUsers.length, effectiveCurrentPage * PAGE_SIZE);
    return { start, end };
  }, [filteredUsers.length, effectiveCurrentPage]);

  const visiblePageNumbers = useMemo(() => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const startPage = Math.max(1, effectiveCurrentPage - 2);
    const endPage = Math.min(totalPages, startPage + 4);
    const adjustedStartPage = Math.max(1, endPage - 4);

    return Array.from({ length: endPage - adjustedStartPage + 1 }, (_, index) => adjustedStartPage + index);
  }, [totalPages, effectiveCurrentPage]);

  // Handle delete interactions.
  const handleDelete = async (userId, username) => {
    setOpenMenuUserId(null);
    const confirmed = await confirm(
      t('admin_users_delete_confirm', 'Delete user @{{username}}? This cannot be undone.', { username }),
      { title: t('admin_users_delete_title', 'Delete User') }
    );
    if (!confirmed) return;

    try {
      setSavingUserId(userId);
      await userService.deleteUser(userId);
      setUsers((prev) => prev.filter((user) => user.id !== userId));
      showToast(t('admin_users_delete_success', 'User deleted successfully.'), { type: 'success' });
    } catch (error) {
      showToast(error.error || t('admin_users_delete_failed', 'Failed to delete user.'), { type: 'error' });
    } finally {
      setSavingUserId(null);
    }
  };

  // Open edit modal in the UI.
  const openEditModal = (user) => {
    setOpenMenuUserId(null);
    setEditUser(user);
    setEditForm({
      role: user.role || 'player',
      status: user.status || 'active'
    });
  };

  // Close edit modal in the UI.
  const closeEditModal = () => {
    if (savingUserId) return;
    setEditUser(null);
  };

  const openViewModal = async (user) => {
    if (openMenuUserId === user.id) return;
    setViewUser(user);
    setViewUserLoading(true);
    try {
      const response = await userService.getUserById(user.id);
      setViewUser(response?.data || user);
    } catch (error) {
      showToast(error.error || t('admin_users_details_failed', 'Failed to load user details.'), { type: 'error' });
    } finally {
      setViewUserLoading(false);
    }
  };

  // Close view modal in the UI.
  const closeViewModal = () => {
    setViewUserLoading(false);
    setViewUser(null);
  };

  const closeFieldOwnerViewer = () => {
    setFieldOwnerViewer(null);
  };

  const getOwnedFields = (user) => {
    return Array.isArray(user?.fields) ? user.fields : [];
  };

  const getActivePlayerTeams = (user) => {
    const teams = Array.isArray(user?.teams) ? user.teams : [];
    return teams.filter((team) => {
      const membership = team?.TeamMember;
      if (!membership) return false;
      return membership.status === 'active' && membership.isActive !== false;
    });
  };

  const handleEditFormChange = (event) => {
    const { name, value } = event.target;
    setEditForm((current) => ({ ...current, [name]: value }));
  };

  // Handle save edit interactions.
  const handleSaveEdit = async () => {
    if (!editUser?.id) return;

    try {
      setSavingUserId(editUser.id);
      const response = await userService.updateUser(editUser.id, editForm);
      const updatedUser = response.data || {};
      setUsers((prev) =>
        prev.map((user) =>
          user.id === editUser.id
            ? {
                ...user,
                role: updatedUser.role || editForm.role,
                status: updatedUser.status || editForm.status
              }
            : user
        )
      );
      showToast(t('admin_users_update_success', 'User updated successfully.'), { type: 'success' });
      setEditUser(null);
    } catch (error) {
      showToast(error.error || t('admin_users_update_failed', 'Failed to update user.'), { type: 'error' });
    } finally {
      setSavingUserId(null);
    }
  };

  const openChatForUser = (targetUserId) => {
    if (!targetUserId) return;
    setOpenMenuUserId(null);
    navigate(`/app/chat?user=${targetUserId}`);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-indigo-50/70 p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center rounded-full bg-white/85 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700 ring-1 ring-indigo-100">
            {t('admin_users_badge', 'Admin Users')}
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950">{t('dashboard_admin_manage_users', 'Manage users')}</h1>
          <p className="mt-2 text-sm text-slate-600">{t('admin_users_subtitle', 'Update roles, account status, and remove users with a cleaner overview.')}</p>
        </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-100/80 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-gray-500">{t('admin_users_total', 'Total')}</p>
          <AnimatedStatValue value={stats.total} className="mt-1 text-2xl font-bold text-gray-900" />
        </div>
        <div className="rounded-[24px] border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-emerald-100/70 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-gray-500">{t('dashboard_admin_active', 'Active')}</p>
          <AnimatedStatValue value={stats.active} className="mt-1 text-2xl font-bold text-green-700" />
        </div>
        <div className="rounded-[24px] border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-blue-100/70 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-gray-500">{t('admin_users_admins', 'Admins')}</p>
          <AnimatedStatValue value={stats.admins} className="mt-1 text-2xl font-bold text-blue-700" />
        </div>
        <div className="rounded-[24px] border border-red-100 bg-gradient-to-br from-red-50 via-white to-red-100/70 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-gray-500">{t('dashboard_admin_suspended', 'Suspended')}</p>
          <AnimatedStatValue value={stats.suspended} className="mt-1 text-2xl font-bold text-red-700" />
        </div>
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {roleTabs.map((tab) => {
            const isActive = roleFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setRoleFilter(tab.key)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  isActive
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`inline-flex min-w-[1.75rem] items-center justify-center rounded-full px-2 py-0.5 text-xs ${
                    isActive ? 'bg-white text-emerald-700' : 'bg-white text-slate-500'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          {t('admin_users_role_hint', 'Filter users by role so admins can review players, captains, and field owners faster.')}
        </p>
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(180px,1fr)_minmax(180px,1fr)]">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('admin_users_search_placeholder', 'Search username, email, or name')}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="all">{t('admin_users_all_statuses', 'All statuses')}</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status === 'active' ? t('dashboard_admin_active', 'Active') : status === 'suspended' ? t('dashboard_admin_suspended', 'Suspended') : t('admin_users_inactive', 'Inactive')}
              </option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full table-fixed divide-y divide-gray-200 text-sm">
          <colgroup>
            <col className="w-[340px]" />
            <col className="w-[380px]" />
            <col className="w-[170px]" />
            <col className="w-[150px]" />
            <col className="w-[110px]" />
          </colgroup>
          <thead className="bg-gray-50">
            <tr>
              <th className="px-5 py-3.5 text-left text-[13px] font-semibold tracking-wide text-gray-700">{t('admin_users_user', 'User')}</th>
              <th className="px-5 py-3.5 text-left text-[13px] font-semibold tracking-wide text-gray-700">{t('admin_users_email', 'Email')}</th>
              <th className="px-5 py-3.5 text-center text-[13px] font-semibold tracking-wide text-gray-700">{t('admin_users_role', 'Role')}</th>
              <th className="px-5 py-3.5 text-center text-[13px] font-semibold tracking-wide text-gray-700">{t('admin_users_status', 'Status')}</th>
              <th className="px-5 py-3.5 text-center text-[13px] font-semibold tracking-wide text-gray-700">{t('admin_users_actions', 'Actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-gray-500">{t('admin_users_loading', 'Loading users...')}</td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-gray-500">{t('admin_users_none_found', 'No users found with current filters.')}</td>
              </tr>
            ) : (
              paginatedUsers.map((user) => {
                const isSaving = savingUserId === user.id;
                const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username;
                const status = user.status || 'active';
                return (
                  <tr
                    key={user.id}
                    className="group cursor-pointer align-middle transition-colors hover:bg-gray-50/90"
                    onClick={() => openViewModal(user)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openViewModal(user);
                      }
                    }}
                    tabIndex={0}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={resolveAvatarUrl(user)}
                          alt={`${fullName} avatar`}
                          className="h-9 w-9 rounded-full border border-gray-200 bg-gray-100 object-cover"
                          onError={(event) => {
                            const fallbackUrl = buildAssetUrl();
                            if (event.currentTarget.src !== fallbackUrl) {
                              event.currentTarget.src = fallbackUrl;
                            }
                          }}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-[15px] font-semibold leading-5 text-gray-900">{fullName}</p>
                          <p className="truncate text-[13px] text-gray-500">@{user.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-700">
                      <p className="truncate text-sm text-gray-700">{user.email}</p>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold ${roleBadgeClass(user.role)}`}>
                        {user.role === 'field_owner' ? t('role_field_owner', 'Field Owner') : user.role === 'captain' ? t('role_captain', 'Captain') : user.role === 'admin' ? t('role_admin', 'Admin') : t('role_player', 'Player')}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold ${statusBadgeClass(status)}`}>
                        {status === 'active' ? t('dashboard_admin_active', 'Active') : status === 'suspended' ? t('dashboard_admin_suspended', 'Suspended') : t('admin_users_inactive', 'Inactive')}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <div
                        className="relative inline-flex items-center justify-center"
                        ref={openMenuUserId === user.id ? actionMenuRef : null}
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        <button
                          type="button"
                          aria-label={`Open actions for ${fullName}`}
                          aria-expanded={openMenuUserId === user.id}
                          onClick={(event) => {
                            event.stopPropagation();
                            setOpenMenuUserId((current) => (current === user.id ? null : user.id));
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:opacity-60"
                          disabled={isSaving}
                        >
                          <EllipsisVerticalIcon className="h-4.5 w-4.5" />
                        </button>

                        {openMenuUserId === user.id && (
                          <div className="absolute right-0 top-12 z-20 w-40 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl shadow-gray-200/70">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openChatForUser(user.id);
                              }}
                              className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                            >
                              <ChatBubbleLeftRightIcon className="h-4 w-4 text-emerald-600" />
                              Chat
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openEditModal(user);
                              }}
                              className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                            >
                              <PencilSquareIcon className="h-4 w-4 text-green-600" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleDelete(user.id, user.username);
                              }}
                              className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-red-700 transition hover:bg-red-50"
                            >
                              <TrashIcon className="h-4 w-4" />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {!loading && filteredUsers.length > 0 && (
        <div className="flex flex-col gap-3 rounded-[28px] border border-slate-200 bg-white px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            {t('admin_users_showing', 'Showing {{start}}-{{end}} of {{total}} users', {
              start: pageSummary.start,
              end: pageSummary.end,
              total: filteredUsers.length
            })}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={effectiveCurrentPage === 1}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('admin_users_prev_page', 'Previous')}
            </button>

            {visiblePageNumbers.map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                onClick={() => setCurrentPage(pageNumber)}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition ${
                  effectiveCurrentPage === pageNumber
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {pageNumber}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={effectiveCurrentPage === totalPages}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('admin_users_next_page', 'Next')}
            </button>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={Boolean(editUser)}
        title={editUser ? (`${editUser.firstName || ''} ${editUser.lastName || ''}`.trim() || editUser.username) : 'Edit User'}
        message={editUser ? `Update @${editUser.username}'s role and account status.` : ''}
        badgeLabel="Edit User"
        confirmLabel={editUser && savingUserId === editUser.id ? 'Saving...' : 'Save Changes'}
        cancelLabel="Cancel"
        variant="default"
        onConfirm={handleSaveEdit}
        onClose={closeEditModal}
      >
        <div className="space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-gray-700">Role</span>
            <select
              name="role"
              value={editForm.role}
              onChange={handleEditFormChange}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {formatRoleLabel(role)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-gray-700">Status</span>
            <select
              name="status"
              value={editForm.status}
              onChange={handleEditFormChange}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {formatRoleLabel(status)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </ConfirmationModal>

      <ConfirmationModal
        isOpen={Boolean(fieldOwnerViewer)}
        title={fieldOwnerViewer ? (`${fieldOwnerViewer.firstName || ''} ${fieldOwnerViewer.lastName || ''}`.trim() || fieldOwnerViewer.username) : 'Field Owner'}
        message={fieldOwnerViewer ? `All fields created by @${fieldOwnerViewer.username}.` : ''}
        badgeLabel="Owned Fields"
        confirmLabel="Close"
        showCancel={false}
        variant="default"
        onConfirm={closeFieldOwnerViewer}
        onClose={closeFieldOwnerViewer}
      >
        {fieldOwnerViewer && (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Field Owner</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {`${fieldOwnerViewer.firstName || ''} ${fieldOwnerViewer.lastName || ''}`.trim() || fieldOwnerViewer.username}
                </p>
              </div>
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-100">
                {getOwnedFields(fieldOwnerViewer).length} field{getOwnedFields(fieldOwnerViewer).length === 1 ? '' : 's'}
              </span>
            </div>

            {getOwnedFields(fieldOwnerViewer).length > 0 ? (
              <div className="space-y-3">
                {getOwnedFields(fieldOwnerViewer).map((field) => (
                  <div key={`owner-field-${field.id}`} className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900">{field.name}</p>
                        <p className="mt-1 text-sm text-gray-600">
                          {[field.address, field.city].filter(Boolean).join(', ') || 'No location'}
                        </p>
                      </div>
                      <span className="whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                        {field.status || 'unknown'}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                      <span>{field.fieldType || 'Unknown type'}</span>
                      <span>•</span>
                      <span>{String(field.surfaceType || 'unknown').replace('_', ' ')}</span>
                      <span>•</span>
                      <span>${field.pricePerHour || 0}/hr</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">
                This field owner has not created any fields yet.
              </div>
            )}
          </div>
        )}
      </ConfirmationModal>

      <ConfirmationModal
        isOpen={Boolean(viewUser)}
        title={viewUser ? (`${viewUser.firstName || ''} ${viewUser.lastName || ''}`.trim() || viewUser.username) : 'User Details'}
        message={viewUser ? `View account information for @${viewUser.username}.` : ''}
        badgeLabel="User Details"
        confirmLabel="Close"
        showCancel={false}
        variant="default"
        onConfirm={closeViewModal}
        onClose={closeViewModal}
      >
        {viewUser && (
          <div className="space-y-5">
            <div className="flex items-center gap-4 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
              <img
                src={resolveAvatarUrl(viewUser)}
                alt={`${viewUser.username} avatar`}
                className="h-16 w-16 cursor-zoom-in rounded-full border border-gray-200 bg-white object-cover transition hover:scale-[1.03]"
                onClick={() =>
                  setPreviewImage({
                    url: resolveAvatarUrl(viewUser),
                    title: `${`${viewUser.firstName || ''} ${viewUser.lastName || ''}`.trim() || viewUser.username} image`
                  })
                }
                onError={(event) => {
                  const fallbackUrl = buildAssetUrl();
                  if (event.currentTarget.src !== fallbackUrl) {
                    event.currentTarget.src = fallbackUrl;
                  }
                }}
              />
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold text-gray-900">
                  {`${viewUser.firstName || ''} ${viewUser.lastName || ''}`.trim() || viewUser.username}
                </p>
                <p className="truncate text-sm text-gray-500">@{viewUser.username}</p>
              </div>
              <button
                type="button"
                onClick={() => openChatForUser(viewUser.id)}
                className="ml-auto inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
              >
                <ChatBubbleLeftRightIcon className="h-4 w-4" />
                Chat
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Email</p>
                <p className="mt-2 break-all text-sm text-gray-700">{viewUser.email || 'No email'}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Role</p>
                <p className="mt-2 text-sm font-semibold text-gray-700">{formatRoleLabel(viewUser.role)}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Status</p>
                <p className="mt-2 text-sm font-semibold text-gray-700">{formatRoleLabel(viewUser.status || 'active')}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Phone</p>
                <p className="mt-2 text-sm text-gray-700">{viewUser.phone || 'No phone number'}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Date of Birth</p>
                <p className="mt-2 text-sm text-gray-700">{viewUser.dateOfBirth || viewUser.date_of_birth || 'Not set'}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Address</p>
                <p className="mt-2 text-sm text-gray-700">{viewUser.address || 'No address'}</p>
              </div>
            </div>

            {viewUserLoading ? (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                Loading more details...
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Owned Fields</p>
                    <span className="text-xs font-semibold text-gray-500">{Array.isArray(viewUser.fields) ? viewUser.fields.length : 0}</span>
                  </div>
                  {Array.isArray(viewUser.fields) && viewUser.fields.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {viewUser.fields.map((field) => (
                        <div key={`field-${field.id}`} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm">
                          <p className="font-semibold text-gray-900">{field.name}</p>
                          <p className="text-gray-600">
                            {field.city} · {field.fieldType} · {String(field.surfaceType || '').replace('_', ' ')}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-gray-600">No fields owned.</p>
                  )}
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Captain Teams</p>
                    <span className="text-xs font-semibold text-gray-500">{Array.isArray(viewUser.captainedTeams) ? viewUser.captainedTeams.length : 0}</span>
                  </div>
                  {Array.isArray(viewUser.captainedTeams) && viewUser.captainedTeams.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {viewUser.captainedTeams.map((team) => (
                        <div key={`captain-team-${team.id}`} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm">
                          <p className="font-semibold text-gray-900">{team.name}</p>
                          <p className="text-gray-600">
                            {team.skillLevel} · {team.isActive ? 'Active' : 'Inactive'}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-gray-600">No captain teams.</p>
                  )}
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Player Teams</p>
                    <span className="text-xs font-semibold text-gray-500">{getActivePlayerTeams(viewUser).length}</span>
                  </div>
                  {getActivePlayerTeams(viewUser).length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {getActivePlayerTeams(viewUser).map((team) => (
                        <div key={`player-team-${team.id}`} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm">
                          <p className="font-semibold text-gray-900">{team.name}</p>
                          <p className="text-gray-600">
                            {team.skillLevel} · {team.isActive ? 'Active' : 'Inactive'} · {team?.TeamMember?.role || 'player'}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-gray-600">No active player teams.</p>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </ConfirmationModal>

      <ImagePreviewModal
        open={Boolean(previewImage)}
        imageUrl={previewImage?.url}
        title={previewImage?.title || 'User image'}
        onClose={() => setPreviewImage(null)}
      />
    </div>
  );
};

export default AdminUsersPage;
