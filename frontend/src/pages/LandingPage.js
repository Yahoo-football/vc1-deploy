import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  BoltIcon,
  ArrowTrendingUpIcon,
  BuildingOfficeIcon,
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  ClockIcon,
  CreditCardIcon,
  EnvelopeIcon,
  GiftIcon,
  MapPinIcon,
  MagnifyingGlassIcon,
  PhoneIcon,
  SparklesIcon,
  TrophyIcon,
  UsersIcon,
  WifiIcon,
  CheckIcon,
  ShieldCheckIcon,
  LightBulbIcon,
  CameraIcon,
  CircleStackIcon,
  CubeIcon,
  WindowIcon,
  HomeIcon
} from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';
import fieldService from '../services/fieldService';
import bookingService from '../services/bookingService';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { EmptyState, ScrollReveal, Spinner } from '../components/ui';
import { ROLE_UPGRADE_CONFIG } from '../config/roleUpgradeConfig';
import { APP_CONFIG } from '../config/appConfig';

const HERO_IMAGES = [
  '/hero-manu.jpg',
  '/Manchester_City_pitch_invasion.JPG',
  'https://4kwallpapers.com/images/walls/thumbs_3t/19432.jpeg',
  '/Wembley_Stadium_interior.jpg'
];
const HERO_SEARCH_OPTIONS = [
  { value: 'field', labelKey: 'landing_hero_search_fields', fallback: 'Fields' },
  { value: 'captain', labelKey: 'landing_hero_search_captains', fallback: 'Captains' },
  { value: 'player', labelKey: 'landing_hero_search_players', fallback: 'Players' }
];

const FIELD_FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1459865264687-595d652de67e?auto=format&fit=crop&w=900&q=80';

const FEATURED_CARD_IMAGES = [
  'https://upload.wikimedia.org/wikipedia/commons/thumb/1/16/Wembley_Stadium_interior.jpg/1280px-Wembley_Stadium_interior.jpg',
  'https://i.pinimg.com/1200x/5c/41/fa/5c41fab583e85303594a8b24ae0132ce.jpg',
  'https://4kwallpapers.com/images/walls/thumbs_3t/19432.jpeg'
];
const PREMIUM_GUARANTEE_ITEMS = [
  { key: 'daily_maintenance', className: 'bg-emerald-100 text-emerald-700' },
  { key: 'professional_standards', className: 'bg-blue-100 text-blue-700' },
  { key: 'safety_certified', className: 'bg-violet-100 text-violet-700' },
  { key: 'eco_friendly', className: 'bg-amber-100 text-amber-700' }
];

const WORLD_CLASS_FACILITIES = [
  { key: 'free_wifi', icon: WifiIcon, title: 'Free WiFi', description: 'High-speed internet available', iconBgColor: 'bg-blue-100', iconColor: 'text-blue-600', accentColor: 'border-blue-100' },
  { key: 'free_parking', icon: CheckIcon, title: 'Free Parking', description: 'Ample parking space', iconBgColor: 'bg-emerald-100', iconColor: 'text-emerald-600', accentColor: 'border-emerald-100' },
  { key: 'shower_rooms', icon: HomeIcon, title: 'Shower Rooms', description: 'Clean changing facilities', iconBgColor: 'bg-violet-100', iconColor: 'text-violet-600', accentColor: 'border-violet-100' },
  { key: 'cctv_security', icon: CameraIcon, title: 'CCTV Security', description: '24/7 surveillance', iconBgColor: 'bg-rose-100', iconColor: 'text-rose-600', accentColor: 'border-rose-100' },
  { key: 'led_floodlights', icon: LightBulbIcon, title: 'LED Floodlights', description: 'Professional lighting', iconBgColor: 'bg-amber-100', iconColor: 'text-amber-600', accentColor: 'border-amber-100' },
  { key: 'cafeteria', icon: CubeIcon, title: 'Cafeteria', description: 'Snacks & beverages', iconBgColor: 'bg-orange-100', iconColor: 'text-orange-600', accentColor: 'border-orange-100' },
  { key: 'first_aid', icon: ShieldCheckIcon, title: 'First Aid', description: 'Medical assistance ready', iconBgColor: 'bg-teal-100', iconColor: 'text-teal-600', accentColor: 'border-teal-100' },
  { key: 'air_conditioned', icon: WindowIcon, title: 'Air Conditioned', description: 'Climate controlled rooms', iconBgColor: 'bg-cyan-100', iconColor: 'text-cyan-600', accentColor: 'border-cyan-100' },
  { key: 'water_stations', icon: CircleStackIcon, title: 'Water Stations', description: 'Free drinking water', iconBgColor: 'bg-sky-100', iconColor: 'text-sky-600', accentColor: 'border-sky-100' },
  { key: 'spectator_area', icon: UsersIcon, title: 'Spectator Area', description: 'Seating for supporters', iconBgColor: 'bg-indigo-100', iconColor: 'text-indigo-600', accentColor: 'border-indigo-100' },
  { key: 'equipment_rental', icon: BuildingOfficeIcon, title: 'Equipment Rental', description: 'Balls, bibs & gear', iconBgColor: 'bg-pink-100', iconColor: 'text-pink-600', accentColor: 'border-pink-100' },
  { key: 'lounge_area', icon: HomeIcon, title: 'Lounge Area', description: 'Comfortable waiting space', iconBgColor: 'bg-yellow-100', iconColor: 'text-yellow-600', accentColor: 'border-yellow-100' }
];

const TIME_SLOTS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];
const POPULAR_TIME_SLOT_SESSIONS = [
  {
    key: 'morning',
    label: 'Morning Session',
    time: '08:00 - 12:00',
    startHour: 8,
    endHour: 12,
    fallbackRate: 68,
    description: 'Cooler kickoff hours for teams that want an early start.'
  },
  {
    key: 'afternoon',
    label: 'Afternoon Session',
    time: '12:00 - 18:00',
    startHour: 12,
    endHour: 18,
    fallbackRate: 80,
    description: 'Balanced midday and after-work demand for flexible match schedules.'
  },
  {
    key: 'evening',
    label: 'Evening Session',
    time: '18:00 - 22:00',
    startHour: 18,
    endHour: 22,
    fallbackRate: 92,
    description: 'Prime-time booking window for the busiest games under the lights.'
  }
];

// Map to status for the current UI state.
const rateToStatus = (rate) => {
  if (rate >= 80) return 'High Demand';
  if (rate >= 60) return 'Popular';
  if (rate >= 40) return 'Steady';
  return 'Open';
};

const GENERIC_FIELD_NAME_PATTERNS = [
  /^field\s+\d+$/i,
  /^premium outdoor field$/i,
  /^stadium football pitch$/i,
  /^indoor football arena$/i,
  /^city center pitch$/i,
  /^night lights field$/i,
  /^champions ground$/i
];

const isGenericFieldName = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return true;
  return GENERIC_FIELD_NAME_PATTERNS.some((pattern) => pattern.test(normalized));
};

const buildAvailabilityCardTitle = (field, index) => {
  const name = String(field?.name || '').trim();
  if (!isGenericFieldName(name)) return name;

  const locationLabel = String(field?.address || field?.city || '').trim();
  const fieldTypeLabel = String(field?.fieldType || '').trim();

  if (locationLabel && fieldTypeLabel) return `${locationLabel} ${fieldTypeLabel}`.trim();
  if (locationLabel) return locationLabel;
  if (fieldTypeLabel) return `${fieldTypeLabel} Field`;
  return `Field ${index + 1}`;
};

const rateToTone = (rate) => {
  if (rate >= 80) return 'limited';
  if (rate >= 60) return 'moderate';
  if (rate >= 40) return 'available';
  return 'cool';
};

// Build popular time slot card for rendering.
const buildPopularTimeSlotCard = (session, rate, extra = {}) => ({
  key: session.key,
  label: session.label,
  time: session.time,
  description: session.description,
  rate,
  status: rateToStatus(rate),
  tone: rateToTone(rate),
  ...extra
});

const roundToSingleDecimal = (value) => Math.round(value * 10) / 10;

const applyStarRatings = (slots) => {
  const maxBookedMinutes = Math.max(...slots.map((slot) => Number(slot.bookedMinutes || 0)), 0);
  const maxBookingCount = Math.max(...slots.map((slot) => Number(slot.bookingCount || 0)), 0);
  const scoredSlots = slots.map((slot) => {
    const occupancyScore = Math.max(0, Math.min(1, Number(slot.rate || 0) / 100));
    const bookedMinutesScore =
      maxBookedMinutes > 0 ? Math.max(0, Math.min(1, Number(slot.bookedMinutes || 0) / maxBookedMinutes)) : 0;
    const bookingCountScore =
      maxBookingCount > 0 ? Math.max(0, Math.min(1, Number(slot.bookingCount || 0) / maxBookingCount)) : 0;

    // Popularity score based on real booking activity:
    // occupancy matters most, then total booked time, then number of bookings.
    const popularityScore =
      occupancyScore * 0.5 +
      bookedMinutesScore * 0.3 +
      bookingCountScore * 0.2;

    return {
      ...slot,
      occupancyScore,
      popularityScore,
      hasRealBookings: Number(slot.bookedMinutes || 0) > 0 || Number(slot.bookingCount || 0) > 0
    };
  });

  const realScores = scoredSlots
    .filter((slot) => slot.hasRealBookings)
    .map((slot) => slot.popularityScore);
  const minRealScore = realScores.length > 0 ? Math.min(...realScores) : 0;
  const maxRealScore = realScores.length > 0 ? Math.max(...realScores) : 0;
  const rankedKeys = [...scoredSlots]
    .sort((a, b) => {
      if (b.popularityScore !== a.popularityScore) return b.popularityScore - a.popularityScore;
      if (b.bookedMinutes !== a.bookedMinutes) return b.bookedMinutes - a.bookedMinutes;
      if (b.bookingCount !== a.bookingCount) return b.bookingCount - a.bookingCount;
      return a.label.localeCompare(b.label);
    })
    .map((slot) => slot.key);

  return scoredSlots.map((slot) => {
    let ratingValue = 4.0;

    if (slot.hasRealBookings) {
      const normalizedScore =
        maxRealScore > minRealScore
          ? (slot.popularityScore - minRealScore) / (maxRealScore - minRealScore)
          : slot.occupancyScore;

      // Keep ratings high because these cards represent already-popular sessions,
      // while still preserving real differences from booking activity.
      ratingValue = roundToSingleDecimal(4.2 + normalizedScore * 0.7);
    } else {
      ratingValue = roundToSingleDecimal(3.8 + slot.occupancyScore * 0.4);
    }

    const rankIndex = rankedKeys.indexOf(slot.key);
    const rankAdjustment = rankIndex >= 0 ? (rankedKeys.length - 1 - rankIndex) * 0.1 : 0;
    ratingValue = roundToSingleDecimal(Math.min(4.9, ratingValue + rankAdjustment));

    return {
      ...slot,
      stars: Math.max(1, Math.round(ratingValue)),
      rating: ratingValue.toFixed(1)
    };
  });
};

const POPULAR_TIME_SLOTS = applyStarRatings(
  POPULAR_TIME_SLOT_SESSIONS.map((session) => buildPopularTimeSlotCard(session, session.fallbackRate))
);

// Get slot start hour for the current view.
const getSlotStartHour = (slot) => {
  if (Number.isFinite(Number(slot?.startHour))) return Number(slot.startHour);

  const startTime = String(slot?.time || '').split(' - ')[0];
  const [hours] = startTime.split(':').map((value) => Number(value));
  return Number.isFinite(hours) ? hours : null;
};

// Build popular time slots from stats for rendering.
const buildPopularTimeSlotsFromStats = (slotStats) => {
  if (!Array.isArray(slotStats) || slotStats.length === 0) {
    return POPULAR_TIME_SLOTS;
  }

  const cards = POPULAR_TIME_SLOT_SESSIONS.map((session) => {
    const matchingSlots = slotStats.filter((slot) => {
      const startHour = getSlotStartHour(slot);
      return Number.isFinite(startHour) && startHour >= session.startHour && startHour < session.endHour;
    });

    if (matchingSlots.length === 0) {
      return buildPopularTimeSlotCard(session, session.fallbackRate);
    }

    const totalBookedMinutes = matchingSlots.reduce((sum, slot) => sum + Number(slot.bookedMinutes || 0), 0);
    const weightedRate = totalBookedMinutes > 0
      ? Math.round(
          matchingSlots.reduce(
            (sum, slot) => sum + (Number(slot.rate || 0) * Number(slot.bookedMinutes || 0)),
            0
          ) / totalBookedMinutes
        )
      : Math.round(
          matchingSlots.reduce((sum, slot) => sum + Number(slot.rate || 0), 0) / matchingSlots.length
        );

    return buildPopularTimeSlotCard(session, weightedRate);
  });

  return applyStarRatings(cards);
};

// Calculate real popular time slots from booking data
const calculatePopularTimeSlots = (bookings) => {
  if (!bookings || bookings.length === 0) {
    return POPULAR_TIME_SLOTS;
  }

  const relevantBookings = bookings.filter((booking) => {
    const status = String(booking?.status || '').toLowerCase();
    return booking?.startTime && (status === 'confirmed' || status === 'completed');
  });

  if (relevantBookings.length === 0) {
    return POPULAR_TIME_SLOTS;
  }

  const cards = POPULAR_TIME_SLOT_SESSIONS.map((session) => {
    const sessionBookings = relevantBookings.filter((booking) => {
      const bookingDate = new Date(booking.startTime);
      if (Number.isNaN(bookingDate.getTime())) return false;
      const hour = bookingDate.getHours();
      return hour >= session.startHour && hour < session.endHour;
    });

    const rate = Math.round((sessionBookings.length / relevantBookings.length) * 100);
    return buildPopularTimeSlotCard(session, rate);
  });

  return applyStarRatings(cards);
};
const DISCOUNT_OFFER_ICONS = [GiftIcon, SparklesIcon, ClockIcon, UsersIcon];
// Get field discount percent for the current view.
const getFieldDiscountPercent = (field) => Math.max(0, Math.min(100, Number(field?.discountPercent || 0)));
// Get discounted field price for the current view.
const getDiscountedFieldPrice = (field) => {
  const price = Number(field?.pricePerHour || 0);
  const discountPercent = getFieldDiscountPercent(field);
  return Number((price * (1 - discountPercent / 100)).toFixed(2));
};
const buildDiscountOfferDescription = (field, t) => {
  const savedAmount = Number((Number(field?.pricePerHour || 0) - getDiscountedFieldPrice(field)).toFixed(2));
  return t(
    'landing_discount_description',
    'Save {{amount}}/hour on this field in {{city}}.',
    { amount: savedAmount, city: field.city || field.province || t('landing_your_city', 'your city') }
  );
};
const SCHEDULE_ROW_HEIGHT_CLASS = 'h-16';
const SCHEDULE_COLUMN_MIN_WIDTH = 180;
const SCHEDULE_TIME_COLUMN_WIDTH_CLASS = 'w-36';
const toLocalDateKey = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
// Parse slot to minutes into a usable value.
const parseSlotToMinutes = (slot) => {
  const [h, m] = String(slot || '')
    .split(':')
    .map((n) => Number(n));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
};
const findEventsForSlot = (events, slot) => {
  const slotMinutes = parseSlotToMinutes(slot);
  if (!Number.isFinite(slotMinutes)) return [];
  const slotEndMinutes = slotMinutes + 60;
  return events.filter(
    (event) =>
      Number.isFinite(event.startMinutes) &&
      Number.isFinite(event.endMinutes) &&
      event.startMinutes < slotEndMinutes &&
      slotMinutes < event.endMinutes
  );
};
const formatSlotTo12h = (slot) => {
  const [h, m] = String(slot || '')
    .split(':')
    .map((n) => Number(n));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return '';
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`;
};
const getFieldClosureTitle = (field, t) => {
  const status = String(field?.status || '').toLowerCase();
  if (status === 'maintenance') return t('field_status_maintenance', 'Under maintenance');
  if (status === 'unavailable') return t('landing_closed_by_owner', 'Closed by owner');
  return t('landing_closed', 'Closed');
};
const getFieldClosureReason = (field, t) => {
  const reason = String(field?.closureMessage || '').trim();
  const normalizedReason = reason.toLowerCase();
  if (reason) {
    if (normalizedReason === 'temporarily closed by field owner.') {
      return t('landing_closure_reason_owner', 'The field owner has temporarily closed bookings for this field.');
    }
    return reason;
  }

  const status = String(field?.status || '').toLowerCase();
  if (status === 'maintenance') return t('landing_closure_reason_maintenance', 'This field is currently under maintenance.');
  if (status === 'unavailable') return t('landing_closure_reason_unavailable', 'The field owner has marked this field as unavailable.');
  return t('landing_closure_reason_default', 'Bookings for this field are temporarily unavailable.');
};
const getFieldClosureReopenLabel = (field, t) => {
  if (!field?.closureEndAt) return '';
  const reopenDate = new Date(field.closureEndAt);
  if (Number.isNaN(reopenDate.getTime())) return '';

  return t('landing_reopens_on', 'Reopens {{date}}', {
    date: reopenDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  });
};
const getHeroSearchPlaceholder = (type, t) => {
  if (type === 'captain') {
    return t('landing_hero_search_placeholder_captains', 'Search captain name, username, or team');
  }

  if (type === 'player') {
    return t('landing_hero_search_placeholder_players', 'Search player name or public team');
  }

  return t('landing_hero_search_placeholder_fields', 'Search field name, city, or surface');
};
const isBookingActiveOnSchedule = (booking) =>
  booking?.status !== 'cancelled' && booking?.status !== 'completed';
const LandingPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { t } = useLanguage();
  const canCreateBooking = ['captain', 'field_owner'].includes(user?.role);
  const scheduleSectionRef = useRef(null);
  const [popularFields, setPopularFields] = useState([]);
  const [landingFields, setLandingFields] = useState([]);
  const [popularTimeSlots, setPopularTimeSlots] = useState(POPULAR_TIME_SLOTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDay, setSelectedDay] = useState(toLocalDateKey(new Date()));
  const [quickDate] = useState(toLocalDateKey(new Date()));
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleFieldsData, setScheduleFieldsData] = useState([]);
  const [scheduleBookingsData, setScheduleBookingsData] = useState([]);
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroSearchType, setHeroSearchType] = useState('field');
  const [heroSearchTerm, setHeroSearchTerm] = useState('');

  useEffect(() => {
    // Support fetch landing data for this page.
    const fetchLandingData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [fieldsResult, bookingsResult] = await Promise.allSettled([
          fieldService.getAllFields({ limit: 12, status: 'available' }),
          bookingService.getPublicBookingStats({
            lookbackDays: 30,
            top: 7,
            statuses: 'confirmed,completed',
            timezoneOffsetMinutes: new Date().getTimezoneOffset()
          })
        ]);

        const fieldsResponse = fieldsResult.status === 'fulfilled' ? fieldsResult.value : null;
        const bookingsResponse = bookingsResult.status === 'fulfilled' ? bookingsResult.value : { success: false, data: {} };

        const fields = Array.isArray(fieldsResponse?.data) ? fieldsResponse.data : [];
        const slotStats = bookingsResponse?.success && Array.isArray(bookingsResponse?.data?.timeSlots)
          ? bookingsResponse.data.timeSlots
          : [];
        const bookings = bookingsResponse?.success && Array.isArray(bookingsResponse?.data) ? bookingsResponse.data : [];

        setLandingFields(fields);

        const topFields = [...fields]
          .sort((a, b) => {
            const ratingA = Number(a.rating || 0);
            const ratingB = Number(b.rating || 0);
            const totalA = Number(a.totalRatings || 0);
            const totalB = Number(b.totalRatings || 0);
            if (ratingB !== ratingA) return ratingB - ratingA;
            return totalB - totalA;
          })
          .slice(0, 6);

        // Use server-side aggregation as source of truth; fallback to client calculation if needed.
        if (slotStats.length > 0) {
          setPopularTimeSlots(buildPopularTimeSlotsFromStats(slotStats));
        } else {
          const calculatedPopularSlots = calculatePopularTimeSlots(bookings);
          setPopularTimeSlots(calculatedPopularSlots);
        }

        setPopularFields(topFields);

        // Show page with partial data when stats fail; field data is required.
        if (fieldsResult.status === 'rejected') {
          throw new Error('Landing field request failed');
        }
      } catch (err) {
        console.error('Failed to load landing data:', err);
        setError('Failed to load landing data');
      } finally {
        setLoading(false);
      }
    };

    fetchLandingData();
  }, []);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % HERO_IMAGES.length);
    }, 4000);

    return () => clearInterval(intervalId);
  }, []);

  const whyChooseUs = useMemo(
    () => [
      { title: t('landing_easy_booking', 'Easy Booking'), description: t('landing_easy_booking_desc', 'Reserve your field in just a few taps with a clear schedule.'), icon: CalendarIcon },
      { title: t('landing_secure_payment', 'Secure Payment'), description: t('landing_secure_payment_desc', 'Reliable and secure transactions for every booking.'), icon: CreditCardIcon },
      { title: t('landing_flexible_hours', 'Flexible Hours'), description: t('landing_flexible_hours_desc', 'Choose from morning to night for casual games or competitive matches.'), icon: ClockIcon },
      { title: t('landing_best_prices', 'Best Prices'), description: t('landing_best_prices_desc', 'Transparent pricing with competitive rates from field owners.'), icon: TrophyIcon },
      { title: t('landing_team_friendly', 'Team Friendly'), description: t('landing_team_friendly_desc', 'Create a team, invite players, and organize matches faster.'), icon: UsersIcon },
      { title: t('landing_premium_facilities', 'Premium Facilities'), description: t('landing_premium_facilities_desc', 'Find fields with quality turf and useful amenities.'), icon: BuildingOfficeIcon }
    ],
    [t]
  );

  const steps = useMemo(
    () => [
      { id: '01', title: t('landing_step_browse', 'Browse Fields'), description: t('landing_step_browse_desc', 'View available football fields and compare different options.'), icon: MagnifyingGlassIcon },
      { id: '02', title: t('landing_step_select', 'Select Date and Time'), description: t('landing_step_select_desc', 'Choose the time that fits your team schedule.'), icon: CalendarIcon },
      { id: '03', title: t('landing_step_confirm', 'Confirm Booking'), description: t('landing_step_confirm_desc', 'Send your request and get booking confirmation quickly.'), icon: CheckCircleIcon },
      { id: '04', title: t('landing_step_play', 'Play the Match'), description: t('landing_step_play_desc', 'Show up, play, and enjoy your game.'), icon: TrophyIcon }
    ],
    [t]
  );

  const upgradePrograms = useMemo(
    () => [
      {
        roleKey: 'captain',
        icon: UsersIcon,
        audience: t('landing_upgrade_captain_audience', 'For players ready to lead'),
        accent: 'from-emerald-500 to-green-600'
      },
      {
        roleKey: 'field_owner',
        icon: BuildingOfficeIcon,
        audience: t('landing_upgrade_owner_audience', 'For field managers and entrepreneurs'),
        accent: 'from-sky-500 to-cyan-600'
      }
    ],
    [t]
  );

  const featuredFields = useMemo(() => {
    return popularFields.slice(0, 6);
  }, [popularFields]);

  const discountOffers = useMemo(() => {
    return [...landingFields]
      .filter((field) => getFieldDiscountPercent(field) > 0)
      .sort((a, b) => {
        const discountDiff = getFieldDiscountPercent(b) - getFieldDiscountPercent(a);
        if (discountDiff !== 0) return discountDiff;
        return getDiscountedFieldPrice(a) - getDiscountedFieldPrice(b);
      })
      .slice(0, 4)
      .map((field, index) => ({
        id: field.id,
        field,
        icon: DISCOUNT_OFFER_ICONS[index % DISCOUNT_OFFER_ICONS.length],
        title: field.name,
        description: buildDiscountOfferDescription(field, t),
        discountLabel: `${getFieldDiscountPercent(field)}% OFF`,
        cityLabel: field.city || field.province || t('landing_featured_field', 'Featured field'),
        time: index === 0 ? '18:00' : index === 1 ? '17:00' : index === 2 ? '19:00' : '20:00'
      }));
  }, [landingFields, t]);

  const featuredDiscountOffer = discountOffers[0] || null;

  const handleUpgradeNow = (roleKey) => {
    if (!isAuthenticated) {
      navigate('/register', { state: { focusRoleRequest: roleKey, source: 'landing-upgrade' } });
      return;
    }

    const settingsPath = user?.role === 'field_owner' ? '/owner/settings' : '/app/settings';
    navigate(settingsPath, { state: { focusRoleRequest: roleKey, source: 'landing-upgrade' } });
  };

  const handleCallForDemo = (roleKey) => {
    const plan = ROLE_UPGRADE_CONFIG[roleKey];
    const subject = encodeURIComponent(`${plan?.title || 'Role upgrade'} demo request`);
    const body = encodeURIComponent(
      `Hello,\n\nI want a quick demo for ${plan?.title || 'this upgrade'}.\nPlease contact me with the next steps.\n`
    );
    window.location.href = `mailto:bookings@fieldbook.app?subject=${subject}&body=${body}`;
  };

  const scheduleDays = useMemo(() => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);

    return Array.from({ length: 6 }).map((_, index) => {
      const day = new Date(base);
      day.setDate(base.getDate() + index);
      const key = toLocalDateKey(day);
      const label =
        index === 0
          ? 'Today'
          : index === 1
            ? 'Tomorrow'
            : `${String(day.getDate()).padStart(2, '0')} ${day.toLocaleDateString('en-US', { weekday: 'short' })}`;

      return { key, label };
    });
  }, []);

  // Resolve field image into a display-safe value.
  const resolveFieldImage = (images) => {
    if (Array.isArray(images) && images.length > 0) return images[0];

    if (typeof images === 'string') {
      // Handle JSON string values saved by backend like: '["https://..."]'
      if (images.trim().startsWith('[')) {
        try {
          const parsed = JSON.parse(images);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed[0];
        } catch (_e) {
          // fall through
        }
      }
      // Handle direct URL string values
      if (images.startsWith('http://') || images.startsWith('https://')) return images;
    }

    return FIELD_FALLBACK_IMAGE;
  };

  useEffect(() => {
    // Support fetch schedule for this page.
    const fetchSchedule = async () => {
      try {
        setScheduleLoading(true);
        const response = await bookingService.getPublicSchedule(selectedDay);
        const payload = response.data || {};
        const fields = Array.isArray(payload.fields) ? payload.fields : [];
        const bookings = Array.isArray(payload.bookings) ? payload.bookings : [];
        setScheduleFieldsData(fields);
        setScheduleBookingsData(bookings);
      } catch (err) {
        console.error('Failed to load public schedule:', err);
        setScheduleFieldsData([]);
        setScheduleBookingsData([]);
      } finally {
        setScheduleLoading(false);
      }
    };

    fetchSchedule();
  }, [selectedDay]);

  const scheduleFields = useMemo(() => {
    if (scheduleFieldsData.length > 0) return scheduleFieldsData;
    return featuredFields;
  }, [scheduleFieldsData, featuredFields]);
  const scheduleTableMinWidth = `${Math.max(scheduleFields.length, 1) * SCHEDULE_COLUMN_MIN_WIDTH + 112}px`;
  const getDayBoundsMs = useCallback((dayKey) => {
    const day = new Date(`${dayKey}T00:00:00`);
    if (Number.isNaN(day.getTime())) return null;
    const start = new Date(day);
    start.setHours(0, 0, 0, 0);
    const end = new Date(day);
    end.setHours(23, 59, 59, 999);
    return { startMs: start.getTime(), endMs: end.getTime() };
  }, []);
  const toMsOrNull = useCallback((value) => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
  }, []);
  const isFieldClosedForDay = useCallback((field, dayKey) => {
    const status = String(field?.status || 'available').toLowerCase();
    if (status === 'available') return false;

    const bounds = getDayBoundsMs(dayKey);
    if (!bounds) return true;

    const closureStartMs = toMsOrNull(field?.closureStartAt);
    const closureEndMs = toMsOrNull(field?.closureEndAt);
    const hasWindow = closureStartMs !== null || closureEndMs !== null;

    if (!hasWindow) return true;

    const startsBeforeOrOnDay = closureStartMs === null || bounds.endMs >= closureStartMs;
    const endsAfterDayStart = closureEndMs === null || bounds.startMs < closureEndMs;
    return startsBeforeOrOnDay && endsAfterDayStart;
  }, [getDayBoundsMs, toMsOrNull]);
  const isFieldAvailable = useCallback((field, dayKey) => !isFieldClosedForDay(field, dayKey), [isFieldClosedForDay]);
  const activeScheduleFieldsCount = scheduleFields.filter((field) => isFieldAvailable(field, selectedDay)).length;

  const formatHHMM = (value) =>
    new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });

  const scheduleEvents = useMemo(() => {
    return scheduleBookingsData
      .filter((booking) => isBookingActiveOnSchedule(booking))
      .map((booking) => {
        const start = formatHHMM(booking.startTime);
        const end = formatHHMM(booking.endTime);
        const homeTeamName = booking.teamName || booking?.team?.name || 'Booked Slot';
        const opponentTeamName = booking?.opponentTeam?.name || null;
        const teamDisplay = opponentTeamName ? `${homeTeamName} vs ${opponentTeamName}` : homeTeamName;
        const isOwnBooking =
          Number(booking?.createdBy) === Number(user?.id) ||
          Number(booking?.team?.captainId) === Number(user?.id);

        return {
          id: `bk-${booking.id}`,
          bookingId: booking.id,
          status: booking.status,
          fieldKey: booking.fieldId,
          team: teamDisplay,
          start,
          end,
          startMinutes: parseSlotToMinutes(start),
          endMinutes: parseSlotToMinutes(end),
          players: booking.players || booking?.team?.teamMembers?.length || 22,
          isOwnBooking,
          tone:
            booking.status === 'pending'
              ? 'bg-amber-500'
              : booking.status === 'cancellation_pending'
              ? 'bg-orange-500'
              : isOwnBooking
              ? 'bg-emerald-600'
              : 'bg-red-600'
        };
      });
  }, [scheduleBookingsData, user?.id]);

  const availableNowCards = useMemo(() => {
    const source = scheduleFields.slice(0, 4);
    if (source.length === 0) return [];

    const dayKey = selectedDay || toLocalDateKey(new Date());
    const todayKey = toLocalDateKey(new Date());
    const isTodaySchedule = dayKey === todayKey;
    const dayLabel = scheduleDays.find((day) => day.key === dayKey)?.label || dayKey;
    const now = new Date();
    const thresholdMinutes = isTodaySchedule ? now.getHours() * 60 + now.getMinutes() : -1;

    return source.map((field, index) => {
      const isFieldClosed = !isFieldAvailable(field, dayKey);
      const fieldId = Number(field.id);
      const fieldEvents = scheduleEvents.filter(
        (event) =>
          Number(event.fieldKey) === fieldId &&
          Number.isFinite(event.startMinutes) &&
          Number.isFinite(event.endMinutes)
      );

      const currentSlot = isTodaySchedule
        ? [...TIME_SLOTS]
            .reverse()
            .find((slot) => {
              const slotMinutes = parseSlotToMinutes(slot);
              return Number.isFinite(slotMinutes) && slotMinutes <= thresholdMinutes && thresholdMinutes < slotMinutes + 60;
            }) || null
        : null;

      const isBookedNow =
        isTodaySchedule &&
        fieldEvents.some((event) => event.startMinutes <= thresholdMinutes && thresholdMinutes < event.endMinutes);
      const isAvailableNow = !isFieldClosed && Boolean(currentSlot) && !isBookedNow;

      const futureSlots = TIME_SLOTS.filter((slot) => {
        const slotMinutes = parseSlotToMinutes(slot);
        return Number.isFinite(slotMinutes) && slotMinutes > thresholdMinutes;
      });

      const openSlots = isFieldClosed ? [] : futureSlots.filter((slot) => {
        const slotMinutes = parseSlotToMinutes(slot);
        return !fieldEvents.some(
          (event) => event.startMinutes <= slotMinutes && slotMinutes < event.endMinutes
        );
      });

      const nextAvailableTime = openSlots[0] || null;
      const nextLabel = isAvailableNow
        ? t('landing_available_now', 'Available now')
        : isFieldClosed
        ? t('landing_closed', 'Closed')
        : nextAvailableTime
        ? `${isTodaySchedule ? t('league_today', 'Today') : dayLabel} ${formatSlotTo12h(nextAvailableTime)}`
        : `${isTodaySchedule ? t('league_today', 'Today') : dayLabel} ${t('landing_fully_booked', 'Fully booked')}`;
      const openSlotCount = openSlots.length + (isAvailableNow ? 1 : 0);

      return {
        id: field.id,
        name: buildAvailabilityCardTitle(field, index),
        location: field.address || field.city || t('landing_sports_complex', 'Sports complex'),
        fieldType: field.fieldType || '11v11',
        surfaceType: String(field.surfaceType || t('landing_artificial_turf', 'artificial_turf')).replace('_', ' '),
        pricePerHour: Number(field.pricePerHour || 0),
        nextTime: nextAvailableTime,
        nextLabel,
        slotsLeft: openSlotCount,
        isAvailableNow,
        isFullyBooked: !isFieldClosed && !isAvailableNow && !nextAvailableTime
      };
    });
  }, [isFieldAvailable, scheduleDays, scheduleEvents, scheduleFields, selectedDay, t]);

  // Get day index for the current view.
  const getDayIndex = (dayKey) => scheduleDays.findIndex((day) => day.key === dayKey);

  // Support to field route for this page.
  const toFieldRoute = (field) => {
    if (!field) return '/fields';
    return `/fields/${field.id}`;
  };

  // Handle prev day interactions.
  const handlePrevDay = () => {
    const currentIndex = getDayIndex(selectedDay);
    const nextIndex = currentIndex <= 0 ? scheduleDays.length - 1 : currentIndex - 1;
    setSelectedDay(scheduleDays[nextIndex].key);
  };

  // Handle next day interactions.
  const handleNextDay = () => {
    const currentIndex = getDayIndex(selectedDay);
    const nextIndex = currentIndex >= scheduleDays.length - 1 ? 0 : currentIndex + 1;
    setSelectedDay(scheduleDays[nextIndex].key);
  };

  // Handle open field from schedule interactions.
  const handleOpenFieldFromSchedule = (field) => {
    navigate(toFieldRoute(field));
  };

  // Build booking path for rendering.
  const buildBookingPath = (field, day = null, time = null) => {
    const params = new URLSearchParams({ fieldId: String(field.id) });
    if (day) params.set('day', day);
    if (time) params.set('time', time);
    return `/app/bookings/new?${params.toString()}`;
  };

  // Handle book now interactions.
  const handleBookNow = (field, day = null, time = null) => {
    if (!field) {
      navigate('/fields');
      return;
    }

    const bookingPath = buildBookingPath(field, day, time);

    if (!isAuthenticated) {
      navigate('/login', { state: { from: bookingPath, backgroundLocation: location } });
      return;
    }

    if (!canCreateBooking) {
      navigate('/app/settings', {
        state: { focusRoleRequest: 'captain' }
      });
      return;
    }

    if (!isFieldAvailable(field, day || selectedDay)) {
      navigate(toFieldRoute(field));
      return;
    }

    navigate(bookingPath);
  };

  // Handle time slot click interactions.
  const handleTimeSlotClick = (field, slot) => {
    handleBookNow(field, selectedDay, slot);
  };

  // Support slot tone class for this page.
  const slotToneClass = (tone) => {
    if (tone === 'limited') return 'border-red-300 bg-red-50 text-red-600';
    if (tone === 'available') return 'border-emerald-300 bg-emerald-50 text-emerald-600';
    if (tone === 'moderate') return 'border-amber-300 bg-amber-50 text-amber-600';
    return 'border-blue-300 bg-blue-50 text-blue-600';
  };

  // Handle claim offer interactions.
  const handleClaimOffer = (offer, preferredTime = '18:00') => {
    const day = quickDate || selectedDay || toLocalDateKey(new Date());
    const requestedFieldId = typeof offer === 'object' ? offer?.field?.id || offer?.id : null;
    const preferredField =
      scheduleFields.find((f) => Number(f?.id) === Number(requestedFieldId)) ||
      landingFields.find((f) => Number(f?.id) === Number(requestedFieldId)) ||
      scheduleFields[0];

    if (preferredField) {
      handleBookNow(preferredField, day, preferredTime);
      return;
    }

    const params = new URLSearchParams({
      focus: 'search',
      promo: typeof offer === 'object' ? offer?.code || `FIELD-${offer?.id || ''}` : offer,
      day,
      time: preferredTime
    });
    navigate(`/fields?${params.toString()}`);
  };

  const handleHeroSearchSubmit = (event) => {
    event.preventDefault();

    const params = new URLSearchParams({ focus: 'search' });
    const trimmedSearchTerm = heroSearchTerm.trim();

    if (trimmedSearchTerm) {
      params.set('q', trimmedSearchTerm);
    }

    if (heroSearchType === 'field') {
      navigate(`/fields?${params.toString()}`);
      return;
    }

    params.set('type', heroSearchType);
    navigate(`/teams?${params.toString()}`);
  };
  return (
    <div className="flex flex-col gap-14 bg-gradient-to-b from-emerald-50/70 via-white to-sky-50/40">
      <section className="order-1 relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen min-h-[640px] overflow-hidden text-white shadow-sm ring-1 ring-black/10">
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="flex h-full w-full transition-transform duration-700 ease-in-out"
            style={{
              width: `${HERO_IMAGES.length * 100}%`,
              transform: `translateX(-${heroIndex * (100 / HERO_IMAGES.length)}%)`
            }}
          >
            {HERO_IMAGES.map((image, index) => (
              <img
                key={`${image}-${index}`}
                src={image}
                alt={`Football stadium background ${index + 1}`}
                className="h-full w-full flex-shrink-0 object-cover object-center"
                style={{ width: `${100 / HERO_IMAGES.length}%` }}
                onError={(e) => {
                  if (e.currentTarget.dataset.fallbackApplied !== 'true') {
                    e.currentTarget.dataset.fallbackApplied = 'true';
                    e.currentTarget.src = HERO_IMAGES[0];
                  }
                }}
              />
            ))}
          </div>
        </div>
        <div className="absolute -left-16 top-20 h-48 w-48 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="absolute -right-20 bottom-10 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.24),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(34,211,238,0.22),_transparent_24%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/30 via-slate-950/55 to-slate-950/80" />
        <div className="relative mx-auto flex min-h-[640px] max-w-7xl items-center px-6 py-16 sm:px-10 sm:py-20 lg:px-16">
          <div className="grid w-full items-center gap-10">
            <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-emerald-200 backdrop-blur-sm">
                <SparklesIcon className="h-4 w-4" />
                {t('landing_hero_badge', 'One search for players, captains, and fields')}
              </span>
              <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
                {t('landing_hero_title', 'Find your favorite players, captains, and fields.')}
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-8 text-white/85 sm:text-xl">
                {t(
                  'landing_hero_description',
                  'Search public teams, trusted captains, and available football fields before you book or request to join.'
                )}
              </p>
              <div className="mt-8 w-full max-w-3xl">
                <div className="mb-4 flex flex-wrap items-center justify-center gap-3">
                  {HERO_SEARCH_OPTIONS.map((option) => {
                    const isActive = heroSearchType === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setHeroSearchType(option.value)}
                        className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                          isActive
                            ? 'bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/25'
                            : 'border border-white/20 bg-white/10 text-white/85 hover:bg-white/20'
                        }`}
                      >
                        {t(option.labelKey, option.fallback)}
                      </button>
                    );
                  })}
                </div>

                <form
                  onSubmit={handleHeroSearchSubmit}
                  className="overflow-hidden rounded-[2rem] border border-white/20 bg-white shadow-2xl shadow-slate-950/30"
                >
                  <div className="flex flex-col sm:flex-row">
                    <input
                      type="search"
                      value={heroSearchTerm}
                      onChange={(event) => setHeroSearchTerm(event.target.value)}
                      placeholder={getHeroSearchPlaceholder(heroSearchType, t)}
                      className="h-16 w-full flex-1 border-0 bg-white px-6 text-base font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none sm:text-lg"
                    />
                    <button
                      type="submit"
                      className="flex h-16 items-center justify-center gap-2 bg-emerald-500 px-8 text-base font-bold text-white transition hover:bg-emerald-600 sm:min-w-[180px] sm:text-lg"
                    >
                      <MagnifyingGlassIcon className="h-5 w-5" />
                      {t('landing_hero_search_button', 'Search')}
                    </button>
                  </div>
                </form>

                <p className="mt-4 text-sm font-medium text-white/80 sm:text-base">
                  {t('landing_hero_search_hint', 'Start with a quick search, then jump straight to live fields or public teams.')}
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-5 text-sm font-semibold text-white">
                  <button
                    type="button"
                    onClick={() => navigate('/fields')}
                    className="underline decoration-white/60 underline-offset-4 transition hover:text-emerald-200"
                  >
                    {t('landing_hero_browse_fields', 'Browse live fields')}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/teams')}
                    className="underline decoration-white/60 underline-offset-4 transition hover:text-emerald-200"
                  >
                    {t('landing_hero_browse_teams', 'Explore teams, captains, and players')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-6 z-10">
          <div className="mx-auto flex w-fit items-center gap-1.5 rounded-full border border-white/20 bg-black/20 px-1.5 py-1 backdrop-blur-md">
            <button
              type="button"
              aria-label="Previous hero image"
              onClick={() => setHeroIndex((prev) => (prev - 1 + HERO_IMAGES.length) % HERO_IMAGES.length)}
              className="rounded-full border border-white/35 bg-white/10 p-1 text-white transition hover:bg-white/20"
            >
              <ChevronLeftIcon className="h-3 w-3" />
            </button>
            <div className="flex items-center gap-1">
              {HERO_IMAGES.map((_, index) => (
                <button
                  key={`hero-dot-${index}`}
                  type="button"
                  aria-label={`Go to hero image ${index + 1}`}
                  onClick={() => setHeroIndex(index)}
                  className={`h-1.5 rounded-full transition-all ${
                    heroIndex === index ? 'w-5 bg-emerald-400' : 'w-1.5 bg-white/70 hover:bg-white'
                  }`}
                />
              ))}
            </div>
            <button
              type="button"
              aria-label="Next hero image"
              onClick={() => setHeroIndex((prev) => (prev + 1) % HERO_IMAGES.length)}
              className="rounded-full border border-white/35 bg-white/10 p-1 text-white transition hover:bg-white/20"
            >
              <ChevronRightIcon className="h-3 w-3" />
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <section className="order-5 relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen bg-gradient-to-b from-white to-emerald-50/60 py-14">
        <ScrollReveal as="div" className="mx-auto max-w-7xl px-6 sm:px-10 lg:px-16">
          <div className="text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-1.5 text-sm font-semibold text-emerald-700">
              <ArrowTrendingUpIcon className="h-4 w-4" />
              {t('landing_popular_sessions_badge', 'Popular play times')}
            </span>
            <h2 className="mt-4 text-2xl font-bold text-slate-900">{t('landing_popular_sessions_title', 'Popular sessions')}</h2>
            <p className="mt-2 text-base text-slate-600">
              {t('landing_popular_sessions_subtitle', 'See which part of the day is busiest and choose the session that suits your team.')}
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
            {popularTimeSlots.map((slot) => (
              <div key={slot.key} className="group relative overflow-hidden rounded-[1.75rem] border border-emerald-100/80 bg-white/95 p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-emerald-100/70 blur-2xl transition group-hover:bg-emerald-200/80" />
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900">
                      {slot.key === 'morning'
                        ? t('landing_session_morning', 'Morning session')
                        : slot.key === 'afternoon'
                        ? t('landing_session_afternoon', 'Afternoon session')
                        : t('landing_session_evening', 'Evening session')}
                    </h3>
                    <div className="mt-3 flex items-center gap-2 text-base font-medium text-slate-500">
                      <ClockIcon className="h-5 w-5 text-emerald-600" />
                      <span>{slot.time}</span>
                    </div>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${slotToneClass(slot.tone)}`}>
                    {slot.status === 'High Demand'
                      ? t('landing_status_high_demand', 'High demand')
                      : slot.status === 'Popular'
                      ? t('landing_status_popular', 'Popular')
                      : slot.status === 'Steady'
                      ? t('landing_status_steady', 'Steady')
                      : t('landing_status_open', 'Open')}
                  </span>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-600">
                  {slot.key === 'morning'
                    ? t('landing_session_morning_desc', 'Cooler hours for teams that want an early start.')
                    : slot.key === 'afternoon'
                    ? t('landing_session_afternoon_desc', 'Balanced daytime and after-work demand for flexible match schedules.')
                    : t('landing_session_evening_desc', 'Prime-time hours for busy matches under the lights.')}
                </p>

                <div className="mt-6 flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <StarIcon
                      key={`${slot.key}-star-${index}`}
                      className={`h-5 w-5 ${index < slot.stars ? 'text-amber-400' : 'text-slate-200'}`}
                    />
                  ))}
                  <span className="ml-2 text-sm font-semibold text-slate-700">{slot.rating}/5</span>
                </div>
              </div>
            ))}
          </div>

        </ScrollReveal>
      </section>

      <section className="order-7 relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen bg-gradient-to-b from-emerald-50/40 to-white py-16">
        <ScrollReveal as="div" className="mx-auto max-w-7xl px-6 sm:px-10 lg:px-16" delay={40}>
          <div className="text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-1.5 text-sm font-semibold text-emerald-700">
              <TrophyIcon className="h-4 w-4" />
              Live Field Discounts
            </span>
            <h2 className="mt-4 text-2xl font-bold text-slate-900">{t('landing_discounts_title', 'Special Deals & Discounts')}</h2>
            <p className="mt-2 text-base text-slate-600">{t('landing_discounts_subtitle', 'Real discounts from field owners, updated from the current fields on the platform.')}</p>
          </div>

          <div className="mt-8 rounded-2xl border border-emerald-300 bg-gradient-to-r from-emerald-700 via-green-600 to-emerald-500 p-6 text-white shadow-lg">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-4xl font-extrabold">
                  {featuredDiscountOffer
                    ? t('landing_discount_headline', '{{discount}} at {{field}}', {
                        discount: featuredDiscountOffer.discountLabel,
                        field: featuredDiscountOffer.field.name
                      })
                    : t('landing_discounts_coming_soon', 'Discounts Coming Soon')}
                </h3>
                <p className="mt-2 text-base text-emerald-50">
                  {featuredDiscountOffer
                    ? `${featuredDiscountOffer.description} ${t('landing_discount_summary_suffix', 'Book now before discounted slots fill up.')}`
                    : t('landing_discounts_empty_description', 'Field owners can add discounts and they will appear here automatically.')}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-sm font-semibold">
                  <span className="rounded-full bg-white/20 px-3 py-1">
                    {featuredDiscountOffer ? `$${getDiscountedFieldPrice(featuredDiscountOffer.field).toFixed(2)}/hr` : t('landing_no_live_offers', 'No live offers')}
                  </span>
                  <span className="rounded-full bg-white/20 px-3 py-1">
                    {featuredDiscountOffer
                      ? `${t('landing_original_price', 'Original Price')} $${Number(featuredDiscountOffer.field.pricePerHour || 0).toFixed(2)}/hr`
                      : t('landing_check_back_later', 'Check back later')}
                  </span>
                  <span className="rounded-full bg-white/20 px-3 py-1">
                    {featuredDiscountOffer
                      ? `${featuredDiscountOffer.field.city || featuredDiscountOffer.field.province || t('landing_featured_city', 'Featured city')}`
                      : t('landing_check_back_later', 'Check back later')}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => featuredDiscountOffer && handleClaimOffer(featuredDiscountOffer, featuredDiscountOffer.time)}
                disabled={!featuredDiscountOffer}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
              >
                {featuredDiscountOffer ? t('landing_book_this_discount', 'Book This Discount') : t('landing_no_offer_yet', 'No Offer Yet')}
              </button>
            </div>
          </div>

          <div className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            {discountOffers.length > 0 ? discountOffers.map((offer) => (
              <div key={offer.id} className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                <div className="flex items-start justify-between gap-3">
                  <div className="rounded-2xl bg-emerald-100 p-3">
                    <offer.icon className="h-6 w-6 text-emerald-700" />
                  </div>
                  <span className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white">{offer.discountLabel}</span>
                </div>

                <h3 className="mt-4 text-2xl font-bold text-slate-900">{offer.title}</h3>
                <p className="mt-2 text-base text-slate-600">{offer.description}</p>

                <div className="mt-4 flex items-center justify-between text-xs">
                  <span className="text-slate-500">{t('landing_discount_field_label', 'Field:')}</span>
                  <span className="font-semibold text-slate-800">{offer.field.name}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-slate-500">{t('landing_discount_location_label', 'Location:')}</span>
                  <span className="font-semibold text-slate-800">{offer.cityLabel}</span>
                </div>
                <div className="mt-3 rounded-xl border border-dashed border-emerald-300 bg-emerald-50 px-3 py-2">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>{t('landing_original_price', 'Original Price')}</span>
                    <span className="font-semibold text-slate-800">${Number(offer.field.pricePerHour || 0).toFixed(2)}/hr</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
                    <span>{t('landing_discounted_price', 'Discounted Price')}</span>
                    <span className="font-bold text-emerald-700">${getDiscountedFieldPrice(offer.field).toFixed(2)}/hr</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleClaimOffer(offer, offer.time)}
                  className="mt-4 w-full rounded-xl bg-emerald-600 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  {t('landing_book_discounted_field', 'Book Discounted Field')}
                </button>
              </div>
            )) : (
              <div className="col-span-full rounded-2xl border border-dashed border-emerald-200 bg-white px-6 py-10 text-center text-slate-600">
                {t('landing_no_active_discounts', 'No field discounts are active yet. When owners add discounts, this section will update automatically.')}
              </div>
            )}
          </div>

        </ScrollReveal>
      </section>

      <section className="order-6 relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen bg-gradient-to-b from-white to-sky-50/50 py-14">
        <ScrollReveal as="div" className="mx-auto max-w-7xl px-6 sm:px-10 lg:px-16" delay={60}>
          <div className="text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-1.5 text-base font-semibold text-emerald-700">
              <BoltIcon className="h-4 w-4" />
              {t('landing_live_fields_badge', 'Live field list')}
            </span>
            <h2 className="mt-4 text-2xl font-bold text-slate-900">{t('landing_live_fields_title', 'Fields you can book today')}</h2>
            <p className="mt-2 text-base text-slate-600">
              {t('landing_live_fields_subtitle', 'Browse live football field options with pricing, location, and open booking times.')}
            </p>
          </div>

            <div className="mx-auto mt-8 grid max-w-7xl grid-cols-1 gap-5 lg:grid-cols-2">
            {availableNowCards.length > 0 ? (
                availableNowCards.map((field, index) => (
                  <div
                    key={`live-${field.id}-${index}`}
                    className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.06)] transition hover:-translate-y-1 hover:shadow-[0_22px_48px_rgba(15,23,42,0.09)]"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                            {t('landing_live_availability', 'Live availability')}
                          </span>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              field.isFullyBooked
                                ? 'bg-red-100 text-red-700'
                                : field.isAvailableNow
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {field.isFullyBooked
                              ? t('landing_no_slots_left', 'No slots left')
                              : field.isAvailableNow
                                ? t('landing_available_now', 'Available now')
                                : t('landing_slots_left', '{{count}} slots left', { count: field.slotsLeft })}
                          </span>
                        </div>
                        <h3 className="mt-5 text-[1.25rem] font-black leading-[1.15] tracking-tight text-slate-950 break-words sm:text-[1.45rem]">
                          {field.name}
                        </h3>
                        <p className="mt-2 flex items-start gap-2 text-sm leading-5 text-slate-500">
                          <MapPinIcon className="mt-0.5 h-4 w-4 flex-none" />
                          <span>{field.location}</span>
                        </p>
                      </div>

                      <div className="w-fit rounded-2xl bg-emerald-50 px-4 py-3 text-right sm:min-w-[120px]">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          {t('landing_price_label', 'Price')}
                        </p>
                        <div className="mt-1 whitespace-nowrap text-[1.7rem] font-black leading-none text-emerald-600 sm:text-[1.9rem]">
                          ${field.pricePerHour}
                          <span className="text-sm font-bold text-emerald-700 sm:text-base">/{t('field_per_hour_short', 'hr')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 grid grid-cols-1 gap-4 rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-5 sm:grid-cols-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          {t('landing_field_size', 'Field size')}
                        </p>
                        <div className="mt-2 flex items-center gap-2 text-base font-bold text-slate-900 sm:text-lg">
                          <UsersIcon className="h-5 w-5 text-blue-600" />
                          <span>{field.fieldType}</span>
                        </div>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          {t('landing_surface_type', 'Surface type')}
                        </p>
                        <div className="mt-2 break-words text-base font-bold text-slate-900 sm:text-lg">{field.surfaceType}</div>
                      </div>
                    </div>

                    <div className="mt-6 border-t border-slate-200 pt-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                            {t('landing_next_available_label', 'Next available')}
                          </p>
                          <p
                            className={`mt-2 break-words text-[1.1rem] font-black leading-tight sm:text-[1.3rem] ${
                              field.isFullyBooked
                                ? 'text-red-600'
                                : field.isAvailableNow
                                  ? 'text-emerald-600'
                                  : 'text-amber-600'
                            }`}
                          >
                            {field.nextLabel}
                          </p>
                        </div>
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold ${
                            field.isFullyBooked || field.slotsLeft <= 1 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {t('landing_slots_left', '{{count}} slots left', { count: field.slotsLeft })}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={!field.nextTime}
                      onClick={() => field.nextTime && handleBookNow(field, quickDate || selectedDay, field.nextTime)}
                      className={`mt-6 inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm transition ${
                        field.nextTime
                          ? 'bg-[#1fb455] hover:bg-[#18984a]'
                          : 'cursor-not-allowed border border-slate-600 bg-slate-700 text-slate-300 shadow-none'
                      }`}
                    >
                      {field.nextTime
                        ? isAuthenticated && !canCreateBooking
                          ? t('booking_request_captain', 'Request Captain Access')
                          : t('landing_quick_book', 'Book Now')
                        : t('landing_sold_out', 'Sold out')}
                    </button>
                  </div>
              ))
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white px-5 py-6 text-center text-sm text-slate-600 shadow-sm">
                {scheduleLoading
                  ? t('landing_loading_live_availability', 'Loading live availability...')
                  : t('landing_no_live_availability', 'No live availability data for the selected day.')}
              </div>
            )}
          </div>

          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={() => navigate('/fields?focus=search')}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-base font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
            >
              {t('landing_view_all_fields', 'View all available fields')}
              <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white">{t('landing_more_count', '24 more')}</span>
            </button>
          </div>
        </ScrollReveal>
      </section>

      {/* Live Booking Schedule - Only visible to authenticated users */}
      {isAuthenticated && (
        <>
        <section ref={scheduleSectionRef} className="order-4 p-6 sm:p-8">
          <ScrollReveal as="div" delay={80}>
            <div className="text-center">
              <h2 className="text-2xl font-bold text-slate-900">{t('landing_schedule_title', 'Live booking schedule')}</h2>
              <p className="mt-2 text-base text-slate-600">
                {t('landing_schedule_subtitle', 'See every field booking time at a glance to know who is playing when.')}
              </p>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <button type="button" onClick={handlePrevDay} className="rounded-xl p-2 text-slate-500 hover:bg-white">
                  <ChevronLeftIcon className="h-5 w-5" />
                </button>
                <div className="flex flex-wrap gap-2">
                  {scheduleDays.map((day) => (
                    <button
                      key={day.key}
                      type="button"
                      onClick={() => setSelectedDay(day.key)}
                      className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                        selectedDay === day.key
                          ? 'border-slate-800 bg-white text-slate-900'
                          : 'border-slate-300 bg-slate-50 text-slate-700 hover:bg-white'
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={handleNextDay} className="rounded-xl p-2 text-slate-500 hover:bg-white">
                  <ChevronRightIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/app/bookings')}
                  className="rounded-xl bg-white px-5 py-3 text-center shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
                >
                  <div className="text-3xl font-bold text-emerald-600">{scheduleLoading ? '...' : scheduleEvents.length}</div>
                  <div className="text-base text-slate-600">{t('landing_total_bookings', 'Total bookings')}</div>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/fields')}
                  className="rounded-xl bg-white px-5 py-3 text-center shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
                >
                  <div className="text-3xl font-bold text-blue-600">{scheduleLoading ? '...' : activeScheduleFieldsCount}</div>
                  <div className="text-base text-slate-600">{t('landing_active_fields', 'Active fields')}</div>
                </button>
              </div>
            </div>

          <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <div style={{ minWidth: scheduleTableMinWidth }}>
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-700">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-semibold text-slate-800">{t('landing_color_guide', 'Color guide')}:</span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-3 w-3 rounded-sm bg-emerald-600" /> {t('landing_your_booking', 'Your booking')}
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-3 w-3 rounded-sm bg-red-600" /> {t('landing_other_team_booked', 'Other team (booked)')}
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-3 w-3 rounded-sm bg-amber-500" /> {t('landing_pending_bookable', 'Pending (still bookable)')}
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-3 w-3 rounded-sm bg-rose-600" /> {t('landing_field_closed', 'Field closed')}
                </span>
              </div>
            </div>
              <div className="flex border-b border-slate-200 bg-blue-600 text-white">
               <div className={`sticky left-0 z-10 ${SCHEDULE_TIME_COLUMN_WIDTH_CLASS} whitespace-nowrap border-r border-white/20 bg-blue-700 p-4 font-semibold`}>
                  {t('landing_time_field', 'Time / Field')}
                </div>
               <div
                className="grid flex-1"
                style={{ gridTemplateColumns: `repeat(${scheduleFields.length}, minmax(${SCHEDULE_COLUMN_MIN_WIDTH}px, 1fr))` }}
              >
                {scheduleFields.map((field) => (
                  <button
                    key={field.id}
                    type="button"
                    onClick={() => handleOpenFieldFromSchedule(field)}
                    className={`flex min-h-[86px] flex-col items-center justify-center border-l px-3 py-3 text-center text-sm font-semibold ${
                      isFieldAvailable(field, selectedDay)
                        ? 'border-white/20 hover:bg-white/10'
                        : 'border-rose-200/40 bg-rose-600/85'
                    }`}
                  >
                    <div className="max-w-[180px] text-balance text-base font-semibold leading-tight">{field.name}</div>
                    <div className="mt-1 text-xs font-medium opacity-90">
                      {isFieldAvailable(field, selectedDay) ? field.fieldType || t('landing_outdoor', 'Outdoor') : t('landing_closed', 'Closed')}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {TIME_SLOTS.map((slot) => {
              const slotEventsForAllFields = findEventsForSlot(scheduleEvents, slot);
              return (
                <div key={slot} className="flex border-b border-slate-200 last:border-b-0">
                  <div
                    className={`sticky left-0 z-[1] ${SCHEDULE_TIME_COLUMN_WIDTH_CLASS} flex items-center justify-center border-r border-slate-200 bg-white p-2.5 text-center font-semibold text-slate-900 ${SCHEDULE_ROW_HEIGHT_CLASS}`}
                  >
                    <div className="text-sm leading-tight">{slot}</div>
                  </div>
                  <div className="relative flex-1">
                    <div
                      className={`grid ${SCHEDULE_ROW_HEIGHT_CLASS}`}
                      style={{ gridTemplateColumns: `repeat(${scheduleFields.length}, minmax(${SCHEDULE_COLUMN_MIN_WIDTH}px, 1fr))` }}
                    >
                      {scheduleFields.map((field) => {
                        const rowEvents = slotEventsForAllFields.filter((event) => Number(event.fieldKey) === Number(field.id));
                        const slotOwnEvent = rowEvents.find((event) => event.isOwnBooking);
                        const slotOtherConfirmedEvent = rowEvents.find(
                          (event) => !event.isOwnBooking && event.status === 'confirmed'
                        );
                        const slotOtherPendingEvent = rowEvents.find(
                          (event) => !event.isOwnBooking && event.status === 'pending'
                        );
                        const slotTakenByOther = Boolean(slotOtherConfirmedEvent);
                        const slotTakenByMe = Boolean(slotOwnEvent);
                        const slotHasOtherPending = Boolean(slotOtherPendingEvent);
                        const isFieldClosed = !isFieldAvailable(field, selectedDay);

                        // If there's a booking, show a colored block
                        if (slotTakenByMe || slotTakenByOther || slotHasOtherPending) {
                          return (
                            <div
                              key={`${field.id}-${slot}`}
                              className={`m-1 rounded-lg px-2 py-1 text-xs font-medium text-white cursor-pointer transition-colors ${
                                slotTakenByMe
                                  ? 'bg-emerald-600 hover:bg-emerald-700'
                                  : slotTakenByOther
                                  ? 'bg-red-600 hover:bg-red-700'
                                  : 'bg-amber-500 hover:bg-amber-600'
                              }`}
                              onClick={() => slotTakenByMe ? navigate('/app/bookings') : handleOpenFieldFromSchedule(field)}
                              title={slotTakenByMe
                                ? t('landing_your_booking_track', 'Your booking - click to track')
                                : slotTakenByOther
                                ? `${slotOtherConfirmedEvent.team} - ${t('landing_click_to_view_field', 'Click to view field')}`
                                : `${slotOtherPendingEvent.team} - ${t('landing_pending_request', 'Pending request')}`
                              }
                            >
                              <div className="truncate font-bold">
                                {slotTakenByMe ? slotOwnEvent.team : 
                                 slotTakenByOther ? slotOtherConfirmedEvent.team : 
                                 slotOtherPendingEvent.team}
                              </div>
                              <div className="text-xs opacity-90">
                                {slotTakenByMe ? slotOwnEvent.start + ' - ' + slotOwnEvent.end : 
                                 slotTakenByOther ? slotOtherConfirmedEvent.start + ' - ' + slotOtherConfirmedEvent.end : 
                                 slotOtherPendingEvent.start + ' - ' + slotOtherPendingEvent.end}
                              </div>
                            </div>
                          );
                        }

                        // Closed fields should always show closed cells for empty slots.
                        if (isFieldClosed) {
                          const closureTitle = getFieldClosureTitle(field, t);
                          const closureReason = getFieldClosureReason(field, t);
                          const closureReopenLabel = getFieldClosureReopenLabel(field, t);
                          return (
                            <div
                              key={`${field.id}-${slot}`}
                              className="m-1 flex h-[56px] min-w-0 flex-col justify-center rounded-xl border border-rose-200/80 bg-gradient-to-br from-rose-50 via-white to-rose-100 px-3 py-2 text-left shadow-sm"
                              title={`${closureTitle}: ${closureReason}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex min-w-0 items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-500">
                                  <span className="h-2 w-2 rounded-full bg-rose-500" />
                                  <span className="truncate">{closureTitle}</span>
                                </div>
                                {closureReopenLabel ? (
                                  <span className="shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                                    {closureReopenLabel}
                                  </span>
                                ) : null}
                              </div>
                              <div className="mt-1 line-clamp-2 text-xs font-medium leading-4 text-slate-900">
                                <span className="font-semibold text-rose-700">{t('landing_reason', 'Reason')}:</span> {closureReason}
                              </div>
                            </div>
                          );
                        }

                        // If no booking, show empty cell
                        return (
                          <div
                            key={`${field.id}-${slot}`}
                            className="m-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer transition-colors"
                            onClick={() => handleTimeSlotClick(field, slot)}
                            title={t('field_available_slot', 'Available - click to book')}
                          >
                            {/* Empty cell - just shows the time slot background */}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        </ScrollReveal>
        </section>
        </>
      )}

      <section className="order-3 relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen bg-gradient-to-b from-white to-emerald-50/40 py-10">
        <ScrollReveal as="div" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" delay={100}>
          <div className="mb-10 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-1.5 text-sm font-semibold text-emerald-700">
            <BuildingOfficeIcon className="h-4 w-4" />
            {t('landing_featured_badge', 'Featured picks')}
          </span>
          <h2 className="mt-4 text-3xl font-black text-gray-900">{t('landing_featured_title', 'Featured football fields')}</h2>
          <p className="mt-2 text-base text-gray-600">
            {t('landing_featured_subtitle', 'Choose from highly rated football fields and see how other players review each one.')}
          </p>
          </div>

          {loading ? (
            <div className="flex h-24 items-center justify-center">
              <Spinner className="h-6 w-6" />
            </div>
          ) : featuredFields.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {featuredFields.map((field, index) => {
              const isAvailable = (field.status || 'available') === 'available';
              const players = field.capacity || 22;
              const duration = field.sessionDuration || 90;
              const price = Number(field.pricePerHour || 0);
              const rating = Math.max(0, Math.min(5, Number(field.rating || 0)));
              const totalRatings = Number(field.totalRatings || 0);
              const preferredImage = FEATURED_CARD_IMAGES[index % FEATURED_CARD_IMAGES.length];
              const initialImage = resolveFieldImage(field.images) || preferredImage;

              return (
                <Link
                  key={field.id}
                  to={`/fields/${field.id}`}
                  className="group overflow-hidden rounded-[1.9rem] bg-white ring-1 ring-emerald-100 transition hover:-translate-y-1 hover:shadow-2xl"
                >
                  <div className="relative h-56 overflow-hidden bg-gray-200">
                    <img
                      src={initialImage}
                      alt={field.name}
                      className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = preferredImage || FIELD_FALLBACK_IMAGE;
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/65 via-slate-950/10 to-transparent opacity-80" />
                    <div className="absolute left-4 top-4 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                      {field.fieldType || '11v11'}
                    </div>
                    <span
                      className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        isAvailable ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                      }`}
                    >
                      {isAvailable ? t('field_available', 'Available') : t('field_booked', 'Booked')}
                    </span>
                    <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                      <div className="text-2xl font-black">{field.name}</div>
                      <div className="mt-1 flex items-center gap-2 text-sm text-white/85">
                        <MapPinIcon className="h-4 w-4" />
                        <span>{field.city || field.address || 'City Stadium Arena'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 p-6">

                    <div className="flex items-center justify-between text-base text-gray-700">
                      <div className="flex items-center gap-2">
                        <UsersIcon className="h-5 w-5" />
                        <span>{t('players_suffix', '{{count}} players', { count: players })}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ClockIcon className="h-5 w-5" />
                        <span>{duration} {t('landing_minute_unit', 'min')}</span>
                      </div>
                    </div>

                    <p className="flex flex-wrap items-center gap-1 text-sm leading-6 text-slate-600">
                      {Array.from({ length: 5 }).map((_, starIndex) => (
                        <StarIcon
                          key={`${field.id}-rating-${starIndex}`}
                          className={`h-4 w-4 ${starIndex < Math.round(rating) ? 'text-amber-400' : 'text-slate-200'}`}
                        />
                      ))}
                      <span className="ml-2 font-semibold text-slate-800">
                        {rating > 0 ? rating.toFixed(1) : t('landing_rating_new', 'New')}
                      </span>
                      <span className="text-slate-500">
                        {totalRatings > 0
                          ? `(${t('landing_ratings_count', '{{count}} ratings', { count: totalRatings })})`
                          : `(${t('fields_no_rating_yet', 'No ratings yet')})`}
                      </span>
                    </p>

                    <div className="flex items-end justify-between gap-4">
                      <div className="text-4xl font-bold leading-none text-green-600">
                      ${Number.isFinite(price) ? price.toFixed(0) : 0}
                      <span className="ml-1 text-xl font-semibold text-green-700">/{t('landing_session_unit', 'session')}</span>
                      </div>
                      <p className="text-right text-sm leading-5 text-slate-600">
                        <span className="font-semibold text-slate-700">{t('landing_best_for', 'Best for')}:</span>{' '}
                        <span className="font-semibold text-emerald-800">
                          {players >= 20
                            ? t('landing_full_squads', 'Full squads')
                            : t('landing_quick_matches', 'Quick matches')}
                        </span>
                      </p>
                    </div>

                    {isAvailable ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleBookNow(field);
                        }}
                        className="w-full rounded-xl bg-[#1dbf5f] py-2 text-base font-semibold text-white shadow-sm transition hover:bg-[#18aa52]"
                      >
                        {isAuthenticated && !canCreateBooking
                          ? t('booking_request_captain', 'Request captain access')
                          : t('action_book_now', 'Book now')}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="w-full cursor-not-allowed rounded-xl bg-emerald-500 py-2 text-base font-semibold text-white"
                      >
                        {t('landing_fully_booked', 'Fully booked')}
                      </button>
                    )}
                  </div>
                </Link>
              );
              })}
            </div>
          ) : (
            <EmptyState
              icon={BuildingOfficeIcon}
              title={t('owner_no_fields_title', 'No fields yet')}
              description={t('landing_no_fields_guest', 'When field owners add venues, they will appear here for guests.')}
              actionLabel={t('landing_browse_fields', 'Browse fields')}
              onAction={() => (window.location.href = '/fields')}
            />
          )}
        </ScrollReveal>
      </section>

      <section className="order-8 relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen bg-gradient-to-b from-sky-50/40 to-white py-10">
        <ScrollReveal as="div" className="mx-auto max-w-7xl px-6 sm:px-10" delay={120}>
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900">Why Choose Us</h2>
            <p className="mt-2 text-gray-600">We make football field booking simple, secure, and convenient.</p>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {whyChooseUs.map((item) => (
              <div
                key={item.title}
                className="group rounded-xl bg-white p-5 text-center ring-1 ring-emerald-100 transition hover:-translate-y-1 hover:shadow-lg active:scale-[0.99]"
              >
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 transition group-hover:bg-green-600 group-active:bg-green-600">
                  <item.icon className="h-6 w-6 text-green-700 transition group-hover:text-white group-active:text-white" />
                </div>
                <h3 className="mt-3 text-lg font-semibold text-gray-900">{item.title}</h3>
                <p className="mt-2 text-base text-gray-600">{item.description}</p>
              </div>
            ))}
          </div>
        </ScrollReveal>
      </section>

      <section className="order-9 rounded-3xl border border-emerald-100 bg-white/90 p-6 shadow-sm sm:p-8">
        <ScrollReveal as="div" delay={140}>
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900">How It Works</h2>
            <p className="mt-2 text-gray-600">Book your football field in four simple steps.</p>
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((step) => (
              <div key={step.id} className="rounded-xl border border-green-100 bg-white p-5 text-center transition hover:-translate-y-1 hover:shadow-lg">
                <div className="mx-auto relative mb-3 flex h-14 w-14 items-center justify-center rounded-full border-2 border-green-300 bg-green-50">
                  <step.icon className="h-7 w-7 text-green-700" />
                  <span className="absolute -right-2 -top-2 rounded-full bg-green-600 px-2 py-0.5 text-xs font-semibold text-white">
                    {step.id}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">{step.title}</h3>
                <p className="mt-2 text-base text-gray-600">{step.description}</p>
              </div>
            ))}
          </div>
        </ScrollReveal>
      </section>

      <section className="order-11 relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen bg-white py-16 sm:py-20">
        <ScrollReveal as="div" className="mx-auto max-w-7xl px-6 sm:px-10 lg:px-16" delay={160}>
          <div className="mx-auto mb-14 max-w-3xl text-center">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">World-Class Facilities</h2>
            <p className="mt-4 text-lg leading-8 text-slate-600">
              Every field comes equipped with premium amenities to enhance your playing experience
            </p>
          </div>
          
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {WORLD_CLASS_FACILITIES.map((facility) => {
              const IconComponent = facility.icon;
              return (
                <div
                  key={facility.title}
                  className={`flex min-h-[180px] flex-col items-center justify-center rounded-[24px] border bg-white px-6 py-8 text-center shadow-[0_10px_30px_rgba(148,163,184,0.10)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(148,163,184,0.16)] ${facility.accentColor}`}
                >
                  <div className={`mb-5 flex h-16 w-16 items-center justify-center rounded-2xl ${facility.iconBgColor}`}>
                    <IconComponent className={`h-8 w-8 ${facility.iconColor}`} />
                  </div>
                  <h3 className="text-2xl font-semibold tracking-tight text-slate-900">{facility.title}</h3>
                  <p className="mt-3 max-w-[220px] text-base leading-7 text-slate-500">{facility.description}</p>
                </div>
              );
            })}
          </div>
        </ScrollReveal>
      </section>

      <section
        id="account-upgrade"
        className="order-10 scroll-mt-24 py-6"
      >
        <ScrollReveal as="div" className="mx-auto max-w-5xl text-center" delay={180}>
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-1.5 text-sm font-semibold text-emerald-700 shadow-sm">
              <BoltIcon className="h-4 w-4" />
              Upgrade Your Account
            </span>
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">Grow From Player To Organizer Or Venue Owner</h2>
          </div>
        </ScrollReveal>

        <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
          {upgradePrograms.map((program) => {
            const plan = ROLE_UPGRADE_CONFIG[program.roleKey];

            return (
              <div
                key={program.roleKey}
                className="rounded-[28px] border border-slate-200 bg-white p-5 text-center shadow-[0_18px_42px_rgba(15,23,42,0.08)]"
              >
                <div className="inline-flex rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  {program.audience}
                </div>
                <h3 className="mt-3 text-[1.9rem] font-black tracking-tight text-slate-950">{plan.title}</h3>
                <p className="mx-auto mt-3 max-w-xl text-[13px] leading-6 text-slate-600">{plan.description}</p>

                <div className="mt-5">
                  <div className="text-[3rem] font-black leading-none text-[#0ea765]">
                    ${plan.feeUsd}
                    <span className="ml-1 text-xl font-semibold text-slate-700">/one-time</span>
                  </div>
                  <p className="mt-2 text-[12px] font-medium text-slate-500">Admin approval included</p>
                </div>

                <div className="mt-7 space-y-3 text-left">
                  {plan.benefits.map((benefit) => (
                    <div key={benefit} className="flex items-start gap-3 text-sm text-slate-700">
                      <span className="mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                        <CheckCircleIcon className="h-3.5 w-3.5" />
                      </span>
                      <span>{benefit}</span>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => handleUpgradeNow(program.roleKey)}
                  className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-[#1fb455] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#18984a]"
                >
                  Book Now
                </button>

                <button
                  type="button"
                  onClick={() => handleCallForDemo(program.roleKey)}
                  className="mt-3 inline-flex w-full items-center justify-center text-[11px] font-medium text-slate-500 transition hover:text-emerald-700"
                >
                  Need help? Call for Demo
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="order-12 relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen bg-gradient-to-b from-white to-emerald-50/50 py-8">
        <ScrollReveal as="div" className="mx-auto max-w-7xl px-6 sm:px-10 lg:px-16" delay={200}>
          <div className="rounded-2xl border border-emerald-200 bg-white px-6 py-8 text-center shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900">{t('landing_premium_experience_title', 'Premium Experience Guaranteed')}</h2>
            <p className="mx-auto mt-3 max-w-4xl text-base text-slate-600">
              {t(
                'landing_premium_experience_subtitle',
                'All our facilities are regularly maintained and sanitized. We ensure the highest standards of cleanliness and safety for all our customers. Every field is inspected daily and meets professional football standards.'
              )}
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              {PREMIUM_GUARANTEE_ITEMS.map((item) => (
                <span key={item.key} className={`rounded-md px-4 py-2 text-sm font-semibold ${item.className}`}>
                  {item.key === 'daily_maintenance'
                    ? t('landing_premium_daily_maintenance', 'Daily Maintenance')
                    : item.key === 'professional_standards'
                    ? t('landing_premium_professional_standards', 'Professional Standards')
                    : item.key === 'safety_certified'
                    ? t('landing_premium_safety_certified', 'Safety Certified')
                    : t('landing_premium_eco_friendly', 'Eco Friendly')}
                </span>
              ))}
            </div>
          </div>
        </ScrollReveal>
      </section>

      <footer className="order-last !mt-0 relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen bg-slate-950 text-slate-100">
        <div className="mx-auto max-w-7xl px-6 py-12 sm:px-10">
          <div className="grid grid-cols-1 gap-8 border-b border-white/10 pb-10 md:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <div className="inline-flex max-w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 shadow-[0_10px_30px_rgba(15,23,42,0.25)]">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 via-green-600 to-lime-500 text-sm font-black tracking-wide text-white shadow-[0_10px_24px_rgba(22,163,74,0.3)]">
                  FB
                </div>
                <div className="min-w-0">
                  <div className="khmer-brand-font text-base font-semibold leading-[1.2] text-white sm:text-xl">
                    {APP_CONFIG.brand.displayName}
                  </div>
                </div>
              </div>
              <p className="mt-5 max-w-sm text-base leading-7 text-slate-300">
                {t('landing_footer_about', 'A simple platform for discovering football venues, checking live availability, and booking the best session for your team.')}
              </p>
            </div>

            <div>
              <h3 className="text-lg font-bold text-white">{t('landing_quick_links', 'Quick Links')}</h3>
              <div className="mt-4 space-y-3 text-sm text-slate-300">
                <Link to="/fields" className="block transition hover:text-white">{t('nav_fields', 'Fields')}</Link>
                <Link to="/teams" className="block transition hover:text-white">{t('nav_teams', 'Teams')}</Link>
                <Link to="/register" className="block transition hover:text-white">{t('nav_register', 'Register')}</Link>
                <Link to="/login" className="block transition hover:text-white">{t('nav_login', 'Login')}</Link>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold text-white">{t('landing_booking_info', 'Booking Info')}</h3>
              <div className="mt-4 space-y-3 text-sm text-slate-300">
                <p>{t('landing_booking_info_1', 'Open daily for football sessions from 08:00 to 22:00.')}</p>
                <p>{t('landing_booking_info_2', 'Compare field ratings, prices, and available slots in one place.')}</p>
                <p>{t('landing_booking_info_3', 'Best for quick matches, team training, and full-squad games.')}</p>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold text-white">{t('landing_contact', 'Contact')}</h3>
              <div className="mt-4 space-y-4 text-sm text-slate-300">
                <div className="flex items-center gap-3">
                  <PhoneIcon className="h-4 w-4 text-emerald-300" />
                  <span>+855 12 345 678</span>
                </div>
                <div className="flex items-center gap-3">
                  <EnvelopeIcon className="h-4 w-4 text-emerald-300" />
                  <span>bookings@fieldbook.app</span>
                </div>
                <div className="flex items-center gap-3">
                  <MapPinIcon className="h-4 w-4 text-emerald-300" />
                  <span>{t('landing_contact_location', 'Phnom Penh, Cambodia')}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 pt-6 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <p>{t('landing_footer_bottom', 'Football Field Booking helps players and teams book football fields with less hassle.')}</p>
            <div className="flex items-center gap-3">
              <a href="https://facebook.com" target="_blank" rel="noreferrer" aria-label="Facebook" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-white transition hover:bg-white/10">
                <span className="text-base font-semibold leading-none">f</span>
              </a>
              <a href="https://x.com" target="_blank" rel="noreferrer" aria-label="Twitter" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-white transition hover:bg-white/10">
                <span className="text-base font-semibold leading-none">x</span>
              </a>
              <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-white transition hover:bg-white/10">
                <span className="text-base font-semibold leading-none">i</span>
              </a>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default LandingPage;





