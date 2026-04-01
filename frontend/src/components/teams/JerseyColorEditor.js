import React, { useEffect, useRef, useState } from 'react';
import { PlusIcon, SwatchIcon, TrashIcon } from '@heroicons/react/24/outline';
import { DEFAULT_JERSEY_COLOR, normalizeHexColor } from '../../utils/teamColors';

const JERSEY_COLOR_PRESETS = [
  '#FFFFFF',
  '#111827',
  '#DC2626',
  '#2563EB',
  '#16A34A',
  '#F59E0B',
  '#7C3AED',
  '#EC4899',
  '#0EA5E9',
  '#6B7280'
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const hexToRgb = (hexColor) => {
  const color = normalizeHexColor(hexColor) || DEFAULT_JERSEY_COLOR;
  const cleanHex = color.slice(1);
  return {
    r: parseInt(cleanHex.slice(0, 2), 16),
    g: parseInt(cleanHex.slice(2, 4), 16),
    b: parseInt(cleanHex.slice(4, 6), 16)
  };
};

const rgbToHex = ({ r, g, b }) =>
  `#${[r, g, b]
    .map((value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;

const rgbToHsv = ({ r, g, b }) => {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === red) h = ((green - blue) / delta) % 6;
    else if (max === green) h = (blue - red) / delta + 2;
    else h = (red - green) / delta + 4;
  }

  return {
    h: Math.round(((h * 60) + 360) % 360),
    s: max === 0 ? 0 : delta / max,
    v: max
  };
};

const hsvToRgb = ({ h, s, v }) => {
  const hue = ((h % 360) + 360) % 360;
  const saturation = clamp(s, 0, 1);
  const value = clamp(v, 0, 1);
  const chroma = value * saturation;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const match = value - chroma;

  let red = 0;
  let green = 0;
  let blue = 0;

  if (hue < 60) [red, green, blue] = [chroma, x, 0];
  else if (hue < 120) [red, green, blue] = [x, chroma, 0];
  else if (hue < 180) [red, green, blue] = [0, chroma, x];
  else if (hue < 240) [red, green, blue] = [0, x, chroma];
  else if (hue < 300) [red, green, blue] = [x, 0, chroma];
  else [red, green, blue] = [chroma, 0, x];

  return {
    r: (red + match) * 255,
    g: (green + match) * 255,
    b: (blue + match) * 255
  };
};

const hexToHsv = (hexColor) => rgbToHsv(hexToRgb(hexColor));
const hsvToHex = (hsv) => rgbToHex(hsvToRgb(hsv));

const JerseyColorEditor = ({
  colors = [DEFAULT_JERSEY_COLOR],
  currentColors = [],
  activeColorIndex = 0,
  onActiveColorChange,
  onColorChange,
  onAddColor,
  onRemoveColor,
  maxColors = 5,
  title = 'Team Jersey Colors',
  description = 'Choose one or more colors for the team kit.',
  helperText = 'Drag inside the picker to choose a color.'
}) => {
  const previewColors = currentColors.length > 0 ? currentColors : colors;
  const activeColor = normalizeHexColor(colors[activeColorIndex]) || DEFAULT_JERSEY_COLOR;
  const [pickerHsv, setPickerHsv] = useState(() => hexToHsv(activeColor));
  const pickerHsvRef = useRef(pickerHsv);
  const saturationRef = useRef(null);
  const hueRef = useRef(null);
  const dragModeRef = useRef(null);

  useEffect(() => {
    const nextHsv = hexToHsv(activeColor);
    pickerHsvRef.current = nextHsv;
    setPickerHsv(nextHsv);
  }, [activeColor]);

  useEffect(() => {
    pickerHsvRef.current = pickerHsv;
  }, [pickerHsv]);

  useEffect(() => {
    const handlePointerMove = (event) => {
      if (!dragModeRef.current) return;
      if (dragModeRef.current === 'saturation') {
        const area = saturationRef.current;
        if (!area) return;
        const rect = area.getBoundingClientRect();
        const x = clamp(event.clientX - rect.left, 0, rect.width);
        const y = clamp(event.clientY - rect.top, 0, rect.height);
        const nextHsv = {
          ...pickerHsvRef.current,
          s: rect.width === 0 ? 0 : x / rect.width,
          v: rect.height === 0 ? 0 : 1 - (y / rect.height)
        };
        pickerHsvRef.current = nextHsv;
        setPickerHsv(nextHsv);
        onColorChange(activeColorIndex, hsvToHex(nextHsv));
      }
      if (dragModeRef.current === 'hue') {
        const area = hueRef.current;
        if (!area) return;
        const rect = area.getBoundingClientRect();
        const x = clamp(event.clientX - rect.left, 0, rect.width);
        const nextHsv = {
          ...pickerHsvRef.current,
          h: rect.width === 0 ? 0 : Math.round((x / rect.width) * 360)
        };
        pickerHsvRef.current = nextHsv;
        setPickerHsv(nextHsv);
        onColorChange(activeColorIndex, hsvToHex(nextHsv));
      }
    };

    const handlePointerUp = () => {
      dragModeRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [activeColorIndex, onColorChange]);

  const handleSaturationPointerDown = (event) => {
    dragModeRef.current = 'saturation';
    const area = saturationRef.current;
    if (!area) return;
    const rect = area.getBoundingClientRect();
    const x = clamp(event.clientX - rect.left, 0, rect.width);
    const y = clamp(event.clientY - rect.top, 0, rect.height);
    const nextHsv = {
      ...pickerHsvRef.current,
      s: rect.width === 0 ? 0 : x / rect.width,
      v: rect.height === 0 ? 0 : 1 - (y / rect.height)
    };
    pickerHsvRef.current = nextHsv;
    setPickerHsv(nextHsv);
    onColorChange(activeColorIndex, hsvToHex(nextHsv));
  };

  const handleHuePointerDown = (event) => {
    dragModeRef.current = 'hue';
    const area = hueRef.current;
    if (!area) return;
    const rect = area.getBoundingClientRect();
    const x = clamp(event.clientX - rect.left, 0, rect.width);
    const nextHsv = {
      ...pickerHsvRef.current,
      h: rect.width === 0 ? 0 : Math.round((x / rect.width) * 360)
    };
    pickerHsvRef.current = nextHsv;
    setPickerHsv(nextHsv);
    onColorChange(activeColorIndex, hsvToHex(nextHsv));
  };

  const rgb = hexToRgb(activeColor);
  const saturationX = `${pickerHsv.s * 100}%`;
  const saturationY = `${(1 - pickerHsv.v) * 100}%`;
  const hueX = `${(pickerHsv.h / 360) * 100}%`;
  const vividHueColor = hsvToHex({ h: pickerHsv.h, s: 1, v: 1 });

  return (
    <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-white via-emerald-50/30 to-cyan-50/30 p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
          <p className="mt-1 text-xs text-slate-500">{helperText}</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-2 shadow-sm">
          {previewColors.map((color, index) => (
            <span
              key={`${color}-${index}`}
              className="h-4 w-4 rounded-full shadow-[inset_0_0_0_1px_rgba(15,23,42,0.12)]"
              style={{ backgroundColor: color }}
            />
          ))}
          <span className="ml-1 text-xs font-medium text-slate-500">{previewColors.length}</span>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {colors.map((color, index) => {
          const normalizedColor = normalizeHexColor(color) || DEFAULT_JERSEY_COLOR;
          const isActive = activeColorIndex === index;

          return (
            <div
              key={`${normalizedColor}-${index}`}
              className={`flex flex-wrap items-center gap-3 rounded-xl border bg-white px-3 py-3 shadow-sm transition-all hover:border-emerald-200 hover:shadow ${
                isActive ? 'border-emerald-300 ring-2 ring-emerald-100' : 'border-slate-200'
              }`}
            >
              <button
                type="button"
                onClick={() => onActiveColorChange?.(index)}
                className="inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 transition hover:border-emerald-300 hover:bg-emerald-50"
              >
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">#{index + 1}</span>
                <span
                  className="h-11 w-11 rounded-full border-4 border-white shadow-[0_0_0_1px_rgba(15,23,42,0.12)]"
                  style={{ backgroundColor: normalizedColor }}
                />
                <span className="text-sm font-semibold text-slate-700">{isActive ? 'Editing' : 'Select'}</span>
              </button>

              <button
                type="button"
                onClick={() => onActiveColorChange?.(index)}
                className="inline-flex min-w-[112px] justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold uppercase text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50"
              >
                {normalizedColor}
              </button>

              <button
                type="button"
                onClick={() => onRemoveColor(index)}
                disabled={colors.length <= 1}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <TrashIcon className="h-4 w-4" />
                Remove
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <SwatchIcon className="h-4 w-4" />
            Drag Picker for Color #{activeColorIndex + 1}
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1.5">
            <span
              className="h-6 w-6 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(15,23,42,0.12)]"
              style={{ backgroundColor: activeColor }}
            />
            <span className="text-[11px] font-semibold uppercase text-slate-700">{activeColor}</span>
          </div>
        </div>

        <div
          ref={saturationRef}
          onPointerDown={handleSaturationPointerDown}
          className="relative h-24 w-full cursor-crosshair overflow-hidden rounded-lg border border-slate-200"
          style={{
            backgroundColor: vividHueColor,
            backgroundImage:
              'linear-gradient(to top, black, transparent), linear-gradient(to right, white, transparent)'
          }}
        >
          <span
            className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_2px_rgba(15,23,42,0.85)]"
            style={{ left: saturationX, top: saturationY }}
          />
        </div>

        <div className="mt-2.5 flex items-center gap-2.5">
          <span
            className="h-7 w-7 shrink-0 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(15,23,42,0.12)]"
            style={{ backgroundColor: activeColor }}
          />
          <div
            ref={hueRef}
            onPointerDown={handleHuePointerDown}
            className="relative h-3 flex-1 cursor-ew-resize rounded-full border border-slate-200"
            style={{
              background:
                'linear-gradient(90deg, #FF0000 0%, #FF00FF 17%, #0000FF 33%, #00FFFF 50%, #00FF00 67%, #FFFF00 83%, #FF0000 100%)'
            }}
          >
            <span
              className="pointer-events-none absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_2px_rgba(15,23,42,0.16)]"
              style={{ left: hueX, backgroundColor: vividHueColor }}
            />
          </div>
        </div>

        <div className="mt-2.5 grid grid-cols-3 gap-1.5">
          {[
            ['R', rgb.r],
            ['G', rgb.g],
            ['B', rgb.b]
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-center">
              <div className="text-sm font-semibold text-slate-900">{value}</div>
              <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.22em] text-slate-400">{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <SwatchIcon className="h-4 w-4" />
          Quick Picks for Color #{activeColorIndex + 1}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {JERSEY_COLOR_PRESETS.map((presetColor) => (
            <button
              key={presetColor}
              type="button"
              onClick={() => onColorChange(activeColorIndex, presetColor)}
              className={`h-9 w-9 rounded-full shadow-[inset_0_0_0_1px_rgba(15,23,42,0.12)] transition-transform hover:scale-110 ${
                activeColor === presetColor ? 'ring-2 ring-emerald-400 ring-offset-2' : ''
              }`}
              style={{ backgroundColor: presetColor }}
              aria-label={`Choose preset color ${presetColor}`}
              title={presetColor}
            />
          ))}

          <button
            type="button"
            onClick={onAddColor}
            disabled={colors.length >= maxColors}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PlusIcon className="h-4 w-4" />
            Add Color
          </button>
        </div>
      </div>
    </div>
  );
};

export default JerseyColorEditor;
