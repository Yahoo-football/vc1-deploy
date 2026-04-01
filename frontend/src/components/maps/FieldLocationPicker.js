import React, { useEffect, useRef, useState } from 'react';
import { ChevronDownIcon, MagnifyingGlassIcon, MapPinIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { hasGoogleMapsApiKey, loadGoogleMaps } from './googleMapsLoader';
import { loadLeaflet } from './leafletLoader';

const DEFAULT_CENTER = { lat: 11.5564, lng: 104.9282 };
const DEFAULT_ZOOM = 12;
const MAP_THEME_OPTIONS = [
  { id: 'roadmap', label: 'Map' },
  { id: 'satellite', label: 'Satellite' },
  { id: 'terrain', label: 'Terrain' },
  { id: 'dark', label: 'Dark' }
];
const LEAFLET_THEME_CONFIG = {
  roadmap: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors'
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri'
  },
  terrain: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: 'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap'
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    options: {
      subdomains: 'abcd'
    }
  }
};
const GOOGLE_MAP_STYLES = {
  dark: [
    { elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#0f172a' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#cbd5e1' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#334155' }] },
    { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0ea5e9' }] }
  ]
};

// Support extract address component for this module.
const extractAddressComponent = (components, types) => {
  const match = components.find((component) => types.some((type) => component.types.includes(type)));
  return match?.long_name || '';
};

// Support reverse geocode with google for this module.
const reverseGeocodeWithGoogle = async (maps, latitude, longitude) => {
  const geocoder = new maps.Geocoder();
  const response = await geocoder.geocode({
    location: { lat: latitude, lng: longitude }
  });

  const result = Array.isArray(response.results) ? response.results[0] : null;
  if (!result) {
    throw new Error('Reverse geocoding failed.');
  }

  const components = Array.isArray(result.address_components) ? result.address_components : [];
  const city = extractAddressComponent(components, [
    'locality',
    'administrative_area_level_2',
    'postal_town',
    'sublocality_level_1'
  ]);

  return {
    latitude,
    longitude,
    address: result.formatted_address || '',
    city,
    province: extractAddressComponent(components, ['administrative_area_level_1']) || '',
    label: result.formatted_address || ''
  };
};

// Support reverse geocode with osm for this module.
const reverseGeocodeWithOsm = async (latitude, longitude) => {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('lat', String(latitude));
  url.searchParams.set('lon', String(longitude));

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error('Reverse geocoding failed.');
  }

  const data = await response.json();
  const address = data.address || {};
  const city =
    address.city ||
    address.town ||
    address.municipality ||
    address.county ||
    address.state_district ||
    '';

  return {
    latitude,
    longitude,
    address:
      data.display_name ||
      [address.road, address.suburb, city].filter(Boolean).join(', '),
    city,
    province: address.state || address.region || '',
    label: data.display_name || ''
  };
};

// Support geocode address with google for this module.
const geocodeAddressWithGoogle = async (maps, query) => {
  const geocoder = new maps.Geocoder();
  const response = await geocoder.geocode({ address: query });
  const result = Array.isArray(response.results) ? response.results[0] : null;

  if (!result?.geometry?.location) {
    throw new Error('Location search failed.');
  }

  const latitude = Number(result.geometry.location.lat().toFixed(8));
  const longitude = Number(result.geometry.location.lng().toFixed(8));
  return reverseGeocodeWithGoogle(maps, latitude, longitude);
};

// Support geocode address with osm for this module.
const geocodeAddressWithOsm = async (query) => {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('q', query);

  const response = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error('Location search failed.');
  }

  const results = await response.json();
  const match = Array.isArray(results) ? results[0] : null;

  if (!match?.lat || !match?.lon) {
    throw new Error('No matching location found.');
  }

  const latitude = Number(Number(match.lat).toFixed(8));
  const longitude = Number(Number(match.lon).toFixed(8));
  return reverseGeocodeWithOsm(latitude, longitude);
};

// Support field location picker for this module.
const FieldLocationPicker = ({ value, onChange }) => {
  const mapElementRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const tileLayerRef = useRef(null);
  const providerRef = useRef(hasGoogleMapsApiKey ? 'google' : 'leaflet');
  const mapsApiRef = useRef(null);
  const initialCoordinatesRef = useRef({
    latitude: value?.latitude,
    longitude: value?.longitude
  });
  const [mapError, setMapError] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [searchQuery, setSearchQuery] = useState(value?.address || '');
  const [mapTheme, setMapTheme] = useState('roadmap');
  const [mapThemeMenuOpen, setMapThemeMenuOpen] = useState(false);

  useEffect(() => {
    if (value?.address) {
      setSearchQuery(value.address);
    }
  }, [value?.address]);

  useEffect(() => {
    let active = true;

    // Support init map for this module.
    const initMap = async () => {
      try {
        const initialLat = Number(initialCoordinatesRef.current.latitude);
        const initialLng = Number(initialCoordinatesRef.current.longitude);
        const hasCoordinates = Number.isFinite(initialLat) && Number.isFinite(initialLng);
        if (hasGoogleMapsApiKey) {
          providerRef.current = 'google';
          const maps = await loadGoogleMaps();
          mapsApiRef.current = maps;
          if (!active || !mapElementRef.current || mapRef.current) return;

          const center = hasCoordinates ? { lat: initialLat, lng: initialLng } : DEFAULT_CENTER;

          mapRef.current = new maps.Map(mapElementRef.current, {
            center,
            zoom: hasCoordinates ? 15 : DEFAULT_ZOOM,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            mapTypeId: 'roadmap',
            styles: []
          });

          // Update location in local state.
          const updateLocation = async (latitude, longitude) => {
            const position = { lat: latitude, lng: longitude };

            if (!markerRef.current) {
              markerRef.current = new maps.Marker({
                position,
                map: mapRef.current,
                draggable: true
              });
              markerRef.current.addListener('dragend', async (dragEvent) => {
                const lat = Number(dragEvent.latLng.lat().toFixed(8));
                const lng = Number(dragEvent.latLng.lng().toFixed(8));
                await updateLocation(lat, lng);
              });
            } else {
              markerRef.current.setPosition(position);
            }

            mapRef.current.panTo(position);

            setLocationLoading(true);
            setLocationError('');

            try {
              const nextLocation = await reverseGeocodeWithGoogle(maps, latitude, longitude);
              setSearchQuery(nextLocation.address || '');
              onChange(nextLocation);
            } catch (error) {
              setLocationError(error.message || 'Could not read address from the map.');
              onChange({
                latitude,
                longitude,
                address: '',
                city: '',
                province: '',
                label: ''
              });
            } finally {
              setLocationLoading(false);
            }
          };

          if (hasCoordinates) {
            await updateLocation(initialLat, initialLng);
          }

          mapRef.current.addListener('click', async (event) => {
            const latitude = Number(event.latLng.lat().toFixed(8));
            const longitude = Number(event.latLng.lng().toFixed(8));
            await updateLocation(latitude, longitude);
          });
          return;
        }

        providerRef.current = 'leaflet';
        const L = await loadLeaflet();
        if (!active || !mapElementRef.current || mapRef.current) return;

        const center = hasCoordinates ? [initialLat, initialLng] : [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng];

        mapRef.current = L.map(mapElementRef.current, {
          center,
          zoom: hasCoordinates ? 15 : DEFAULT_ZOOM,
          scrollWheelZoom: true
        });

        tileLayerRef.current = L.tileLayer(LEAFLET_THEME_CONFIG.roadmap.url, {
          attribution: LEAFLET_THEME_CONFIG.roadmap.attribution,
          ...(LEAFLET_THEME_CONFIG.roadmap.options || {})
        }).addTo(mapRef.current);

        if (hasCoordinates) {
          markerRef.current = L.marker(center, { draggable: true }).addTo(mapRef.current);
          markerRef.current.on('dragend', async (event) => {
            const latitude = Number(event.target.getLatLng().lat.toFixed(8));
            const longitude = Number(event.target.getLatLng().lng.toFixed(8));

            setLocationLoading(true);
            setLocationError('');
            try {
              const nextLocation = await reverseGeocodeWithOsm(latitude, longitude);
              setSearchQuery(nextLocation.address || '');
              onChange(nextLocation);
            } catch (error) {
              setLocationError(error.message || 'Could not read address from the map.');
              onChange({
                latitude,
                longitude,
                address: '',
                city: '',
                province: '',
                label: ''
              });
            } finally {
              setLocationLoading(false);
            }
          });
        }

        mapRef.current.on('click', async (event) => {
          const latitude = Number(event.latlng.lat.toFixed(8));
          const longitude = Number(event.latlng.lng.toFixed(8));

          if (!markerRef.current) {
            markerRef.current = L.marker([latitude, longitude], { draggable: true }).addTo(mapRef.current);
            markerRef.current.on('dragend', async (dragEvent) => {
              const nextLat = Number(dragEvent.target.getLatLng().lat.toFixed(8));
              const nextLng = Number(dragEvent.target.getLatLng().lng.toFixed(8));

              setLocationLoading(true);
              setLocationError('');
              try {
                const nextLocation = await reverseGeocodeWithOsm(nextLat, nextLng);
                setSearchQuery(nextLocation.address || '');
                onChange(nextLocation);
              } catch (error) {
                setLocationError(error.message || 'Could not read address from the map.');
                onChange({
                  latitude: nextLat,
                  longitude: nextLng,
                  address: '',
                  city: '',
                  province: '',
                  label: ''
                });
              } finally {
                setLocationLoading(false);
              }
            });
          } else {
            markerRef.current.setLatLng([latitude, longitude]);
          }

          mapRef.current.setView([latitude, longitude], Math.max(mapRef.current.getZoom(), 15));
          setLocationLoading(true);
          setLocationError('');

          try {
            const nextLocation = await reverseGeocodeWithOsm(latitude, longitude);
            setSearchQuery(nextLocation.address || '');
            onChange(nextLocation);
          } catch (error) {
            setLocationError(error.message || 'Could not read address from the map.');
            onChange({
              latitude,
              longitude,
              address: '',
              city: '',
              province: '',
              label: ''
            });
          } finally {
            setLocationLoading(false);
          }
        });
      } catch (error) {
        setMapError(error.message || 'Failed to load map.');
      }
    };

    initMap();

    return () => {
      active = false;
      if (providerRef.current === 'leaflet' && mapRef.current?.remove) {
        mapRef.current.remove();
      }
      mapRef.current = null;
      markerRef.current = null;
      tileLayerRef.current = null;
    };
  }, [onChange]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (providerRef.current === 'google') {
      const googleTheme = mapTheme === 'dark' ? 'roadmap' : mapTheme;
      map.setMapTypeId(googleTheme);
      map.setOptions({
        styles: mapTheme === 'dark' ? GOOGLE_MAP_STYLES.dark : []
      });
      return;
    }

    const config = LEAFLET_THEME_CONFIG[mapTheme] || LEAFLET_THEME_CONFIG.roadmap;
    if (!window.L || !config) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    tileLayerRef.current = window.L.tileLayer(config.url, {
      attribution: config.attribution,
      ...(config.options || {})
    }).addTo(map);
  }, [mapTheme]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const latitude = Number(value?.latitude);
    const longitude = Number(value?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

    if (providerRef.current === 'google') {
      const nextLatLng = { lat: latitude, lng: longitude };
      map.setCenter(nextLatLng);
      map.setZoom(15);

      if (!markerRef.current && mapsApiRef.current) {
        markerRef.current = new mapsApiRef.current.Marker({
          position: nextLatLng,
          map,
          draggable: true
        });
        markerRef.current.addListener('dragend', async (dragEvent) => {
          const lat = Number(dragEvent.latLng.lat().toFixed(8));
          const lng = Number(dragEvent.latLng.lng().toFixed(8));

          setLocationLoading(true);
          setLocationError('');
          try {
            const nextLocation = await reverseGeocodeWithGoogle(mapsApiRef.current, lat, lng);
            setSearchQuery(nextLocation.address || '');
            onChange(nextLocation);
          } catch (error) {
            setLocationError(error.message || 'Could not read address from the map.');
            onChange({
              latitude: lat,
              longitude: lng,
              address: '',
              city: '',
              province: '',
              label: ''
            });
          } finally {
            setLocationLoading(false);
          }
        });
      } else if (markerRef.current) {
        markerRef.current.setPosition(nextLatLng);
      }
      return;
    }

    const nextLatLng = [latitude, longitude];
    map.setView(nextLatLng, 15);
    if (!markerRef.current && window.L) {
      markerRef.current = window.L.marker(nextLatLng, { draggable: true }).addTo(map);
      markerRef.current.on('dragend', async (dragEvent) => {
        const nextLat = Number(dragEvent.target.getLatLng().lat.toFixed(8));
        const nextLng = Number(dragEvent.target.getLatLng().lng.toFixed(8));

        setLocationLoading(true);
        setLocationError('');
        try {
          const nextLocation = await reverseGeocodeWithOsm(nextLat, nextLng);
          setSearchQuery(nextLocation.address || '');
          onChange(nextLocation);
        } catch (error) {
          setLocationError(error.message || 'Could not read address from the map.');
          onChange({
            latitude: nextLat,
            longitude: nextLng,
            address: '',
            city: '',
            province: '',
            label: ''
          });
        } finally {
          setLocationLoading(false);
        }
      });
    } else if (markerRef.current?.setLatLng) {
      markerRef.current.setLatLng(nextLatLng);
    }
  }, [onChange, value?.latitude, value?.longitude]);

  // Handle search location interactions.
  const handleSearchLocation = async () => {
    const query = String(searchQuery || '').trim();
    if (!query) {
      setLocationError('Enter a place or address to search.');
      return;
    }

    setLocationLoading(true);
    setLocationError('');

    try {
      const nextLocation =
        providerRef.current === 'google'
          ? await geocodeAddressWithGoogle(
              mapsApiRef.current || (await loadGoogleMaps()),
              query
            )
          : await geocodeAddressWithOsm(query);

      onChange(nextLocation);
    } catch (error) {
      setLocationError(error.message || 'Could not find that location.');
    } finally {
      setLocationLoading(false);
    }
  };

  // Handle clear location interactions.
  const handleClearLocation = () => {
    setLocationError('');
    setSearchQuery('');
    onChange({
      latitude: '',
      longitude: '',
      address: '',
      city: '',
      province: '',
      label: ''
    });

    if (providerRef.current === 'google' && markerRef.current?.setMap) {
      markerRef.current.setMap(null);
      markerRef.current = null;
      mapRef.current?.setCenter(DEFAULT_CENTER);
      mapRef.current?.setZoom(DEFAULT_ZOOM);
      return;
    }

    if (providerRef.current === 'leaflet') {
      if (markerRef.current?.remove) {
        markerRef.current.remove();
      }
      markerRef.current = null;
      mapRef.current?.setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], DEFAULT_ZOOM);
    }
  };

  // Handle use my location interactions.
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not available in this browser.');
      return;
    }

    setLocationLoading(true);
    setLocationError('');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = Number(position.coords.latitude.toFixed(8));
        const longitude = Number(position.coords.longitude.toFixed(8));

        try {
          const nextLocation =
            hasGoogleMapsApiKey
              ? await reverseGeocodeWithGoogle(
                  mapsApiRef.current || (await loadGoogleMaps()),
                  latitude,
                  longitude
                )
              : await reverseGeocodeWithOsm(latitude, longitude);
          setSearchQuery(nextLocation.address || '');
          onChange(nextLocation);
        } catch (error) {
          setLocationError(error.message || 'Could not read address from the map.');
          onChange({
            latitude,
            longitude,
            address: '',
            city: '',
            province: '',
            label: ''
          });
        } finally {
          setLocationLoading(false);
        }
      },
      () => {
        setLocationLoading(false);
        setLocationError('Could not access your current location.');
      }
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Location</h3>
          <p className="mt-1 text-sm text-slate-500">
            Search, click, or drag the pin to set the field location.
            {!hasGoogleMapsApiKey ? ' Using the basic map view.' : ''}
          </p>
        </div>
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleSearchLocation();
                }
              }}
              className="block w-full rounded-xl border border-gray-300 py-2.5 pl-10 pr-4 text-sm text-slate-900"
              placeholder="Search address, district, or landmark"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSearchLocation}
              disabled={locationLoading}
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {locationLoading ? 'Searching...' : 'Search'}
            </button>
            <button
              type="button"
              onClick={handleUseMyLocation}
              disabled={locationLoading}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Use My Location
            </button>
            <button
              type="button"
              onClick={handleClearLocation}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <XMarkIcon className="h-4 w-4" />
              Clear
            </button>
          </div>
        </div>
      </div>

      {mapError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {mapError}
        </div>
      ) : (
        <div className="overflow-hidden rounded-[24px] border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
            <span>Tip: click anywhere to place the pin, then drag it for exact positioning.</span>
            {Number.isFinite(Number(value?.latitude)) && Number.isFinite(Number(value?.longitude)) && (
              <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-slate-700 shadow-sm">
                Location selected
              </span>
            )}
          </div>
          <div className="relative">
            <div className="absolute bottom-3 left-3 z-[500] flex max-w-[calc(100%-24px)] flex-wrap items-end gap-2">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMapThemeMenuOpen((current) => !current)}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-3 py-2 text-[11px] font-semibold text-slate-700 shadow-lg backdrop-blur transition hover:bg-white"
                >
                  {MAP_THEME_OPTIONS.find((theme) => theme.id === mapTheme)?.label || 'Map'}
                  <ChevronDownIcon className={`h-3.5 w-3.5 transition ${mapThemeMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                {mapThemeMenuOpen && (
                  <div className="absolute bottom-full left-0 mb-2 min-w-[140px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                    {MAP_THEME_OPTIONS.map((theme) => {
                      const isActive = mapTheme === theme.id;
                      return (
                        <button
                          key={theme.id}
                          type="button"
                          onClick={() => {
                            setMapTheme(theme.id);
                            setMapThemeMenuOpen(false);
                          }}
                          className={`block w-full px-3 py-2 text-left text-xs font-semibold transition ${
                            isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {theme.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <div ref={mapElementRef} className="h-[360px] w-full bg-slate-100" />
          </div>
        </div>
      )}

      <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm">
            <MapPinIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">
              {locationLoading ? 'Reading map location...' : value?.address || 'No location selected yet'}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {value?.city || 'City unknown'}
              {value?.province ? `, ${value.province}` : ''}
            </p>
            {Number.isFinite(Number(value?.latitude)) && Number.isFinite(Number(value?.longitude)) && (
              <p className="mt-1 text-xs text-slate-500">
                {Number(value.latitude).toFixed(6)}, {Number(value.longitude).toFixed(6)}
              </p>
            )}
          </div>
        </div>
      </div>

      {locationError && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {locationError}
        </div>
      )}
    </div>
  );
};

export default FieldLocationPicker;
