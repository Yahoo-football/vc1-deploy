import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ChatBubbleLeftRightIcon,
  ArrowTopRightOnSquareIcon,
  BuildingOfficeIcon,
  CalendarIcon,
  ClockIcon,
  CurrencyDollarIcon,
  MapPinIcon,
  StarIcon as StarOutlineIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../context/RealtimeContext';
import FieldLocationMap from '../components/maps/FieldLocationMap';
import fieldService from '../services/fieldService';
import bookingService from '../services/bookingService';
import { Badge, Button, Card, CardBody, EmptyState, Spinner, useToast } from '../components/ui';
import { buildGoogleMapsLocationUrl, buildLocationLabel } from '../utils/googleMaps';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';
const API_ORIGIN =
  typeof window !== 'undefined' && API_BASE_URL.startsWith('/')
    ? window.location.origin
    : API_BASE_URL.replace(/\/api\/?$/, '');
const DEFAULT_FIELD_IMAGE =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="400"><rect width="100%25" height="100%25" fill="%23e5e7eb"/></svg>';
const SLOT_HOURS = Array.from({ length: 16 }, (_, index) => index + 6);

// Check whether placeholder image is true.
const isPlaceholderImage = (rawImage) => String(rawImage || '').toLowerCase().includes('no field image');

// Format day input for display.
const formatDayInput = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Format hour label for display.
const formatHourLabel = (hour) => `${String(hour).padStart(2, '0')}:00`;

const openNativeDatePicker = (event) => {
  event.currentTarget.focus();
  if (typeof event.currentTarget.showPicker === 'function') {
    try {
      event.currentTarget.showPicker();
    } catch (_) {}
  }
};

const formatSlotRange = (hour) => {
  const start = new Date();
  start.setHours(hour, 0, 0, 0);
  const end = new Date();
  end.setHours(hour + 1, 0, 0, 0);
  return `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  })}`;
};

// Get discount percent for the current view.
const getDiscountPercent = (field) => Math.min(100, Math.max(0, Number(field?.discountPercent || 0)));
// Get discounted price for the current view.
const getDiscountedPrice = (field) => {
  const basePrice = Number(field?.pricePerHour || 0);
  const discountPercent = getDiscountPercent(field);
  return Number((basePrice * (1 - discountPercent / 100)).toFixed(2));
};
// Check whether bookable field is true.
const isBookableField = (field) => String(field?.status || 'available').toLowerCase() === 'available';
// Get status tone for the current view.
const getStatusTone = (status) => {
  const normalizedStatus = String(status || 'available').toLowerCase();
  if (normalizedStatus === 'available') return 'green';
  if (normalizedStatus === 'booked') return 'red';
  if (normalizedStatus === 'maintenance') return 'yellow';
  return 'gray';
};

const buildAssetUrl = (rawPath) => {
  if (!rawPath) return '';
  if (/^https?:\/\//i.test(rawPath) || /^data:/i.test(rawPath)) return rawPath;
  if (String(rawPath).startsWith('/uploads/')) return `${API_ORIGIN}${rawPath}`;
  return rawPath;
};

const getReviewerName = (review) => {
  const fullName = `${review?.user?.firstName || ''} ${review?.user?.lastName || ''}`.trim();
  return fullName || review?.user?.username || 'Unknown user';
};

const getReviewerInitials = (review) => {
  const label = getReviewerName(review);
  return label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'U';
};

const FieldDetailsPage = () => {
  const { id } = useParams();
  const { user, isAuthenticated } = useAuth();
  const { version } = useRealtime();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const canCreateBooking = ['captain', 'field_owner'].includes(user?.role);
  const isAdmin = user?.role === 'admin';
  const canReviewField = ['player', 'captain', 'admin'].includes(user?.role);

  const [field, setField] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [scheduleDay, setScheduleDay] = useState(() => formatDayInput(new Date()));
  const [slotBookings, setSlotBookings] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewForm, setReviewForm] = useState({ rating: 0, comment: '' });
  const discountPercent = getDiscountPercent(field);
  const discountedPrice = getDiscountedPrice(field);
  const canBookThisField = isBookableField(field);
  const fieldAddressLabel = useMemo(() => buildLocationLabel(field || {}), [field]);
  const locationUrl = useMemo(() => buildGoogleMapsLocationUrl(field || {}), [field]);
  const currentUserReview = useMemo(
    () => reviews.find((review) => Number(review.userId) === Number(user?.id)) || null,
    [reviews, user?.id]
  );
  const averageFieldRating = Number(field?.rating || 0);
  const totalFieldRatings = Number(field?.totalRatings || 0);

  useEffect(() => {
    // Support fetch field for this page.
    const fetchField = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fieldService.getFieldById(id);
        setField(response.data || null);
      } catch (err) {
        console.error('Failed to fetch field:', err);
        setError('Failed to load field');
      } finally {
        setLoading(false);
      }
    };

    fetchField();
  }, [id, version]);

  useEffect(() => {
    // Support fetch field schedule for this page.
    const fetchFieldSchedule = async () => {
      if (!field?.id || !scheduleDay) return;

      try {
        setSlotsLoading(true);
        const response = await bookingService.getPublicSchedule(scheduleDay, 24);
        const bookings = Array.isArray(response?.data?.bookings) ? response.data.bookings : [];
        setSlotBookings(bookings.filter((booking) => Number(booking.fieldId) === Number(field.id)));
      } catch (err) {
        console.error('Failed to fetch field schedule:', err);
        setSlotBookings([]);
      } finally {
        setSlotsLoading(false);
      }
    };

    fetchFieldSchedule();
  }, [field?.id, scheduleDay, version]);

  useEffect(() => {
    const fetchFieldReviews = async () => {
      if (!id) return;

      try {
        setReviewsLoading(true);
        const response = await fieldService.getFieldRatings(id);
        const payload = response?.data || {};
        const nextReviews = Array.isArray(payload.reviews) ? payload.reviews : [];
        setReviews(nextReviews);
        if (payload.field) {
          setField((prev) =>
            prev
              ? {
                  ...prev,
                  rating: payload.field.rating,
                  totalRatings: payload.field.totalRatings
                }
              : prev
          );
        }
      } catch (err) {
        console.error('Failed to fetch field reviews:', err);
        setReviews([]);
      } finally {
        setReviewsLoading(false);
      }
    };

    fetchFieldReviews();
  }, [id, version]);

  useEffect(() => {
    if (currentUserReview) {
      setReviewForm({
        rating: Number(currentUserReview.rating || 0),
        comment: currentUserReview.comment || ''
      });
      return;
    }

    setReviewForm({ rating: 0, comment: '' });
  }, [currentUserReview]);

  const handleBook = () => {
    if (field?.status && field.status !== 'available') {
      setError(field.closureMessage || `This field is currently ${field.status}.`);
      return;
    }

    const bookingPath = `/app/bookings/new?fieldId=${id}`;

    if (!isAuthenticated) {
      navigate('/login', { state: { from: bookingPath, backgroundLocation: location } });
      return;
    }

    if (!canCreateBooking) {
      navigate('/app/settings', { state: { focusRoleRequest: 'captain' } });
      return;
    }

    navigate(bookingPath);
  };

  // Handle slot book interactions.
  const handleSlotBook = (hour) => {
    if (field?.status && field.status !== 'available') {
      setError(field.closureMessage || `This field is currently ${field.status}.`);
      return;
    }

    if (!canCreateBooking) {
      handleBook();
      return;
    }

    navigate(`/app/bookings/new?fieldId=${id}&day=${scheduleDay}&time=${String(hour).padStart(2, '0')}:00&duration=1`);
  };

  // Resolve field image url into a display-safe value.
  const resolveFieldImageUrl = (rawImage) => {
    if (!rawImage || isPlaceholderImage(rawImage)) return DEFAULT_FIELD_IMAGE;
    if (/^https?:\/\//i.test(rawImage) || /^data:image\//i.test(rawImage)) return rawImage;
    if (String(rawImage).startsWith('/uploads/')) return `${API_ORIGIN}${rawImage}`;
    return rawImage;
  };

  // Normalize images into a consistent shape.
  const normalizeImages = (imagesValue) => {
    if (Array.isArray(imagesValue)) return imagesValue.filter((image) => !isPlaceholderImage(image));
    if (typeof imagesValue === 'string') {
      try {
        const parsed = JSON.parse(imagesValue);
        return Array.isArray(parsed) ? parsed.filter((image) => !isPlaceholderImage(image)) : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  const renderStars = (value, interactive = false, onSelect = null, iconClassName = 'h-5 w-5') => (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => {
        const active = star <= Number(value || 0);
        const Icon = active ? StarSolidIcon : StarOutlineIcon;
        return (
          <button
            key={star}
            type="button"
            disabled={!interactive}
            onClick={() => onSelect?.(star)}
            className={interactive ? 'transition hover:scale-110 disabled:hover:scale-100' : 'cursor-default'}
          >
            <Icon className={`${iconClassName} ${active ? 'text-amber-400' : 'text-slate-300'}`} />
          </button>
        );
      })}
    </div>
  );

  const handleReviewSubmit = async () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/fields/${id}`, backgroundLocation: location } });
      return;
    }

    if (!canReviewField) {
      showToast('Only players and captains can submit field reviews.', { type: 'error' });
      return;
    }

    const trimmedComment = reviewForm.comment.trim();
    if (!reviewForm.rating || !trimmedComment) {
      showToast('Please choose a star rating and write a comment.', { type: 'error' });
      return;
    }

    try {
      setReviewSubmitting(true);
      const response = await fieldService.rateField(id, {
        rating: reviewForm.rating,
        comment: trimmedComment
      });
      const payload = response?.data || {};

      if (payload.field) {
        setField((prev) =>
          prev
            ? {
                ...prev,
                rating: payload.field.rating,
                totalRatings: payload.field.totalRatings
              }
            : prev
        );
      }

      const reviewsResponse = await fieldService.getFieldRatings(id);
      setReviews(Array.isArray(reviewsResponse?.data?.reviews) ? reviewsResponse.data.reviews : []);
      showToast(payload?.message || 'Review submitted successfully.', { type: 'success' });
    } catch (err) {
      showToast(err?.error || 'Failed to submit review.', { type: 'error' });
    } finally {
      setReviewSubmitting(false);
    }
  };

  const slotItems = useMemo(() => {
    const isFieldClosed = field?.status && field.status !== 'available';

    if (isFieldClosed) {
      return SLOT_HOURS.map((hour) => ({
        key: `${scheduleDay}-${hour}`,
        hour,
        state: 'closed',
        booking: null
      }));
    }

    return SLOT_HOURS.map((hour) => {
      const booking = slotBookings.find((item) => {
        const start = new Date(item.startTime);
        const end = new Date(item.endTime);
        return !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start.getHours() <= hour && end.getHours() > hour;
      });

      if (!booking) {
        return {
          key: `${scheduleDay}-${hour}`,
          hour,
          state: 'available',
          booking: null
        };
      }

      return {
        key: `${scheduleDay}-${hour}`,
        hour,
        state: booking.status === 'pending' ? 'pending' : 'booked',
        booking
      };
    });
  }, [scheduleDay, slotBookings, field?.status]);

  const isFieldClosed = field?.status && field.status !== 'available';
  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'live-booking', label: 'Live Booking' },
    { key: 'comment-rate', label: 'Comment & Rate' }
  ];

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!field) {
    return (
      <EmptyState
        icon={BuildingOfficeIcon}
        title="Field not found"
        description="The field may have been removed or the link is incorrect."
        actionLabel="Back to Fields"
        onAction={() => (window.location.href = '/fields')}
      />
    );
  }

  return (
    <div className="space-y-6">
      {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <Card className="overflow-hidden">
        <div className="h-64 overflow-hidden bg-gray-200">
          <img
            src={resolveFieldImageUrl(normalizeImages(field.images)[0])}
            alt={field.name}
            className="h-full w-full object-cover"
            onError={(event) => {
              if (event.currentTarget.src !== DEFAULT_FIELD_IMAGE) {
                event.currentTarget.src = DEFAULT_FIELD_IMAGE;
              }
            }}
          />
        </div>

        <CardBody className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{field.name}</h1>
              <div className="mt-2 space-y-1 text-sm text-gray-600">
                <div className="flex items-center">
                  <MapPinIcon className="mr-2 h-4 w-4 text-gray-400" />
                  {fieldAddressLabel || 'Address not specified'}
                </div>
                <div className="flex items-center">
                  <BuildingOfficeIcon className="mr-2 h-4 w-4 text-gray-400" />
                  {field.fieldType} | {String(field.surfaceType || '').replace('_', ' ')}
                </div>
                <div className="flex items-center">
                  <CurrencyDollarIcon className="mr-2 h-4 w-4 text-gray-400" />
                  {discountPercent > 0 ? (
                    <span className="flex items-center gap-2">
                      <span className="font-semibold text-emerald-600">${discountedPrice}/hour</span>
                      <span className="text-gray-400 line-through">${field.pricePerHour}/hour</span>
                    </span>
                  ) : (
                    `$${field.pricePerHour}/hour`
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {locationUrl && (
                <Button as="a" href={locationUrl} target="_blank" rel="noreferrer" variant="outline">
                  <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                  Location
                </Button>
              )}
              {!isAdmin && (
                <Button onClick={handleBook} disabled={isFieldClosed}>
                  {isFieldClosed
                    ? 'Field Closed'
                    : isAuthenticated && !canCreateBooking
                    ? 'Request Booking Access'
                    : 'Book Now'}
                </Button>
              )}
              <Button as={Link} to="/fields" variant="outline">
                Back
              </Button>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {field.status && (
              <Badge tone={field.status === 'available' ? 'green' : field.status === 'maintenance' ? 'yellow' : 'gray'} className="capitalize">
                {field.status}
              </Badge>
            )}
            {field.capacity && <Badge tone="gray">{field.capacity} capacity</Badge>}
            {discountPercent > 0 && <Badge tone="green">{discountPercent}% off</Badge>}
          </div>

          {isFieldClosed && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <div className="font-semibold">Field is currently closed.</div>
              <div className="mt-1">{field.closureMessage || 'Bookings are temporarily unavailable for this field.'}</div>
            </div>
          )}

          {field.description && <p className="mt-6 text-gray-700">{field.description}</p>}

          <div className="mt-8 overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 pt-5">
              <div className="flex flex-wrap gap-8">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`border-b-2 pb-4 text-sm font-semibold transition ${
                      activeTab === tab.key
                        ? 'border-slate-900 text-slate-950'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6">
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-5">
                    <h2 className="text-xl font-semibold text-slate-950">About This Field</h2>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      {field.description || 'This field is ready for bookings, team play, and regular matches.'}
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Field Name</div>
                      <div className="mt-2 text-base font-semibold text-slate-950">{field.name || 'Not specified'}</div>
                    </div>

                    <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Field Type</div>
                      <div className="mt-2 text-base font-semibold capitalize text-slate-950">{field.fieldType || 'Not specified'}</div>
                    </div>

                    <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Surface Type</div>
                      <div className="mt-2 text-base font-semibold capitalize text-slate-950">
                        {String(field.surfaceType || 'Not specified').replace(/_/g, ' ')}
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Price Per Hour</div>
                      {discountPercent > 0 ? (
                        <div className="mt-2 space-y-1">
                          <div className="text-base font-semibold text-emerald-600">${discountedPrice}/hour</div>
                          <div className="text-sm text-slate-400 line-through">${field.pricePerHour || 0}/hour</div>
                        </div>
                      ) : (
                        <div className="mt-2 text-base font-semibold text-slate-950">${field.pricePerHour || 0}/hour</div>
                      )}
                    </div>

                    <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Discount</div>
                      <div className="mt-2 text-base font-semibold text-slate-950">{discountPercent}%</div>
                    </div>

                    <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Capacity</div>
                      <div className="mt-2 text-base font-semibold text-slate-950">{field.capacity || 'Not specified'} players</div>
                    </div>

                    <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Status</div>
                      <div className="mt-2">
                        <Badge tone={getStatusTone(field.status)} className="capitalize">
                          {field.status || 'unknown'}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Full Address</h3>
                    <div className="mt-3 flex items-start gap-2 text-sm text-slate-700">
                      <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                      <span>
                        {fieldAddressLabel || 'Address not specified'}
                      </span>
                    </div>
                    {(field.latitude || field.longitude) && (
                      <div className="mt-3 text-xs text-slate-500">
                        Coordinates: {field.latitude || '-'}, {field.longitude || '-'}
                      </div>
                    )}
                  </div>

                  {Number.isFinite(Number(field.latitude)) && Number.isFinite(Number(field.longitude)) && (
                    <div>
                      <h2 className="text-sm font-semibold text-gray-900">Location Map</h2>
                      <div className="mt-3">
                        <FieldLocationMap latitude={field.latitude} longitude={field.longitude} locationUrl={locationUrl} />
                      </div>
                    </div>
                  )}

                  {Array.isArray(field.amenities) && field.amenities.length > 0 && (
                    <div>
                      <h2 className="text-sm font-semibold text-gray-900">Amenities</h2>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {field.amenities.map((amenity) => (
                          <Badge key={amenity} tone="gray">
                            {amenity}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'live-booking' && (
                <div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h2 className="text-sm font-semibold text-gray-900">Live Booking Schedule</h2>
                      <p className="mt-1 text-sm text-gray-600">Visual schedule for this field only. See who is playing when.</p>
                    </div>

                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Select Day</span>
                      <div className="relative">
                        <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <input
                          type="date"
                          value={scheduleDay}
                          min={formatDayInput(new Date())}
                          onChange={(event) => setScheduleDay(event.target.value)}
                          onClick={openNativeDatePicker}
                          className="rounded-xl border border-gray-300 py-2 pl-10 pr-3 text-sm text-gray-700 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-100"
                        />
                      </div>
                    </label>
                  </div>

                  <div className="mt-4 overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-sm">
                    {slotsLoading ? (
                      <div className="flex h-24 items-center justify-center">
                        <Spinner className="h-6 w-6" />
                      </div>
                    ) : (
                      <div>
                        <div className="border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-blue-50 px-4 py-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-slate-900">Field schedule</div>
                              <div className="mt-1 text-xs text-slate-500">Only this field is shown. Captains can book available slots.</div>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                              <span className="inline-flex items-center gap-1">
                                <span className="h-3 w-3 rounded-sm bg-emerald-600" /> Available
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <span className="h-3 w-3 rounded-sm bg-amber-500" /> Pending
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <span className="h-3 w-3 rounded-sm bg-red-600" /> Booked
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <span className="h-3 w-3 rounded-sm bg-slate-600" /> Closed
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex border-b border-slate-200 bg-blue-600 text-white">
                          <div className="w-24 px-4 py-3 text-sm font-semibold">Time</div>
                          <div className="flex-1 border-l border-white/20 px-4 py-3 text-center">
                            <div className="font-semibold">{field.name}</div>
                            <div className="text-xs opacity-90">{field.fieldType || 'Field'}</div>
                          </div>
                        </div>

                        {slotItems.map((slot) => {
                          const isAvailable = slot.state === 'available';
                          const isPending = slot.state === 'pending';
                          const isClosed = slot.state === 'closed';
                          const slotToneClass = isAvailable
                            ? 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                            : isClosed
                            ? 'bg-slate-600 text-white'
                            : isPending
                            ? 'bg-amber-500 hover:bg-amber-600 text-white'
                            : 'bg-red-600 hover:bg-red-700 text-white';

                          return (
                            <div key={slot.key} className="flex border-b border-slate-200 last:border-b-0">
                              <div className="w-24 px-4 py-3 text-sm font-semibold text-slate-900">{formatHourLabel(slot.hour)}</div>
                              <div className="flex-1 border-l border-slate-200 p-1.5">
                                {isAvailable ? (
                                  <button
                                    type="button"
                                    onClick={() => handleSlotBook(slot.hour)}
                                    disabled={!canBookThisField}
                                    className={`flex min-h-[62px] w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-slate-800 transition ${slotToneClass}`}
                                    title={
                                      !canBookThisField
                                        ? 'Field is not available for booking'
                                        : canCreateBooking
                                        ? 'Available - click to book'
                                        : 'Available slot'
                                    }
                                  >
                                    <div>
                                      <div className="text-sm font-semibold">{formatSlotRange(slot.hour)}</div>
                                      <div className="mt-1 text-xs text-slate-500">Open for booking on this field.</div>
                                    </div>
                                    <div className="inline-flex items-center gap-1 text-xs text-slate-500">
                                      <ClockIcon className="h-3.5 w-3.5" />
                                      ${discountPercent > 0 ? discountedPrice : field.pricePerHour}/hr
                                    </div>
                                  </button>
                                ) : (
                                  <div className={`min-h-[62px] rounded-lg px-3 py-2 transition ${slotToneClass}`}>
                                    <div className="truncate text-sm font-bold">
                                      {isClosed ? 'Field closed' : slot.booking?.team?.name || 'Reserved slot'}
                                    </div>
                                    <div className="mt-1 text-xs opacity-90">{formatSlotRange(slot.hour)}</div>
                                    <div className="mt-1 text-xs opacity-90">
                                      {isClosed
                                        ? field.closureMessage || 'This field is not accepting bookings right now.'
                                        : isPending
                                        ? 'Pending request on this field.'
                                        : 'Confirmed booking on this field.'}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'comment-rate' && (
                <div className="space-y-5">
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-5">
                    <h2 className="text-xl font-semibold text-slate-950">Comment & Rate</h2>
                    <p className="mt-2 text-sm text-slate-600">See field feedback and rating summary for this venue.</p>
                  </div>

                  <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
                    <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
                      <div className="text-sm font-medium text-slate-500">Average Rating</div>
                      <div className="mt-3 flex items-end gap-3">
                        <div className="text-4xl font-bold text-slate-950">{averageFieldRating > 0 ? averageFieldRating.toFixed(1) : '0.0'}</div>
                        <div className="pb-1 text-sm text-slate-500">/ 5</div>
                      </div>
                      <div className="mt-3">{renderStars(Math.round(averageFieldRating), false, null, 'h-6 w-6')}</div>
                      <div className="mt-3 text-sm text-slate-600">
                        {totalFieldRatings > 0 ? `${totalFieldRatings} review${totalFieldRatings === 1 ? '' : 's'}` : 'No reviews yet'}
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
                      <h3 className="text-lg font-semibold text-slate-950">
                        {currentUserReview ? 'Update Your Review' : 'Write a Review'}
                      </h3>
                      <p className="mt-2 text-sm text-slate-600">
                        Players and captains can leave a star rating with a comment for this field.
                      </p>

                      {!isAuthenticated ? (
                        <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
                          <p className="text-sm text-slate-600">Log in as a player or captain to rate this field.</p>
                          <Button
                            className="mt-4"
                            onClick={() => navigate('/login', { state: { from: `/fields/${id}`, backgroundLocation: location } })}
                          >
                            Login to Review
                          </Button>
                        </div>
                      ) : canReviewField ? (
                        <>
                          <div className="mt-5">
                            <div className="text-sm font-medium text-slate-700">Your Star Rating</div>
                            <div className="mt-3">{renderStars(reviewForm.rating, true, (star) => setReviewForm((prev) => ({ ...prev, rating: star })), 'h-8 w-8')}</div>
                          </div>
                          <label className="mt-5 block">
                            <span className="text-sm font-medium text-slate-700">Your Comment</span>
                            <textarea
                              value={reviewForm.comment}
                              onChange={(event) => setReviewForm((prev) => ({ ...prev, comment: event.target.value.slice(0, 1000) }))}
                              rows={5}
                              placeholder="Share your experience with this field."
                              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                            />
                            <div className="mt-2 text-right text-xs text-slate-400">{reviewForm.comment.length}/1000</div>
                          </label>
                          <div className="mt-5">
                            <Button onClick={handleReviewSubmit} disabled={reviewSubmitting}>
                              {reviewSubmitting ? 'Submitting...' : currentUserReview ? 'Update Review' : 'Submit Review'}
                            </Button>
                          </div>
                        </>
                      ) : (
                        <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                          Only player and captain accounts can submit reviews here.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-950">Recent Reviews</h3>
                        <p className="mt-1 text-sm text-slate-600">Everyone can see who reviewed this field and how many stars they gave.</p>
                      </div>
                    </div>

                    {reviewsLoading ? (
                      <div className="flex min-h-[160px] items-center justify-center">
                        <Spinner className="h-6 w-6" />
                      </div>
                    ) : reviews.length > 0 ? (
                      <div className="mt-5 space-y-4">
                        {reviews.map((review) => {
                          const avatarUrl = buildAssetUrl(review?.user?.avatarUrl);
                          return (
                            <div key={review.id} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                              <div className="flex items-start gap-4">
                                {avatarUrl ? (
                                  <img src={avatarUrl} alt={`${getReviewerName(review)} avatar`} className="h-12 w-12 rounded-full object-cover" />
                                ) : (
                                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-700">
                                    {getReviewerInitials(review)}
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                      <div className="font-semibold text-slate-950">{getReviewerName(review)}</div>
                                      <div className="text-xs text-slate-500">
                                        @{review?.user?.username || 'user'} | {review?.createdAt ? new Date(review.createdAt).toLocaleString() : 'Date unavailable'}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {renderStars(review.rating, false, null, 'h-5 w-5')}
                                      <span className="text-sm font-semibold text-slate-700">{Number(review.rating).toFixed(1)}</span>
                                    </div>
                                  </div>
                                  <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-700">{review.comment}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-[24px] border border-dashed border-slate-200 bg-white p-6 text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                          <ChatBubbleLeftRightIcon className="h-6 w-6" />
                        </div>
                        <h3 className="mt-4 text-base font-semibold text-slate-950">No reviews yet</h3>
                        <p className="mt-2 text-sm text-slate-600">Be the first player or captain to leave a rating and comment for this field.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};

export default FieldDetailsPage;
