import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  BellAlertIcon,
  BuildingOffice2Icon,
  CheckCircleIcon,
  ChevronRightIcon,
  ClockIcon,
  EyeIcon,
  EyeSlashIcon,
  LockClosedIcon,
  ShieldCheckIcon,
  SparklesIcon,
  StarIcon,
  SwatchIcon,
  UserCircleIcon,
  XCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../context/RealtimeContext';
import authService from '../services/authService';
import { ImagePreviewModal, useDialog, useToast } from '../components/ui';
import LanguageSwitcher from '../components/common/LanguageSwitcher';
import { ROLE_UPGRADE_CONFIG } from '../config/roleUpgradeConfig';
import { buildAssetUrl } from '../config/appConfig';

const SETTINGS_DEVICE_PREFS_KEY = 'app_settings_device_preferences';

const ROLE_OPTIONS = {
  captain: {
    title: 'Captain Access',
    description: 'Create field bookings, manage team members, approve join requests, and organize open matches.',
    icon: StarIcon,
    accent: 'emerald'
  },
  field_owner: {
    title: 'Field Owner Access',
    description: 'Create fields, manage booking requests, and control your venue schedule.',
    icon: BuildingOffice2Icon,
    accent: 'sky'
  }
};

const STATUS_STYLES = {
  pending: 'bg-amber-50 text-amber-700 border border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  rejected: 'bg-rose-50 text-rose-700 border border-rose-200'
};

const passwordInputClass =
  'mt-1 block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100';

// Toggle class in the UI.
const toggleClass = (enabled) =>
  `relative inline-flex h-7 w-12 items-center rounded-full transition ${
    enabled ? 'bg-emerald-500' : 'bg-slate-300'
  }`;

// Get status icon for the current view.
const getStatusIcon = (status) => {
  switch (status) {
    case 'approved':
      return CheckCircleIcon;
    case 'rejected':
      return XCircleIcon;
    default:
      return ClockIcon;
  }
};

// Format role label for display.
const formatRoleLabel = (role) => {
  if (!role) return 'Unknown';
  return role.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
};

// Format date time for display.
const formatDateTime = (value) => {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString();
};

// Format date for display.
const formatDate = (value) => {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleDateString();
};

// Get default preferences for the current view.
const getDefaultPreferences = () => ({
  emailUpdates: true,
  bookingReminders: true,
  matchAlerts: true,
  compactMode: false,
  startPage: 'dashboard'
});

// Get stored preferences for the current view.
const getStoredPreferences = () => {
  if (typeof window === 'undefined') {
    return getDefaultPreferences();
  }

  try {
    const raw = window.localStorage.getItem(SETTINGS_DEVICE_PREFS_KEY);
    if (!raw) return getDefaultPreferences();
    const parsed = JSON.parse(raw);
    return {
      ...getDefaultPreferences(),
      ...(parsed && typeof parsed === 'object' ? parsed : {})
    };
  } catch {
    return getDefaultPreferences();
  }
};

const PAYMENT_QR_SRC = '/money.png';

const buildRoleUpgradeAlert = (role) =>
  role === 'field_owner'
    ? 'Payment verified. You are becoming a Field Owner.'
    : 'Payment verified. You are becoming a Captain.';

const buildPaymentFailureAlert = (role) =>
  role === 'field_owner'
    ? 'Payment failed for your Field Owner request.'
    : 'Payment failed for your Captain request.';

const resolvePaymentProofUrl = (request) => buildAssetUrl(request?.paymentScreenshotUrl, null);

const buildPaymentReferenceSummary = (form, requestedRole) => {
  const parts = [
    form.paymentMethod.trim(),
    form.transactionId.trim() ? `Ref ${form.transactionId.trim()}` : '',
    form.paymentDate,
    form.paymentTime
  ].filter(Boolean);

  return parts.join(' | ').slice(0, 120) || `UPG-${requestedRole.toUpperCase()}-${Date.now()}`;
};

const buildRoleRequestNote = (form) =>
  [
    form.paymentNote.trim() ? `Reference note: ${form.paymentNote.trim()}` : '',
    form.note.trim() ? `Admin note: ${form.note.trim()}` : ''
  ]
    .filter(Boolean)
    .join('\n');

const UPGRADE_MODAL_STEPS = [
  { number: '01', label: 'Read guide' },
  { number: '02', label: 'Pay with QR' },
  { number: '03', label: 'Fill details' },
  { number: '04', label: 'Get help' },
  { number: '05', label: 'Submit' }
];

const UPGRADE_GUIDE_TIPS = [
  'Read the fee first and pay the exact amount shown for the role upgrade.',
  'Use the same payer name or phone number that appears in your payment app if possible.',
  'Upload a clear screenshot that shows the amount, transfer result, and date or time.'
];

const UPGRADE_SUBMIT_WAIT_MESSAGE =
  'Wait while admin is checking. We will message you later when checking is complete.';

const PreferenceToggle = ({ title, description, enabled, onChange }) => (
  <div className="flex items-start justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-4">
    <div>
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
    </div>
    <button
      type="button"
      onClick={onChange}
      className={toggleClass(enabled)}
      aria-pressed={enabled}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  </div>
);

// Render the settings page.
const SettingsPage = () => {
  const { user, refreshUser } = useAuth();
  const { version } = useRealtime();
  const navigate = useNavigate();
  const location = useLocation();
  const { confirm } = useDialog();
  const { showSuccess, showError } = useToast();
  const accessRequestsRef = useRef(null);
  const [roleRequests, setRoleRequests] = useState([]);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submittingRole, setSubmittingRole] = useState('');
  const [cancellingRequestId, setCancellingRequestId] = useState(null);
  const [preferences, setPreferences] = useState(getStoredPreferences);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordError, setPasswordError] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [focusedRoleKey, setFocusedRoleKey] = useState('');
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [upgradeError, setUpgradeError] = useState('');
  const [previewImage, setPreviewImage] = useState(null);
  const [upgradeForm, setUpgradeForm] = useState({
    requestedRole: '',
    paymentAccountName: '',
    paymentPhone: '',
    paymentMethod: '',
    transactionId: '',
    paymentDate: '',
    paymentTime: '',
    paymentNote: '',
    note: '',
    paymentProof: null,
    paymentProofPreviewUrl: '',
    paymentProofName: ''
  });
  const [showPassword, setShowPassword] = useState({
    current: false,
    next: false,
    confirm: false
  });
  const hasTrackedRoleRequestsRef = useRef(false);
  const roleRequestStatusRef = useRef(new Map());

  const loadRoleRequests = useCallback(async () => {
    try {
      setLoading(true);
      const response = await authService.getRoleRequests();
      setRoleRequests(Array.isArray(response.data?.requests) ? response.data.requests : []);
      setAvailableRoles(Array.isArray(response.data?.availableRoles) ? response.data.availableRoles : []);
      setHasPendingRequest(Boolean(response.data?.hasPendingRequest));
    } catch (err) {
      showError(err.error || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    loadRoleRequests();
  }, [loadRoleRequests, version]);

  useEffect(() => {
    const requestedRole = location.state?.focusRoleRequest;
    if (!requestedRole) return;

    setFocusedRoleKey(requestedRole);
    accessRequestsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    const timeoutId = window.setTimeout(() => {
      setFocusedRoleKey('');
    }, 2200);

    return () => window.clearTimeout(timeoutId);
  }, [location.state]);

  useEffect(() => {
    if (loading) return;

    const nextStatuses = new Map(roleRequests.map((request) => [request.id, request.status]));

    if (!hasTrackedRoleRequestsRef.current) {
      roleRequestStatusRef.current = nextStatuses;
      hasTrackedRoleRequestsRef.current = true;
      return;
    }

    const changedRequests = roleRequests.filter((request) => {
      const previousStatus = roleRequestStatusRef.current.get(request.id);
      return previousStatus && previousStatus !== request.status;
    });

    roleRequestStatusRef.current = nextStatuses;

    if (changedRequests.length === 0) return;

    const approvedRequest = changedRequests.find((request) => request.status === 'approved');
    if (approvedRequest) {
      refreshUser();
      showSuccess(buildRoleUpgradeAlert(approvedRequest.requestedRole));
    }

    changedRequests
      .filter((request) => request.status === 'rejected')
      .forEach((request) => {
        showError(buildPaymentFailureAlert(request.requestedRole));
      });
  }, [loading, refreshUser, roleRequests, showError, showSuccess]);

  const latestRequestByRole = useMemo(
    () =>
      roleRequests.reduce((accumulator, request) => {
        const existing = accumulator[request.requestedRole];
        if (!existing || new Date(request.createdAt) > new Date(existing.createdAt)) {
          accumulator[request.requestedRole] = request;
        }
        return accumulator;
      }, {}),
    [roleRequests]
  );

  const sortedRoleRequests = useMemo(
    () =>
      [...roleRequests].sort((first, second) => {
        const firstDate = new Date(first.createdAt).getTime();
        const secondDate = new Date(second.createdAt).getTime();
        return secondDate - firstDate;
      }),
    [roleRequests]
  );

  const requestSummary = useMemo(
    () =>
      roleRequests.reduce(
        (summary, request) => {
          if (request.status === 'approved') summary.approved += 1;
          else if (request.status === 'rejected') summary.rejected += 1;
          else summary.pending += 1;
          return summary;
        },
        { approved: 0, rejected: 0, pending: 0 }
      ),
    [roleRequests]
  );

  // Support save preferences for this page.
  const savePreferences = (nextPreferences) => {
    setPreferences(nextPreferences);
    window.localStorage.setItem(SETTINGS_DEVICE_PREFS_KEY, JSON.stringify(nextPreferences));
    showSuccess('Settings preferences saved on this device.');
  };

  // Update preference in local state.
  const updatePreference = (key, value) => {
    savePreferences({
      ...preferences,
      [key]: value
    });
  };

  const resetUpgradeForm = useCallback(() => {
    setUpgradeForm((current) => {
      if (current.paymentProofPreviewUrl) {
        window.URL.revokeObjectURL(current.paymentProofPreviewUrl);
      }

      return {
        requestedRole: '',
        paymentAccountName: '',
        paymentPhone: '',
        paymentMethod: '',
        transactionId: '',
        paymentDate: '',
        paymentTime: '',
        paymentNote: '',
        note: '',
        paymentProof: null,
        paymentProofPreviewUrl: '',
        paymentProofName: ''
      };
    });
    setUpgradeError('');
  }, []);

  const openUpgradeModal = (requestedRole) => {
    setUpgradeError('');
    setUpgradeForm({
      requestedRole,
      paymentAccountName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
      paymentPhone: user?.phone || '',
      paymentMethod: '',
      transactionId: '',
      paymentDate: '',
      paymentTime: '',
      paymentNote: '',
      note: '',
      paymentProof: null,
      paymentProofPreviewUrl: '',
      paymentProofName: ''
    });
    setIsUpgradeModalOpen(true);
  };

  const closeUpgradeModal = () => {
    if (submittingRole) return;
    setIsUpgradeModalOpen(false);
    resetUpgradeForm();
  };

  const handleUpgradeFormChange = (event) => {
    const { name, value } = event.target;
    setUpgradeError('');
    setUpgradeForm((current) => ({
      ...current,
      [name]: value
    }));
  };

  const handlePaymentProofChange = (event) => {
    const nextFile = event.target.files?.[0] || null;

    setUpgradeForm((current) => {
      if (current.paymentProofPreviewUrl) {
        window.URL.revokeObjectURL(current.paymentProofPreviewUrl);
      }

      if (!nextFile) {
        return {
          ...current,
          paymentProof: null,
          paymentProofPreviewUrl: '',
          paymentProofName: ''
        };
      }

      return {
        ...current,
        paymentProof: nextFile,
        paymentProofPreviewUrl: window.URL.createObjectURL(nextFile),
        paymentProofName: nextFile.name
      };
    });
  };

  const handleRoleRequest = async (event) => {
    event.preventDefault();

    const requestedRole = upgradeForm.requestedRole;
    const option = ROLE_OPTIONS[requestedRole];
    if (!option) return;

    if (!upgradeForm.paymentAccountName.trim()) {
      setUpgradeError('Please enter the payer account name.');
      return;
    }

    if (!upgradeForm.paymentPhone.trim()) {
      setUpgradeError('Please enter the payment phone number.');
      return;
    }

    if (!upgradeForm.paymentProof) {
      setUpgradeError('Please upload the payment screenshot before clicking Submit.');
      return;
    }

    try {
      setSubmittingRole(requestedRole);

      const paymentReference = buildPaymentReferenceSummary(upgradeForm, requestedRole);
      const requestNote = buildRoleRequestNote(upgradeForm);

      if (requestNote.length > 500) {
        setUpgradeError('Please shorten the reference note or admin note.');
        setSubmittingRole('');
        return;
      }

      await authService.requestRoleUpgrade({
        requestedRole,
        note: requestNote,
        paymentReference,
        paymentAccountName: upgradeForm.paymentAccountName.trim(),
        paymentPhone: upgradeForm.paymentPhone.trim(),
        paymentProof: upgradeForm.paymentProof
      });
      showSuccess(UPGRADE_SUBMIT_WAIT_MESSAGE);
      closeUpgradeModal();
      await loadRoleRequests();
    } catch (err) {
      setUpgradeError(err.error || 'Failed to submit role request');
    } finally {
      setSubmittingRole('');
    }
  };

  // Handle cancel role request interactions.
  const handleCancelRoleRequest = async (request) => {
    const confirmed = await confirm(
      `Delete your pending ${formatRoleLabel(request.requestedRole).toLowerCase()} request? Admins will be notified that you cancelled it.`,
      {
        title: 'Delete Request',
        confirmText: 'Delete Request'
      }
    );
    if (!confirmed) return;

    try {
      setCancellingRequestId(request.id);

      const response = await authService.cancelRoleRequest(request.id);
      showSuccess(
        response.message ||
          `Your ${formatRoleLabel(request.requestedRole).toLowerCase()} request was deleted. Admins have been notified.`
      );
      await loadRoleRequests();
    } catch (err) {
      showError(err.error || 'Failed to delete role request');
    } finally {
      setCancellingRequestId(null);
    }
  };

  useEffect(() => {
    return () => {
      if (upgradeForm.paymentProofPreviewUrl) {
        window.URL.revokeObjectURL(upgradeForm.paymentProofPreviewUrl);
      }
    };
  }, [upgradeForm.paymentProofPreviewUrl]);

  const resetPasswordForm = () => {
    setPasswordForm({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    setPasswordError('');
    setShowPassword({
      current: false,
      next: false,
      confirm: false
    });
  };

  // Close password modal in the UI.
  const closePasswordModal = () => {
    if (changingPassword) return;
    setIsPasswordModalOpen(false);
    resetPasswordForm();
  };

  // Handle password form change interactions.
  const handlePasswordFormChange = (event) => {
    const { name, value } = event.target;
    setPasswordForm((current) => ({
      ...current,
      [name]: value
    }));
  };

  // Handle password submit interactions.
  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setPasswordError('');

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }

    try {
      setChangingPassword(true);
      const response = await authService.changePassword(passwordForm);
      showSuccess(response.message || 'Password changed successfully.');
      setIsPasswordModalOpen(false);
      resetPasswordForm();
    } catch (err) {
      setPasswordError(err.error || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  // Toggle password visibility in the UI.
  const togglePasswordVisibility = (field) => {
    setShowPassword((current) => ({
      ...current,
      [field]: !current[field]
    }));
  };

  const accountOverviewItems = [
    { label: 'Current role', value: formatRoleLabel(user?.role) },
    { label: 'Member since', value: formatDate(user?.createdAt) },
    { label: 'Pending requests', value: requestSummary.pending },
    { label: 'Available upgrades', value: availableRoles.length }
  ];

  const quickLinks = [
    {
      title: 'Profile details',
      description: 'Update your photo and personal information.',
      onClick: () => navigate(user?.role === 'field_owner' ? '/owner/profile' : '/app/profile')
    },
    {
      title: 'Notifications',
      description: 'Review invites, alerts, and unread updates.',
      onClick: () => navigate('/app/notifications')
    },
    {
      title: 'Upgrade help',
      description: 'Read payment steps or contact support for role upgrade issues.',
      onClick: () => navigate('/help/upgrade-role')
    }
  ];
  const selectedUpgradeOption = ROLE_OPTIONS[upgradeForm.requestedRole] || null;
  const selectedUpgradePlan = ROLE_UPGRADE_CONFIG[upgradeForm.requestedRole] || null;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm">
        <div className="bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_32%),linear-gradient(135deg,#ffffff_0%,#f8fafc_52%,#ecfdf5_100%)] px-6 py-6 sm:px-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                <SparklesIcon className="h-4 w-4" />
                Account Center
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">Settings</h1>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                This page now groups the things people usually expect in settings: account overview,
                device preferences, security, and access requests.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:min-w-[340px]">
              {accountOverviewItems.map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/80 bg-white/80 px-4 py-4 backdrop-blur">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    {item.label}
                  </p>
                  <p className="mt-2 text-lg font-bold text-slate-900">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.8fr)_minmax(320px,1fr)]">
        <div className="space-y-6">
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">Preferences</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Small quality-of-life options that make the app feel more personal. These are
                  saved on this device.
                </p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                <SwatchIcon className="h-4 w-4" />
                Local only
              </span>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex items-start justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Language</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Change the app language for this device.
                  </p>
                </div>
                <LanguageSwitcher />
              </div>

              <PreferenceToggle
                title="Email updates"
                description="Keep important account updates and approval decisions enabled."
                enabled={preferences.emailUpdates}
                onChange={() => updatePreference('emailUpdates', !preferences.emailUpdates)}
              />
              <PreferenceToggle
                title="Booking reminders"
                description="Show reminders for upcoming bookings and pending field confirmations."
                enabled={preferences.bookingReminders}
                onChange={() => updatePreference('bookingReminders', !preferences.bookingReminders)}
              />
              <PreferenceToggle
                title="Match and invite alerts"
                description="Prioritize team invites, join requests, and open match activity."
                enabled={preferences.matchAlerts}
                onChange={() => updatePreference('matchAlerts', !preferences.matchAlerts)}
              />
              <PreferenceToggle
                title="Compact layout"
                description="Use tighter spacing for tables and content-heavy pages."
                enabled={preferences.compactMode}
                onChange={() => updatePreference('compactMode', !preferences.compactMode)}
              />

              <div className="rounded-2xl bg-slate-50 px-4 py-4">
                <label htmlFor="startPage" className="text-sm font-semibold text-slate-900">
                  Default start page
                </label>
                <p className="mt-1 text-sm text-slate-600">
                  Choose the first area you want to land on when you open the app.
                </p>
                <select
                  id="startPage"
                  value={preferences.startPage}
                  onChange={(event) => updatePreference('startPage', event.target.value)}
                  className="mt-4 block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                >
                  <option value="dashboard">Dashboard</option>
                  <option value="bookings">Bookings</option>
                  <option value="teams">Teams</option>
                  <option value="fields">Fields</option>
                  <option value="notifications">Notifications</option>
                </select>
              </div>
            </div>
          </section>

          <section ref={accessRequestsRef} className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5">
              <h2 className="inline-flex items-center gap-2 text-2xl font-semibold text-slate-900">
                <ShieldCheckIcon className="h-6 w-6 text-emerald-600" />
                Access Requests
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Upgrade your account when you need more control. Each access upgrade includes a one-time platform fee and then an admin approval review.
              </p>
            </div>

            <div className="p-6">
              {loading ? (
                <div className="py-8 text-center text-sm text-slate-500">Loading settings...</div>
              ) : availableRoles.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
                  <p className="text-base font-semibold text-slate-900">No access upgrades available</p>
                  <p className="mt-2 text-sm text-slate-600">
                    Your current account does not have any extra role requests available right now.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {availableRoles.map((roleKey) => {
                    const option = ROLE_OPTIONS[roleKey];
                    const latestRequest = latestRequestByRole[roleKey];
                    const Icon = option.icon;
                    const accentClasses =
                      option.accent === 'sky'
                        ? 'border-sky-100 bg-sky-50 text-sky-700'
                        : 'border-emerald-100 bg-emerald-50 text-emerald-700';
                    const isPendingThisRole = latestRequest?.status === 'pending';
                    const isDisabled = Boolean(hasPendingRequest || submittingRole || cancellingRequestId);
                    const buttonLabel = isPendingThisRole
                      ? 'Pending review'
                      : latestRequest?.status === 'rejected'
                        ? 'Request again'
                        : `Request ${option.title}`;

                    return (
                      <div
                        key={roleKey}
                        className={`rounded-[24px] border bg-white p-5 transition ${
                          focusedRoleKey === roleKey
                            ? 'border-emerald-400 ring-4 ring-emerald-100'
                            : 'border-slate-200'
                        }`}
                      >
                        <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl border ${accentClasses}`}>
                          <Icon className="h-6 w-6" />
                        </div>
                        <h3 className="mt-4 text-lg font-semibold text-slate-900">{option.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{option.description}</p>
                        <div className="mt-4 flex items-end justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Upgrade fee</p>
                            <p className="mt-1 text-2xl font-bold text-slate-950">${ROLE_UPGRADE_CONFIG[roleKey]?.feeUsd || 0}</p>
                          </div>
                          <div className="text-right text-xs text-slate-500">
                            <p>One-time platform fee</p>
                            <p>Admin approval required</p>
                          </div>
                        </div>

                        <div className="mt-4 space-y-2 rounded-2xl bg-slate-50/70 p-4">
                          {ROLE_UPGRADE_CONFIG[roleKey]?.benefits?.slice(0, 3).map((benefit) => (
                            <div key={benefit} className="flex items-start gap-2 text-sm text-slate-600">
                              <CheckCircleIcon className="mt-0.5 h-4 w-4 flex-none text-emerald-600" />
                              <span>{benefit}</span>
                            </div>
                          ))}
                        </div>

                        {latestRequest && (
                          <div className={`mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLES[latestRequest.status] || STATUS_STYLES.pending}`}>
                            {React.createElement(getStatusIcon(latestRequest.status), { className: 'h-4 w-4' })}
                            {formatRoleLabel(latestRequest.status)}
                          </div>
                        )}

                        {latestRequest?.paymentPaidAt && (
                          <p className="mt-3 text-xs text-slate-500">
                            Payment proof sent on {formatDateTime(latestRequest.paymentPaidAt)}
                          </p>
                        )}

                        {latestRequest?.paymentScreenshotUrl && (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewImage({
                                url: resolvePaymentProofUrl(latestRequest),
                                title: `${option.title} payment proof`
                              })
                            }
                            className="mt-3 text-xs font-semibold text-emerald-700 underline underline-offset-4"
                          >
                            View uploaded payment screenshot
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => openUpgradeModal(roleKey)}
                          disabled={isDisabled}
                          className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          {submittingRole === roleKey ? 'Submitting...' : buttonLabel}
                        </button>

                        {isPendingThisRole && latestRequest && (
                          <button
                            type="button"
                            onClick={() => handleCancelRoleRequest(latestRequest)}
                            disabled={cancellingRequestId === latestRequest.id}
                            className="mt-3 inline-flex w-full items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {cancellingRequestId === latestRequest.id ? 'Deleting...' : 'Delete Request'}
                          </button>
                        )}

                        {hasPendingRequest && !isPendingThisRole && (
                          <p className="mt-3 text-xs text-amber-700">
                            Another request is already pending review.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5">
              <h2 className="text-2xl font-semibold text-slate-900">Request History</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                A quick timeline of your previous access requests and their review status.
              </p>
            </div>

            <div className="p-6">
              {loading ? (
                <div className="text-sm text-slate-500">Loading history...</div>
              ) : sortedRoleRequests.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
                  You have not submitted any role requests yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {sortedRoleRequests.map((request) => {
                    const StatusIcon = getStatusIcon(request.status);
                    const isPendingRequest = request.status === 'pending';
                    return (
                      <div key={request.id} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {formatRoleLabel(request.requestedRole)}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Submitted {formatDateTime(request.createdAt)}
                          </p>
                          <p className="mt-2 text-xs font-medium text-emerald-700">
                            Paid ${Number(request.feeAmountUsd || 0).toFixed(0)} {request.paymentPaidAt ? `on ${formatDateTime(request.paymentPaidAt)}` : ''}
                          </p>
                        {request.paymentAccountName && (
                          <p className="mt-2 text-xs text-slate-500">
                            Paid by {request.paymentAccountName}{request.paymentPhone ? ` (${request.paymentPhone})` : ''}
                          </p>
                        )}
                        {request.paymentReference && (
                          <p className="mt-2 text-xs text-slate-500">
                            Reference details: {request.paymentReference}
                          </p>
                        )}
                        </div>
                          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLES[request.status] || STATUS_STYLES.pending}`}>
                            <StatusIcon className="h-4 w-4" />
                            {formatRoleLabel(request.status)}
                          </span>
                        </div>

                        {request.note && (
                          <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">{request.note}</p>
                        )}

                        {request.paymentScreenshotUrl && (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewImage({
                                url: resolvePaymentProofUrl(request),
                                title: `${formatRoleLabel(request.requestedRole)} payment proof`
                              })
                            }
                            className="mt-3 text-sm font-semibold text-emerald-700 underline underline-offset-4"
                          >
                            View payment screenshot
                          </button>
                        )}

                        {isPendingRequest && (
                          <button
                            type="button"
                            onClick={() => handleCancelRoleRequest(request)}
                            disabled={cancellingRequestId === request.id}
                            className="mt-4 inline-flex items-center justify-center rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {cancellingRequestId === request.id ? 'Deleting...' : 'Delete Request'}
                          </button>
                        )}

                        {request.reviewedAt && (
                          <p className="mt-3 text-xs text-slate-500">
                            Reviewed {formatDateTime(request.reviewedAt)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
        <div className="space-y-6">
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <LockClosedIcon className="h-6 w-6" />
              </span>
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">Security</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Keep your account protected and review the actions that affect sign-in.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl bg-slate-50 px-4 py-4">
              <p className="text-sm font-semibold text-slate-900">Password</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Change your password any time if you shared a device, reused an old password,
                or just want a stronger one.
              </p>
              <button
                type="button"
                onClick={() => {
                  setPasswordError('');
                  setIsPasswordModalOpen(true);
                }}
                className="mt-4 inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Change Password
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-slate-200 px-4 py-4">
                <p className="text-sm font-semibold text-slate-900">Current account role</p>
                <p className="mt-1 text-sm text-slate-600">{formatRoleLabel(user?.role)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 px-4 py-4">
                <p className="text-sm font-semibold text-slate-900">Last settings review</p>
                <p className="mt-1 text-sm text-slate-600">{new Date().toLocaleDateString()}</p>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
                <BellAlertIcon className="h-6 w-6" />
              </span>
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">Quick Links</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Shortcut actions people usually look for while managing their account.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {quickLinks.map((item) => (
                <button
                  key={item.title}
                  type="button"
                  onClick={item.onClick}
                  className="flex w-full items-center justify-between rounded-2xl border border-slate-200 px-4 py-4 text-left transition hover:border-emerald-200 hover:bg-emerald-50/50"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{item.description}</p>
                  </div>
                  <ChevronRightIcon className="h-5 w-5 text-slate-400" />
                </button>
              ))}
            </div>
          </section>

      <section className="rounded-[28px] border border-emerald-200 bg-emerald-50/60 p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-emerald-700 shadow-sm">
                <UserCircleIcon className="h-6 w-6" />
              </span>
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">What belongs here?</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Usually: security, notifications, app preferences, support, and role or permission requests.
                  That structure is what this page now follows.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>

      {isUpgradeModalOpen && selectedUpgradeOption && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6">
          <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-6xl flex-col overflow-hidden rounded-[32px] bg-white shadow-2xl">
            <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f8fafc_55%,#ecfdf5_100%)] px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center rounded-full border border-emerald-200 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                    Upgrade Flow
                  </div>
                  <h2 className="mt-3 text-2xl font-semibold text-slate-900">Pay and Request {selectedUpgradeOption.title}</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                    Follow the steps below: read a short guide, pay with the QR code, fill your payment details, get help if needed, then submit for admin review.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeUpgradeModal}
                  className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Close upgrade payment form"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {UPGRADE_MODAL_STEPS.map((step) => (
                  <div
                    key={step.number}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm"
                  >
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                      {step.number}
                    </span>
                    <span>{step.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <form
              onSubmit={handleRoleRequest}
              className="grid max-h-[calc(100vh-12.5rem)] gap-6 overflow-y-auto px-6 py-6 lg:grid-cols-[340px_minmax(0,1fr)]"
            >
              <div className="space-y-5">
                <section className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-5 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-sm font-bold text-white">
                      1
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Step 1</p>
                      <h3 className="mt-1 text-lg font-semibold text-slate-900">Read this quick guide</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Read these short instructions before you pay so the admin can check your request faster.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {UPGRADE_GUIDE_TIPS.map((tip) => (
                      <div
                        key={tip}
                        className="flex items-start gap-3 rounded-2xl border border-white bg-white px-4 py-3"
                      >
                        <CheckCircleIcon className="mt-0.5 h-5 w-5 flex-none text-emerald-600" />
                        <p className="text-sm leading-6 text-slate-700">{tip}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-[28px] border border-emerald-200 bg-emerald-50/60 p-5 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-sm font-bold text-white">
                      2
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Step 2</p>
                      <h3 className="mt-1 text-lg font-semibold text-slate-900">Pay with QR code</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Scan the QR code and pay the exact fee for {selectedUpgradeOption.title.toLowerCase()}.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 overflow-hidden rounded-[24px] border border-emerald-200 bg-white p-4 shadow-sm">
                    <img
                      src={PAYMENT_QR_SRC}
                      alt="Project payment QR code"
                      className="mx-auto aspect-square w-full max-w-[240px] rounded-2xl object-contain"
                    />
                  </div>
                  <div className="mt-4 rounded-[24px] border border-white/70 bg-white/90 px-4 py-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Upgrade fee</p>
                    <p className="mt-2 text-3xl font-bold text-slate-950">${Number(selectedUpgradePlan?.feeUsd || 0).toFixed(0)}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      After payment, go to Step 3 and fill the payment details with your screenshot.
                    </p>
                  </div>
                </section>
              </div>

              <div className="space-y-5">
                {upgradeError && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                    {upgradeError}
                  </div>
                )}

                <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-600 text-sm font-bold text-white">
                      3
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Step 3</p>
                      <h3 className="mt-1 text-lg font-semibold text-slate-900">Fill payment details</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Add the payer info, reference details, screenshot, and any note that helps admin verify the payment.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="paymentAccountName" className="block text-sm font-medium text-slate-700">
                      Payer account name
                    </label>
                    <input
                      id="paymentAccountName"
                      name="paymentAccountName"
                      type="text"
                      value={upgradeForm.paymentAccountName}
                      onChange={handleUpgradeFormChange}
                      className={passwordInputClass}
                      placeholder="Enter the name used for payment"
                    />
                  </div>
                  <div>
                    <label htmlFor="paymentPhone" className="block text-sm font-medium text-slate-700">
                      Payment phone number
                    </label>
                    <input
                      id="paymentPhone"
                      name="paymentPhone"
                      type="text"
                      value={upgradeForm.paymentPhone}
                      onChange={handleUpgradeFormChange}
                      className={passwordInputClass}
                      placeholder="012 345 678"
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Reference details</p>
                    <p className="mt-1 text-sm text-slate-600">
                      Fill the payment details you know so admin can match your screenshot faster.
                    </p>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="paymentMethod" className="block text-sm font-medium text-slate-700">
                        Payment app or bank
                      </label>
                      <input
                        id="paymentMethod"
                        name="paymentMethod"
                        type="text"
                        value={upgradeForm.paymentMethod}
                        onChange={handleUpgradeFormChange}
                        className={passwordInputClass}
                        placeholder="ABA, Wing, ACLEDA..."
                        maxLength={40}
                      />
                    </div>
                    <div>
                      <label htmlFor="transactionId" className="block text-sm font-medium text-slate-700">
                        Transaction ID
                      </label>
                      <input
                        id="transactionId"
                        name="transactionId"
                        type="text"
                        value={upgradeForm.transactionId}
                        onChange={handleUpgradeFormChange}
                        className={passwordInputClass}
                        placeholder="Example: ABA12345"
                        maxLength={40}
                      />
                    </div>
                    <div>
                      <label htmlFor="paymentDate" className="block text-sm font-medium text-slate-700">
                        Payment date
                      </label>
                      <input
                        id="paymentDate"
                        name="paymentDate"
                        type="date"
                        value={upgradeForm.paymentDate}
                        onChange={handleUpgradeFormChange}
                        className={passwordInputClass}
                      />
                    </div>
                    <div>
                      <label htmlFor="paymentTime" className="block text-sm font-medium text-slate-700">
                        Payment time
                      </label>
                      <input
                        id="paymentTime"
                        name="paymentTime"
                        type="time"
                        value={upgradeForm.paymentTime}
                        onChange={handleUpgradeFormChange}
                        className={passwordInputClass}
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <label htmlFor="paymentNote" className="block text-sm font-medium text-slate-700">
                      Reference note
                    </label>
                    <textarea
                      id="paymentNote"
                      name="paymentNote"
                      rows={3}
                      value={upgradeForm.paymentNote}
                      onChange={handleUpgradeFormChange}
                      className={passwordInputClass}
                      placeholder="Example: Paid from my wife's account or used another phone number."
                      maxLength={240}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="paymentProof" className="block text-sm font-medium text-slate-700">
                    Payment screenshot
                  </label>
                  <div className="mt-1 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4">
                    <input
                      id="paymentProof"
                      name="paymentProof"
                      type="file"
                      accept="image/*"
                      onChange={handlePaymentProofChange}
                      className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:font-semibold file:text-white hover:file:bg-slate-800"
                    />
                    {upgradeForm.paymentProofName && (
                      <p className="mt-3 text-sm text-slate-600">Selected: {upgradeForm.paymentProofName}</p>
                    )}
                    {upgradeForm.paymentProofPreviewUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewImage({
                            url: upgradeForm.paymentProofPreviewUrl,
                            title: 'Payment proof preview'
                          })
                        }
                        className="mt-3 text-sm font-semibold text-emerald-700 underline underline-offset-4"
                      >
                        Preview uploaded screenshot
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor="upgradeNote" className="block text-sm font-medium text-slate-700">
                    Extra note for admin
                  </label>
                  <textarea
                    id="upgradeNote"
                    name="note"
                    rows={4}
                    value={upgradeForm.note}
                    onChange={handleUpgradeFormChange}
                    className={passwordInputClass}
                    placeholder="Anything else the admin should know about this request"
                    maxLength={240}
                  />
                </div>

                <div className="rounded-[28px] border border-sky-200 bg-sky-50/70 p-5 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500 text-sm font-bold text-white">
                      4
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Step 4</p>
                      <h3 className="mt-1 text-lg font-semibold text-slate-900">Get help if payment has an error</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Open the guide or contact the helper if your payment is rejected or your reference details are wrong.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <a
                      href="/help/upgrade-role"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      Open help guide
                    </a>
                    <a
                      href="tel:0713266899"
                      className="inline-flex items-center rounded-2xl border border-sky-300 bg-white px-4 py-2.5 text-sm font-semibold text-sky-700 transition hover:bg-sky-100"
                    >
                      Call 0713266899
                    </a>
                    <a
                      href="mailto:phanphoun855@gmail.com"
                      className="inline-flex items-center rounded-2xl border border-sky-300 bg-white px-4 py-2.5 text-sm font-semibold text-sky-700 transition hover:bg-sky-100"
                    >
                      Email helper
                    </a>
                    <a
                      href="https://t.me/phanphoun"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center rounded-2xl border border-sky-300 bg-white px-4 py-2.5 text-sm font-semibold text-sky-700 transition hover:bg-sky-100"
                    >
                      Telegram
                    </a>
                  </div>
                </div>

                <div className="rounded-[28px] border border-emerald-200 bg-emerald-50/70 p-5 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-sm font-bold text-white">
                      5
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Step 5</p>
                      <h3 className="mt-1 text-lg font-semibold text-slate-900">Submit and wait</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Submit your request and wait while admin checks the payment proof.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-[24px] border border-white/70 bg-white/90 px-4 py-4 shadow-sm">
                    <p className="text-sm font-semibold text-slate-900">After submit</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{UPGRADE_SUBMIT_WAIT_MESSAGE}</p>
                  </div>

                  <div className="mt-5 flex items-center justify-end gap-3 border-t border-emerald-200 pt-4">
                    <button
                      type="button"
                      onClick={closeUpgradeModal}
                      disabled={Boolean(submittingRole)}
                      className="rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={Boolean(submittingRole)}
                      className="rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
                    >
                      {submittingRole === upgradeForm.requestedRole ? 'Submitting...' : 'Submit'}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6">
          <div className="w-full max-w-lg rounded-[28px] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Change Password</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Enter your current password and choose a new one.
                </p>
              </div>
              <button
                type="button"
                onClick={closePasswordModal}
                className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close change password form"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-5 px-6 py-6">
              {passwordError && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                  {passwordError}
                </div>
              )}

              <div>
                <label htmlFor="currentPassword" className="block text-sm font-medium text-slate-700">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    id="currentPassword"
                    name="currentPassword"
                    type={showPassword.current ? 'text' : 'password'}
                    value={passwordForm.currentPassword}
                    onChange={handlePasswordFormChange}
                    className={`${passwordInputClass} pr-11`}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('current')}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
                    aria-label={showPassword.current ? 'Hide current password' : 'Show current password'}
                  >
                    {showPassword.current ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-slate-700">
                  New Password
                </label>
                <div className="relative">
                  <input
                    id="newPassword"
                    name="newPassword"
                    type={showPassword.next ? 'text' : 'password'}
                    value={passwordForm.newPassword}
                    onChange={handlePasswordFormChange}
                    className={`${passwordInputClass} pr-11`}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('next')}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
                    aria-label={showPassword.next ? 'Hide new password' : 'Show new password'}
                  >
                    {showPassword.next ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showPassword.confirm ? 'text' : 'password'}
                    value={passwordForm.confirmPassword}
                    onChange={handlePasswordFormChange}
                    className={`${passwordInputClass} pr-11`}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('confirm')}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
                    aria-label={showPassword.confirm ? 'Hide password confirmation' : 'Show password confirmation'}
                  >
                    {showPassword.confirm ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={closePasswordModal}
                  disabled={changingPassword}
                  className="rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={changingPassword}
                  className="rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
                >
                  {changingPassword ? 'Changing...' : 'Save Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ImagePreviewModal
        open={Boolean(previewImage)}
        imageUrl={previewImage?.url}
        title={previewImage?.title || 'Payment screenshot'}
        onClose={() => setPreviewImage(null)}
      />
    </div>
  );
};

export default SettingsPage;
