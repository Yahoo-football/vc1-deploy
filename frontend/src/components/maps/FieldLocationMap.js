import React, { useEffect, useRef, useState } from 'react';
import { ArrowTopRightOnSquareIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { hasGoogleMapsApiKey, loadGoogleMaps } from './googleMapsLoader';
import { loadLeaflet } from './leafletLoader';

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

const FieldLocationMap = ({ latitude, longitude, locationUrl = '' }) => {
  const mapElementRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const tileLayerRef = useRef(null);
  const providerRef = useRef(hasGoogleMapsApiKey ? 'google' : 'leaflet');
  const [error, setError] = useState('');
  const [mapTheme, setMapTheme] = useState('roadmap');
  const [mapThemeMenuOpen, setMapThemeMenuOpen] = useState(false);

  useEffect(() => {
    let active = true;

    // Support init map for this module.
    const initMap = async () => {
      try {
        const lat = Number(latitude);
        const lng = Number(longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        if (hasGoogleMapsApiKey) {
          providerRef.current = 'google';
          const maps = await loadGoogleMaps();
          if (!active || !mapElementRef.current || mapRef.current) return;

          mapRef.current = new maps.Map(mapElementRef.current, {
            center: { lat, lng },
            zoom: 15,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            mapTypeId: 'roadmap',
            styles: []
          });

          markerRef.current = new maps.Marker({
            position: { lat, lng },
            map: mapRef.current
          });
          return;
        }

        providerRef.current = 'leaflet';
        const L = await loadLeaflet();
        if (!active || !mapElementRef.current || mapRef.current) return;

        mapRef.current = L.map(mapElementRef.current, {
          center: [lat, lng],
          zoom: 15,
          zoomControl: true,
          dragging: true
        });

        tileLayerRef.current = L.tileLayer(LEAFLET_THEME_CONFIG.roadmap.url, {
          attribution: LEAFLET_THEME_CONFIG.roadmap.attribution,
          ...(LEAFLET_THEME_CONFIG.roadmap.options || {})
        }).addTo(mapRef.current);

        markerRef.current = L.marker([lat, lng]).addTo(mapRef.current);
      } catch (leafletError) {
        setError(leafletError.message || 'Failed to load map.');
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
  }, [latitude, longitude]);

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

  if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
    return null;
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        {error}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[24px] border border-slate-200 shadow-sm">
      <div className="relative">
        <div className="absolute bottom-3 left-3 z-[500]">
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
        {locationUrl && (
          <div className="absolute right-3 top-3 z-[500]">
            <a
              href={locationUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/95 px-3 py-2 text-[11px] font-semibold text-emerald-700 shadow-lg backdrop-blur transition hover:border-emerald-300 hover:bg-white"
            >
              <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
              Open Location
            </a>
          </div>
        )}
        <div ref={mapElementRef} className="h-[320px] w-full bg-slate-100" />
      </div>
      <div className="flex flex-col gap-2 border-t border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <span>
          {Number(latitude).toFixed(6)}, {Number(longitude).toFixed(6)}
        </span>
        {locationUrl && (
          <a
            href={locationUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 underline-offset-4 hover:text-emerald-800 hover:underline"
          >
            <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
            Open location from map
          </a>
        )}
      </div>
    </div>
  );
};

export default FieldLocationMap;
