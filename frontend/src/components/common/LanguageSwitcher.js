import React from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { useLanguage } from '../../context/LanguageContext';

const LANGUAGE_OPTIONS = [
  {
    value: 'en',
    label: 'English',
    shortLabel: 'EN',
    flagSrc: '/flags/english.png'
  },
  {
    value: 'km',
    label: 'Khmer',
    shortLabel: 'KM',
    flagSrc: '/flags/khmer.png'
  }
];

const LanguageFlag = ({ option, imageVisible, onError, className = '' }) => {
  if (imageVisible) {
    return (
      <img
        src={option.flagSrc}
        alt={option.label}
        className={className}
        onError={onError}
      />
    );
  }

  return (
    <span className="inline-flex h-6 w-9 items-center justify-center rounded-sm border border-slate-200 bg-emerald-50 text-[10px] font-bold tracking-[0.18em] text-emerald-700 shadow-sm">
      {option.shortLabel}
    </span>
  );
};

const LanguageSwitcher = ({ className = '' }) => {
  const { language, setLanguage, t } = useLanguage();
  const activeLanguage = LANGUAGE_OPTIONS.find((option) => option.value === language) || LANGUAGE_OPTIONS[0];
  const [open, setOpen] = React.useState(false);
  const [imageVisible, setImageVisible] = React.useState({
    en: true,
    km: true
  });
  const containerRef = React.useRef(null);

  React.useEffect(() => {
    const handlePointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handleSelect = (value) => {
    setLanguage(value);
    setOpen(false);
  };

  const handleImageError = (value) => {
    setImageVisible((prev) => ({ ...prev, [value]: false }));
  };

  return (
    <div ref={containerRef} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={t('label_language', 'Language')}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex h-10 w-[84px] items-center rounded-2xl border border-emerald-300 bg-white pl-2.5 pr-8 shadow-sm transition hover:border-emerald-400 focus:outline-none focus:ring-4 focus:ring-emerald-100"
      >
        <LanguageFlag
          option={activeLanguage}
          imageVisible={imageVisible[activeLanguage.value]}
          onError={() => handleImageError(activeLanguage.value)}
          className="h-6 w-9 rounded-sm border border-slate-200 object-cover shadow-sm"
        />
        <span className="pointer-events-none absolute right-2.5 text-slate-500">
          <ChevronDownIcon className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {open ? (
        <div className="absolute left-0 top-[calc(100%+8px)] z-50 min-w-[140px] overflow-hidden rounded-2xl border border-slate-200 bg-white py-1.5 shadow-[0_18px_40px_rgba(15,23,42,0.14)]">
          {LANGUAGE_OPTIONS.map((option) => {
            const isActive = option.value === activeLanguage.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option.value)}
                className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition ${
                  isActive ? 'bg-emerald-50 text-emerald-800' : 'text-slate-700 hover:bg-slate-50'
                }`}
                role="option"
                aria-selected={isActive}
              >
                <LanguageFlag
                  option={option}
                  imageVisible={imageVisible[option.value]}
                  onError={() => handleImageError(option.value)}
                  className="h-6 w-9 rounded-sm border border-slate-200 object-cover shadow-sm"
                />
                <span className="font-medium">{option.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

export default LanguageSwitcher;
