import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckIcon,
  ChevronDownIcon,
  PencilSquareIcon,
  PhotoIcon,
  StarIcon,
  TrashIcon,
  PlusIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import FieldLocationPicker from '../components/maps/FieldLocationPicker';
import fieldService from '../services/fieldService';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useDialog, useToast } from '../components/ui';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';
const API_ORIGIN =
  typeof window !== 'undefined' && API_BASE_URL.startsWith('/')
    ? window.location.origin
    : API_BASE_URL.replace(/\/api\/?$/, '');
const CLOSURE_DAY_PRESETS = [1, 3, 7, 14];
const FIELD_STATUS_OPTIONS = [
  {
    value: 'available',
    label: 'Open',
    description: 'Bookings are available and the field appears as ready to reserve.',
    tone: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  },
  {
    value: 'unavailable',
    label: 'Closed',
    description: 'Hide booking availability until you reopen the field.',
    tone: 'bg-rose-50 text-rose-700 border-rose-200'
  },
  {
    value: 'maintenance',
    label: 'Maintenance',
    description: 'Show that the field is temporarily offline for repair or preparation.',
    tone: 'bg-amber-50 text-amber-700 border-amber-200'
  }
];
const DEFAULT_FIELD_IMAGE =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="100%25" height="100%25" fill="%23e5e7eb"/></svg>';

const openNativeDatePicker = (event) => {
  event.currentTarget.focus();
  if (typeof event.currentTarget.showPicker === 'function') {
    try {
      event.currentTarget.showPicker();
    } catch (_) {}
  }
};

const emptyForm = {
  name: '',
  description: '',
  address: '',
  city: '',
  province: '',
  latitude: '',
  longitude: '',
  pricePerHour: '',
  discountPercent: '',
  capacity: '',
  status: 'available',
  fieldType: '11v11',
  surfaceType: 'artificial_turf',
  amenities: '',
  closureMessage: '',
  closureStartAt: '',
  closureEndAt: ''
};

// Get discount percent for the current view.
const getDiscountPercent = (field) => Math.min(100, Math.max(0, Number(field?.discountPercent || 0)));
// Get discounted hourly price for the current view.
const getDiscountedHourlyPrice = (field) => {
  const price = Number(field?.pricePerHour || 0);
  const discountPercent = getDiscountPercent(field);
  return Number((price * (1 - discountPercent / 100)).toFixed(2));
};
const getFieldRatingValue = (field) => Math.max(0, Math.min(5, Number(field?.rating || 0)));

const getFieldStatusLabel = (status, t) => {
  if (status === 'available') return t('field_available', 'Available');
  if (status === 'maintenance') return t('field_status_maintenance', 'Maintenance');
  return t('field_status_unavailable', 'Unavailable');
};

const normalizeImages = (imagesValue) => {
  if (Array.isArray(imagesValue)) return imagesValue;
  if (typeof imagesValue === 'string') {
    try {
      const parsed = JSON.parse(imagesValue);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const resolveFieldImageUrl = (rawImage, versionToken = '') => {
  if (!rawImage) return DEFAULT_FIELD_IMAGE;
  if (/^https?:\/\//i.test(rawImage) || /^data:image\//i.test(rawImage)) return rawImage;
  if (String(rawImage).startsWith('/uploads/')) {
    const baseUrl = `${API_ORIGIN}${rawImage}`;
    if (!versionToken) return baseUrl;
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}v=${encodeURIComponent(String(versionToken))}`;
  }
  return rawImage;
};

const toDateInputValue = (value) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toIsoOrNull = (value) => {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const addDaysToDateInput = (baseValue, days) => {
  const baseDate = baseValue ? new Date(baseValue) : new Date();
  if (Number.isNaN(baseDate.getTime())) return '';
  const nextDate = new Date(baseDate);
  nextDate.setDate(nextDate.getDate() + Number(days || 0));
  return toDateInputValue(nextDate);
};

const isOwnedByCurrentUser = (field, user) => {
  if (!field) return false;
  const ownerId =
    field.ownerId ||
    field.owner_id ||
    field.userId ||
    field.user_id ||
    field.fieldOwnerId ||
    field.owner?.id ||
    field.owner?._id ||
    null;
  const userId = user?.id || user?._id || null;
  if (!ownerId || !userId) return true;
  return String(ownerId) === String(userId);
};

const normalizeEditableStatus = (value) => {
  const normalized = String(value || 'available').toLowerCase();
  if (normalized === 'booked') return 'available';
  if (normalized === 'maintenance' || normalized === 'unavailable' || normalized === 'available') {
    return normalized;
  }
  return 'available';
};

const getApiErrorMessage = (err, fallbackMessage) => {
  const validationErrors = Array.isArray(err?.data?.errors) ? err.data.errors : [];
  if (validationErrors.length > 0) {
    const first = validationErrors[0];
    const field = first?.field ? `${first.field}: ` : '';
    return `${field}${first?.message || 'Invalid value'}`;
  }
  return err?.error || fallbackMessage;
};

const getFieldSortTimestamp = (field) => {
  const candidates = [field?.createdAt, field?.created_at, field?.updatedAt, field?.updated_at];
  for (const value of candidates) {
    const timestamp = new Date(value).getTime();
    if (!Number.isNaN(timestamp)) return timestamp;
  }
  const numericId = Number(field?.id ?? field?._id);
  if (!Number.isNaN(numericId)) return numericId;
  return 0;
};

const OwnerFieldsPage = () => {
  const { user } = useAuth();
  const { confirm } = useDialog();
  const { showToast } = useToast();
  const { t } = useLanguage();
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const [editingFieldId, setEditingFieldId] = useState(null);
  const [statusEditingField, setStatusEditingField] = useState(null);
  const [imageFiles, setImageFiles] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [imageVersionToken, setImageVersionToken] = useState(0);
  const [form, setForm] = useState(emptyForm);

  const visibleFields = useMemo(
    () => [...fields].sort((a, b) => getFieldSortTimestamp(b) - getFieldSortTimestamp(a)),
    [fields]
  );

  const loadFields = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fieldService.getMyFields();
      setFields(Array.isArray(response?.data) ? response.data : []);
    } catch (err) {
      setError(err?.error || 'Failed to load fields');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Support run for this page.
    const run = async () => {
      try {
        setLoading(true);
        await loadFields();
      } catch (err) {
        showToast(err?.error || 'Failed to load fields', { type: 'error' });
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [loadFields, showToast]);

  // Reset form to its default state.
  const resetForm = () => {
    setForm(emptyForm);
    setImageFiles([]);
    setExistingImages([]);
    setImageVersionToken(0);
    setEditingFieldId(null);
    setIsOpen(false);
  };

  const resetStatusForm = () => {
    setStatusEditingField(null);
    setIsStatusMenuOpen(false);
    setForm((current) => ({
      ...current,
      status: 'available',
      closureMessage: '',
      closureStartAt: '',
      closureEndAt: ''
    }));
    setIsStatusOpen(false);
  };

  const startCreate = () => {
    setForm(emptyForm);
    setImageFiles([]);
    setExistingImages([]);
    setImageVersionToken(0);
    setEditingFieldId(null);
    setIsOpen(true);
  };

  // Start edit flow.
  const startEdit = (field) => {
    setEditingFieldId(field.id);
    setImageFiles([]);
    setExistingImages(normalizeImages(field.images));
    setImageVersionToken(new Date(field.updatedAt || Date.now()).getTime());
    setForm({
      name: field.name || '',
      description: field.description || '',
      address: field.address || '',
      city: field.city || '',
      province: field.province || '',
      latitude: field.latitude ?? '',
      longitude: field.longitude ?? '',
      pricePerHour: field.pricePerHour ?? '',
      discountPercent: field.discountPercent ?? '',
      capacity: field.capacity ?? '',
      status: normalizeEditableStatus(field.status),
      fieldType: field.fieldType || '11v11',
      surfaceType: field.surfaceType || 'artificial_turf',
      amenities: Array.isArray(field.amenities) ? field.amenities.join(', ') : '',
      closureMessage: field.closureMessage || '',
      closureStartAt: toDateInputValue(field.closureStartAt),
      closureEndAt: toDateInputValue(field.closureEndAt)
    });
    setIsOpen(true);
  };

  const selectedImagePreviews = useMemo(
    () =>
      imageFiles.map((file) => ({
        name: file.name,
        url: URL.createObjectURL(file)
      })),
    [imageFiles]
  );

  useEffect(() => {
    return () => {
      selectedImagePreviews.forEach((image) => URL.revokeObjectURL(image.url));
    };
  }, [selectedImagePreviews]);

  useEffect(() => {
    if (!isOpen && !isStatusOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, isStatusOpen]);

  const visibleImagePreviews = selectedImagePreviews.length > 0
    ? selectedImagePreviews
    : existingImages.map((path, index) => ({
        name: `Current image ${index + 1}`,
        url: resolveFieldImageUrl(path, imageVersionToken || editingFieldId || Date.now()),
        isCurrent: true,
        index
      }));

  const amenitiesPreview = useMemo(
    () => (form.amenities || '').split(',').map((item) => item.trim()).filter(Boolean).slice(0, 5),
    [form.amenities]
  );

  const liveDiscountPercent = Math.min(100, Math.max(0, Number(form.discountPercent || 0)));
  const liveBasePrice = Number(form.pricePerHour || 0);
  const liveDiscountedPrice = liveBasePrice > 0
    ? Number((liveBasePrice * (1 - liveDiscountPercent / 100)).toFixed(2))
    : 0;
  const modalFieldName = form.name.trim() || 'Untitled field';
  const renderPortal = (content) => (typeof document !== 'undefined' ? createPortal(content, document.body) : null);
  const isFormReady =
    form.name.trim().length > 0 &&
    Number(form.pricePerHour) > 0 &&
    Number(form.capacity) > 0 &&
    form.address.trim().length > 0;

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  // Handle location change interactions.
  const handleLocationChange = (locationData) => {
    setForm((current) => ({
      ...current,
      address: locationData.address || current.address,
      city: locationData.city || current.city,
      province: locationData.province || current.province,
      latitude: locationData.latitude ?? '',
      longitude: locationData.longitude ?? ''
    }));
  };

  // Handle image change interactions.
  const handleImageChange = (event) => {
    const selectedFiles = Array.from(event.target.files || []);
    const nextFiles = selectedFiles.filter((file) => String(file.type || '').startsWith('image/'));
    const limitedFiles = nextFiles.slice(0, 5);

    if (selectedFiles.length !== nextFiles.length) {
      showToast('Only image files can be uploaded for field photos.', { type: 'error' });
    }
    if (nextFiles.length > 5) {
      showToast('You can upload up to 5 field photos at a time.', { type: 'error' });
    }

    setImageFiles(limitedFiles);
    // Allow selecting the same file again (browser otherwise may not trigger onChange).
    event.target.value = '';
  };

  const applyClosureDaysPreset = (days) => {
    setForm((current) => {
      const baseStart = current.closureStartAt || toDateInputValue(new Date());
      const nextEnd = addDaysToDateInput(baseStart, days);
      return {
        ...current,
        closureStartAt: baseStart,
        closureEndAt: nextEnd
      };
    });
  };

  // Handle submit interactions.
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.name?.trim()) {
      showToast('name: Field name is required', { type: 'error' });
      return;
    }
    if (!form.address?.trim()) {
      showToast('address: Address is required. Please pick a location.', { type: 'error' });
      return;
    }
    if (!Number.isFinite(Number(form.pricePerHour)) || Number(form.pricePerHour) < 0) {
      showToast('pricePerHour: Price per hour must be a positive number', { type: 'error' });
      return;
    }
    if (!Number.isInteger(Number(form.capacity)) || Number(form.capacity) < 1) {
      showToast('capacity: Capacity must be a positive integer', { type: 'error' });
      return;
    }

    try {
      setSaving(true);

      const payload = {
        name: form.name,
        description: form.description || undefined,
        address: form.address,
        city: form.city,
        province: form.province,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
        pricePerHour: Number(form.pricePerHour),
        discountPercent: form.discountPercent === '' ? 0 : Number(form.discountPercent),
        capacity: Number(form.capacity),
        status: normalizeEditableStatus(form.status),
        fieldType: form.fieldType,
        surfaceType: form.surfaceType,
        amenities: form.amenities ? form.amenities.split(',').map((item) => item.trim()).filter(Boolean) : [],
        closureMessage:
          form.status === 'available'
            ? null
            : form.closureMessage?.trim()
            ? form.closureMessage.trim()
            : null,
        closureStartAt: form.status === 'available' ? null : toIsoOrNull(form.closureStartAt),
        closureEndAt: form.status === 'available' ? null : toIsoOrNull(form.closureEndAt)
      };

      if (editingFieldId) {
        await fieldService.updateField(editingFieldId, payload);
        let uploadedCount = 0;
        if (imageFiles.length > 0) {
          await fieldService.uploadFieldImages(editingFieldId, imageFiles, {
            replaceExisting: true
          });
          uploadedCount = imageFiles.length;
        }
        showToast(uploadedCount > 0 ? `Field updated with ${uploadedCount} photo(s).` : 'Field updated. No new photo selected.', { type: 'success' });
      } else {
        const created = await fieldService.createField(payload);
        const createdId = created?.data?.id;
        let uploadedCount = 0;
        if (createdId && imageFiles.length > 0) {
          await fieldService.uploadFieldImages(createdId, imageFiles);
          uploadedCount = imageFiles.length;
        }
        showToast(uploadedCount > 0 ? `Field created with ${uploadedCount} photo(s).` : 'Field created. Add photos any time by editing.', { type: 'success' });
      }

      await loadFields();
      resetForm();
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Failed to save field'), { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCurrentImage = async (imageIndex) => {
    if (!editingFieldId && editingFieldId !== 0) return;
    try {
      setSaving(true);
      const response = await fieldService.deleteFieldImage(editingFieldId, imageIndex);
      const nextImages = Array.isArray(response?.data?.images) ? response.data.images : [];
      setExistingImages(nextImages);
      setImageVersionToken(Date.now());
      await loadFields();
      showToast('Photo deleted.', { type: 'success' });
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Failed to delete photo'), { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (field) => {
    const confirmed = await confirm(`Delete "${field.name}"?`, { title: 'Delete Field' });
    if (!confirmed) return;

    try {
      setSaving(true);
      await fieldService.deleteField(field.id);
      showToast('Field deleted.', { type: 'success' });
      await loadFields();
    } catch (err) {
      showToast(err?.error || 'Failed to delete field', { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const startStatusEdit = (field) => {
    setStatusEditingField(field);
    setIsStatusMenuOpen(false);
    setForm((current) => ({
      ...current,
      status: normalizeEditableStatus(field?.status),
      closureMessage: field?.closureMessage || '',
      closureStartAt: toDateInputValue(field?.closureStartAt),
      closureEndAt: toDateInputValue(field?.closureEndAt)
    }));
    setIsStatusOpen(true);
  };

  const selectedStatusOption =
    FIELD_STATUS_OPTIONS.find((option) => option.value === form.status) || FIELD_STATUS_OPTIONS[0];

  const handleStatusSubmit = async (event) => {
    event.preventDefault();
    if (!statusEditingField?.id) return;

    try {
      setSaving(true);
      const nextStatus = normalizeEditableStatus(form.status);

      await fieldService.updateField(statusEditingField.id, {
        name: statusEditingField.name,
        address: statusEditingField.address,
        pricePerHour: Number(statusEditingField.pricePerHour),
        capacity: Number(statusEditingField.capacity),
        discountPercent: Number(statusEditingField.discountPercent || 0),
        status: nextStatus,
        closureMessage:
          nextStatus === 'available'
            ? null
            : form.closureMessage?.trim()
            ? form.closureMessage.trim()
            : 'Temporarily closed by field owner.',
        closureStartAt: nextStatus === 'available' ? null : toIsoOrNull(form.closureStartAt) || new Date().toISOString(),
        closureEndAt: nextStatus === 'available' ? null : toIsoOrNull(form.closureEndAt)
      });

      showToast('Field status updated.', { type: 'success' });
      await loadFields();
      resetStatusForm();
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Failed to update field status'), { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">{t('owner_my_fields_title', 'áž‘áž¸áž›áž¶áž“ážšáž”ážŸáŸ‹ážáŸ’áž‰áž»áŸ†')}</h1>
          <p className="mt-1 text-sm text-gray-600">{t('owner_fields_subtitle', 'áž”áž„áŸ’áž€áž¾áž áž€áŸ‚áž”áŸ’ážšáŸ‚ áž“áž·áž„áž‚áŸ’ážšáž”áŸ‹áž‚áŸ’ážšáž„áž”áž‰áŸ’áž‡áž¸áž‘áž¸áž›áž¶áž“ážšáž”ážŸáŸ‹áž¢áŸ’áž“áž€áŸ”')}</p>
        </div>
        <button
          type="button"
          onClick={startCreate}
          className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 sm:w-auto"
        >
          <PlusIcon className="h-4 w-4" />
          {t('action_add_field', 'áž”áž“áŸ’ážáŸ‚áž˜áž‘áž¸áž›áž¶áž“')}
        </button>
      </div>
      {isOpen && renderPortal(
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-5"
          onClick={resetForm}
        >
          <form
            onSubmit={handleSubmit}
            className="flex h-[min(820px,calc(100vh-24px))] w-full max-w-[1120px] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_32px_90px_rgba(15,23,42,0.24)] sm:h-[min(820px,calc(100vh-40px))]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="shrink-0 flex items-start justify-between border-b border-slate-200 bg-white px-5 py-4 md:px-6">
              <div>
                <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  {editingFieldId ? t('owner_field_edit_badge', 'Edit Field') : t('owner_field_create_badge', 'Create Field')}
                </span>
                <h2 className="mt-2 text-[1.9rem] font-bold leading-tight text-slate-950">
                  {editingFieldId ? t('owner_field_edit_title', 'Update Field Information') : t('owner_field_create_title', 'Add a New Field')}
                </h2>
                <p className="mt-1.5 text-sm text-slate-500">
                  {t('owner_field_modal_subtitle', 'Update pricing, location, amenities, and photos in one place.')}
                </p>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
                aria-label={t('owner_field_close_form', 'Close field form')}
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="shrink-0 border-b border-slate-100 bg-gradient-to-r from-emerald-50 via-teal-50/50 to-white px-5 py-3 md:px-6">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-full bg-white px-3 py-1 font-semibold text-emerald-700 shadow-sm">{t('owner_field_live_preview', 'Live Preview')}</span>
                <span className="font-medium text-slate-700">{modalFieldName}</span>
                <span className="text-slate-400">|</span>
                <span className="font-semibold text-slate-900">{liveBasePrice > 0 ? `$${liveDiscountedPrice}/hr` : t('owner_field_set_price', 'Set price')}</span>
                {liveDiscountPercent > 0 && (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    {liveDiscountPercent}% OFF
                  </span>
                )}
                <span className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-slate-600">
                  {form.fieldType || t('owner_field_type_label', 'Field type')}
                </span>
                <span className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-slate-600">
                  {Number(form.capacity) > 0 ? t('players_suffix', '{{count}} players', { count: form.capacity }) : t('owner_field_set_capacity', 'Set capacity')}
                </span>
              </div>
            </div>

            <div className="min-h-0 overflow-y-auto bg-slate-50/50 px-5 py-4 md:px-6 md:py-5">
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
            <div className="mb-3">
              <h3 className="text-lg font-semibold text-slate-900">{t('owner_field_details_title', 'Field Details')}</h3>
              <p className="mt-1 text-sm text-slate-500">{t('owner_field_details_subtitle', 'Set the essential details players see before booking.')}</p>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="space-y-2">
                <span className="block text-sm font-medium text-slate-700">{t('owner_field_name_label', 'Field Name')}</span>
                <input name="name" value={form.name} onChange={handleChange} placeholder={t('owner_field_name_placeholder', 'Field name')} className="w-full rounded-xl border border-gray-300 px-4 py-3" required />
              </label>
              <label className="space-y-2">
                <span className="block text-sm font-medium text-slate-700">{t('owner_field_price_label', 'Price Per Hour')}</span>
                <input name="pricePerHour" type="number" value={form.pricePerHour} onChange={handleChange} placeholder={t('owner_field_price_placeholder', 'Price per hour')} className="w-full rounded-xl border border-gray-300 px-4 py-3" required />
              </label>
              <label className="space-y-2">
                <span className="block text-sm font-medium text-slate-700">{t('owner_field_capacity_label', 'Capacity')}</span>
                <input name="capacity" type="number" value={form.capacity} onChange={handleChange} placeholder={t('owner_field_capacity_placeholder', 'Capacity')} className="w-full rounded-xl border border-gray-300 px-4 py-3" required />
              </label>
              <label className="space-y-2">
                <span className="block text-sm font-medium text-slate-700">{t('owner_field_discount_label', 'Discount Percent')}</span>
                <input name="discountPercent" type="number" min="0" max="100" value={form.discountPercent} onChange={handleChange} placeholder="0" className="w-full rounded-xl border border-gray-300 px-4 py-3" />
              </label>
              <label className="space-y-2">
                <span className="block text-sm font-medium text-slate-700">{t('owner_field_type_title', 'Field Type')}</span>
                <select name="fieldType" value={form.fieldType} onChange={handleChange} className="w-full rounded-xl border border-gray-300 px-4 py-3">
                  <option value="5v5">5v5</option>
                  <option value="7v7">7v7</option>
                  <option value="11v11">11v11</option>
                  <option value="futsal">Futsal</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="block text-sm font-medium text-slate-700">{t('owner_field_surface_title', 'Surface Type')}</span>
                <select name="surfaceType" value={form.surfaceType} onChange={handleChange} className="w-full rounded-xl border border-gray-300 px-4 py-3">
                  <option value="artificial_turf">{t('surface_artificial_turf', 'Artificial Turf')}</option>
                  <option value="natural_grass">{t('surface_natural_grass', 'Natural Grass')}</option>
                  <option value="concrete">{t('surface_concrete', 'Concrete')}</option>
                  <option value="indoor">{t('surface_indoor', 'Indoor')}</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="block text-sm font-medium text-slate-700">{t('owner_field_amenities_label', 'Amenities')}</span>
                <input name="amenities" value={form.amenities} onChange={handleChange} placeholder={t('owner_field_amenities_placeholder', 'parking, showers, lights')} className="w-full rounded-xl border border-gray-300 px-4 py-3" />
              </label>
              {amenitiesPreview.length > 0 && (
                <div className="md:col-span-2 -mt-1 flex flex-wrap gap-2">
                  {amenitiesPreview.map((item) => (
                    <span key={item} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
                      {item}
                    </span>
                  ))}
                </div>
              )}
            </div>
            </div>

            <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
              <div className="mb-3">
                  <h3 className="text-lg font-semibold text-slate-900">{t('owner_field_location_title', 'Location')}</h3>
                  <p className="mt-1 text-sm text-slate-500">{t('owner_field_location_subtitle', 'Search, click, or drag the pin to set the field location.')}</p>
              </div>
              <FieldLocationPicker
                value={{
                  address: form.address,
                  city: form.city,
                  province: form.province,
                  latitude: form.latitude,
                  longitude: form.longitude
                }}
                onChange={handleLocationChange}
              />
            </div>

            <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <label htmlFor="field-images" className="block text-lg font-semibold text-slate-900">
                    {t('owner_field_photos_title', 'Photos')}
                  </label>
                  <p className="mt-1 text-sm text-slate-500">
                    {t('owner_field_photos_subtitle', 'Upload up to 5 images. Images are compressed before upload to keep pages fast.')}
                  </p>
                </div>
                <label
                  htmlFor="field-images"
                  className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                >
                  {existingImages.length > 0 ? t('owner_field_change_photos', 'Change Photos') : t('owner_field_upload_photos', 'Upload Photos')}
                </label>
              </div>

              <input
                id="field-images"
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageChange}
                className="sr-only"
              />

              {imageFiles.length > 0 && !editingFieldId && (
                <div className="mt-3 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                  {imageFiles.length} new image(s) selected
                </div>
              )}
              {editingFieldId && imageFiles.length > 0 && (
                <div className="mt-3 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                  {t('owner_field_new_photos_ready', 'New photos are ready and will replace current photos when you click Save')}
                </div>
              )}
              {imageFiles.length === 0 && existingImages.length > 0 && (
                <div className="mt-3 inline-flex rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-600">
                  {t('owner_field_showing_current_images', 'Showing current image(s)')}
                </div>
              )}

              {visibleImagePreviews.length > 0 ? (
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {visibleImagePreviews.map((image, index) => (
                    <div
                      key={`${image.url}-${index}`}
                      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                    >
                      <img src={image.url} alt={image.name} className="h-36 w-full object-cover" />
                      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                        <p className="truncate text-xs font-medium text-slate-600">{image.name}</p>
                        <div className="flex items-center gap-2">
                          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-500">
                            {imageFiles.length > 0 ? t('common_new', 'New') : t('common_current', 'Current')}
                          </span>
                          {image.isCurrent && (
                            <button
                              type="button"
                              onClick={() => handleDeleteCurrentImage(image.index)}
                              disabled={saving}
                              className="rounded-full border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700 disabled:opacity-50"
                            >
                              {t('action_delete', 'Delete')}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white/80 px-4 py-6 text-center text-sm text-slate-500">
                  {t('owner_field_no_photos_selected', 'No photos selected yet.')}
                </div>
              )}
            </div>

            <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
              <label className="space-y-2">
                <span className="block text-lg font-semibold text-slate-900">{t('owner_field_description_title', 'Field Description')}</span>
                <span className="block text-sm text-slate-500">{t('owner_field_description_subtitle', 'Share what makes this field special for players and captains.')}</span>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows={4}
                  placeholder={t('owner_field_description_placeholder', 'Field description')}
                  className="w-full rounded-2xl border border-gray-300 px-4 py-3"
                />
              </label>
            </div>
            </div>

            <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-3.5 md:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">
                {isFormReady ? t('owner_field_ready_to_save', 'Ready to save') : t('owner_field_fill_required', 'Fill required details: name, price, capacity, and location')}
              </p>
              <div className="flex gap-3">
                <button type="button" onClick={resetForm} className="rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
                  {t('action_cancel', 'Cancel')}
                </button>
                <button type="submit" disabled={saving || !isFormReady} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50">
                  {saving ? t('common_saving', 'Saving...') : t('action_save', 'Save')}
                </button>
              </div>
              </div>
            </div>
          </form>
        </div>
      )}
      {isStatusOpen && renderPortal(
        <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleStatusSubmit}
            className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.28)]"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">Update Field Status</h3>
              <button type="button" onClick={resetStatusForm} className="rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-700">
                Close
              </button>
            </div>
            <p className="mt-2 text-sm text-slate-600">{statusEditingField?.name || 'Field'}</p>

            <div className="mt-4 space-y-4">
              <label className="block space-y-2">
                <span className="block text-sm font-medium text-slate-700">Field Status</span>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsStatusMenuOpen((current) => !current)}
                    className="flex w-full items-center justify-between rounded-2xl border border-slate-300 bg-white px-4 py-3.5 text-left shadow-sm transition hover:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                    aria-haspopup="listbox"
                    aria-expanded={isStatusMenuOpen}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${selectedStatusOption.tone}`}>
                          {selectedStatusOption.label}
                        </span>
                        <span className="text-base font-semibold text-slate-900">{selectedStatusOption.label}</span>
                      </div>
                      <p className="mt-1 truncate text-sm text-slate-500">{selectedStatusOption.description}</p>
                    </div>
                    <ChevronDownIcon
                      className={`h-5 w-5 shrink-0 text-slate-400 transition ${isStatusMenuOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {isStatusMenuOpen && (
                    <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-20 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_48px_rgba(15,23,42,0.18)]">
                      <div className="p-2" role="listbox" aria-label="Field status options">
                        {FIELD_STATUS_OPTIONS.map((option) => {
                          const isSelected = option.value === form.status;

                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => {
                                setForm((current) => ({ ...current, status: option.value }));
                                setIsStatusMenuOpen(false);
                              }}
                              className={`flex w-full items-start justify-between gap-3 rounded-xl px-3 py-3 text-left transition ${
                                isSelected ? 'bg-emerald-50' : 'hover:bg-slate-50'
                              }`}
                              role="option"
                              aria-selected={isSelected}
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${option.tone}`}>
                                    {option.label}
                                  </span>
                                </div>
                                <p className="mt-2 text-sm font-semibold text-slate-900">{option.label}</p>
                                <p className="mt-1 text-xs leading-5 text-slate-500">{option.description}</p>
                              </div>
                              {isSelected && (
                                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                                  <CheckIcon className="h-4 w-4" />
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </label>

              {form.status !== 'available' && (
                <>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="space-y-2">
                      <span className="block text-sm font-medium text-slate-700">Close Date</span>
                      <input
                        name="closureStartAt"
                        type="date"
                        value={form.closureStartAt}
                        onChange={handleChange}
                        onClick={openNativeDatePicker}
                        className="w-full rounded-xl border border-gray-300 px-4 py-3"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="block text-sm font-medium text-slate-700">Open Back Date</span>
                      <input
                        name="closureEndAt"
                        type="date"
                        value={form.closureEndAt}
                        min={form.closureStartAt || undefined}
                        onChange={handleChange}
                        onClick={openNativeDatePicker}
                        className="w-full rounded-xl border border-gray-300 px-4 py-3"
                      />
                    </label>
                  </div>
                  <div>
                    <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Quick Reopen Presets</span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {CLOSURE_DAY_PRESETS.map((days) => (
                        <button
                          key={days}
                          type="button"
                          onClick={() => applyClosureDaysPreset(days)}
                          className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          +{days} {days === 1 ? 'day' : 'days'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="block space-y-2">
                    <span className="block text-sm font-medium text-slate-700">Closure Reason</span>
                    <textarea
                      name="closureMessage"
                      value={form.closureMessage}
                      onChange={handleChange}
                      rows={3}
                      maxLength={500}
                      placeholder="Example: Field maintenance until 6 PM."
                      className="w-full rounded-xl border border-gray-300 px-4 py-3"
                    />
                    <span className="block text-xs text-slate-500">This reason is shown to captains when booking is unavailable.</span>
                  </label>
                </>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={resetStatusForm} className="rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Status'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {visibleFields.length > 0 ? (
          visibleFields.map((field) => {
            const images = normalizeImages(field.images);
            const coverImage = resolveFieldImageUrl(images[0], field.updatedAt || field.id);
            const isOwned = isOwnedByCurrentUser(field, user);
            const discountPercent = getDiscountPercent(field);
            const discountedPrice = getDiscountedHourlyPrice(field);
            const ratingValue = getFieldRatingValue(field);
            const totalRatings = Math.max(0, Number(field?.totalRatings || 0));

          return (
            <div key={field.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="relative">
                <img
                  src={coverImage}
                  alt={field.name}
                  className="h-48 w-full object-cover"
                  onError={(event) => {
                    if (event.currentTarget.src !== DEFAULT_FIELD_IMAGE) {
                      event.currentTarget.src = DEFAULT_FIELD_IMAGE;
                    }
                  }}
                />
                <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4">
                  <span className="inline-flex rounded-full bg-white/95 px-4 py-1.5 text-sm font-semibold text-emerald-700 shadow-sm">
                    {field.fieldType || '11v11'}
                  </span>
                  <div className="flex items-center gap-2">
                    {discountPercent > 0 && (
                      <span className="inline-flex rounded-full bg-emerald-100/95 px-4 py-1.5 text-sm font-semibold text-emerald-700 shadow-sm">
                        {t('field_discount_badge', '{{percent}}% OFF', { percent: discountPercent })}
                      </span>
                    )}
                    <span
                      className={`inline-flex rounded-full bg-white/95 px-4 py-1.5 text-sm font-semibold shadow-sm ${
                        field.status === 'available'
                          ? 'text-blue-600'
                          : field.status === 'maintenance'
                          ? 'text-amber-700'
                          : 'text-rose-600'
                      }`}
                    >
                      {getFieldStatusLabel(field.status, t)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="space-y-2.5 p-5">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">{field.name || 'Untitled field'}</h3>
                  {field.address && <p className="mt-0 text-sm text-gray-500">{field.address}</p>}
                  <div className="mt-1.5 flex items-center gap-2 text-sm text-slate-600">
                    <div className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-amber-600">
                      <StarIcon className="h-4 w-4 fill-current" />
                      <span className="font-semibold text-slate-900">{ratingValue > 0 ? ratingValue.toFixed(1) : '0.0'}</span>
                    </div>
                    <span>
                      {totalRatings > 0
                        ? t('field_ratings_count', '{{count}} áž€áž¶ážšážœáž¶áž™ážáž˜áŸ’áž›áŸƒ', { count: totalRatings })
                        : t('fields_no_rating_yet', 'áž˜áž·áž“áž‘áž¶áž“áŸ‹áž˜áž¶áž“áž€áž¶ážšážœáž¶áž™ážáž˜áŸ’áž›áŸƒ')}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <div className="flex flex-col">
                    {discountPercent > 0 ? (
                      <>
                        <span className="text-base font-semibold text-emerald-600">${discountedPrice}/{t('field_per_hour_short', 'áž˜áŸ‰áŸ„áž„')}</span>
                        <span className="text-xs text-gray-400 line-through">${field.pricePerHour}/{t('field_per_hour_short', 'áž˜áŸ‰áŸ„áž„')}</span>
                      </>
                    ) : (
                      <span>${field.pricePerHour}/{t('field_per_hour_short', 'áž˜áŸ‰áŸ„áž„')}</span>
                    )}
                  </div>
                  <span>{t('players_suffix', '{{count}} áž“áž¶áž€áŸ‹', { count: field.capacity })}</span>
                </div>
                {field.closureMessage && field.status !== 'available' && (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    {field.closureMessage}
                  </p>
                )}
                {(field.closureStartAt || field.closureEndAt) && field.status !== 'available' && (
                  <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                    {field.closureStartAt ? `Closed from: ${new Date(field.closureStartAt).toLocaleDateString()}` : 'Closed from: -'}
                    <br />
                    {field.closureEndAt ? `Open back: ${new Date(field.closureEndAt).toLocaleDateString()}` : 'Open back: not scheduled'}
                  </p>
                )}
                {field.description && <p className="text-sm text-gray-600">{field.description}</p>}
                <div className="flex gap-3 pt-0.5">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      startStatusEdit(field);
                    }}
                    disabled={!isOwned || saving}
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                      field.status === 'available' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
                    }`}
                  >
                    {field.status === 'available'
                      ? t('action_close_field', 'áž”áž·áž‘áž‘áž¸áž›áž¶áž“')
                      : t('action_open_field', 'áž”áž¾áž€áž‘áž¸áž›áž¶áž“')}
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      startEdit(field);
                    }}
                    disabled={!isOwned || saving}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <PencilSquareIcon className="h-4 w-4" />
                    {t('action_edit', 'áž€áŸ‚áž”áŸ’ážšáŸ‚')}
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDelete(field);
                    }}
                    disabled={!isOwned || saving}
                    className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    <TrashIcon className="h-4 w-4" />
                    {t('action_delete', 'Delete')}
                  </button>
                </div>
              </div>
            </div>
          );
          })
        ) : (
          <div className="col-span-full rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-6 py-14 text-center">
            <PhotoIcon className="mx-auto h-10 w-10 text-gray-400" />
            <h3 className="mt-4 text-lg font-semibold text-gray-900">{t('owner_no_fields_title', 'áž˜áž·áž“áž‘áž¶áž“áŸ‹áž˜áž¶áž“áž‘áž¸áž›áž¶áž“')}</h3>
            <p className="mt-2 text-sm text-gray-500">{t('owner_fields_empty_description', 'áž”áž„áŸ’áž€áž¾ážáž‘áž¸áž›áž¶áž“ážŠáŸ†áž”áž¼áž„ážšáž”ážŸáŸ‹áž¢áŸ’áž“áž€ážŠáž¾áž˜áŸ’áž”áž¸áž…áž¶áž”áŸ‹áž•áŸ’ážáž¾áž˜áž‘áž‘áž½áž›áž€áž¶ážšáž€áž€áŸ‹áŸ”')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OwnerFieldsPage;

