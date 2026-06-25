'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';

type SearchableSelectProps<T> = {
  value: string;
  onChange: (value: string, option?: T) => void;
  onSearch: (query: string) => Promise<T[]>;
  getOptionValue: (option: T) => string;
  getOptionLabel: (option: T) => string;
  getOptionKey: (option: T) => string;
  placeholder?: string;
  required?: boolean;
  className?: string;
  debounceMs?: number;
  /** Izinkan nilai teks bebas tanpa harus memilih dari daftar */
  allowFreeText?: boolean;
};

export function SearchableSelect<T>({
  value,
  onChange,
  onSearch,
  getOptionValue,
  getOptionLabel,
  getOptionKey,
  placeholder = 'Ketik untuk mencari...',
  required,
  className,
  debounceMs = 250,
  allowFreeText = false,
}: SearchableSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  const updateMenuPosition = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setMenuStyle({
      position: 'fixed',
      top: rect.bottom + 2,
      left: rect.left,
      width: Math.max(rect.width, 220),
      zIndex: 9999,
    });
  }, []);

  useEffect(() => {
    if (!open) return;

    const timer = window.setTimeout(() => {
      setLoading(true);
      setSearchError('');
      onSearch(query.trim())
        .then((items) => {
          setOptions(items);
          setSearchError('');
        })
        .catch((err) => {
          setOptions([]);
          setSearchError(
            err instanceof Error ? err.message : 'Gagal memuat data pencarian'
          );
        })
        .finally(() => setLoading(false));
    }, debounceMs);

    return () => window.clearTimeout(timer);
  }, [query, open, onSearch, debounceMs]);

  useEffect(() => {
    if (!open) return;

    updateMenuPosition();
    const onScrollOrResize = () => updateMenuPosition();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);

    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open, updateMenuPosition]);

  useEffect(() => {
    if (!open) return;

    const close = (e: MouseEvent) => {
      if (wrapperRef.current?.contains(e.target as Node)) return;
      if (allowFreeText && query.trim()) {
        onChange(query.trim());
      }
      setOpen(false);
      setQuery('');
    };

    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const openMenu = () => {
    setOpen(true);
    setQuery(value);
    requestAnimationFrame(updateMenuPosition);
  };

  const pick = (opt: T) => {
    onChange(getOptionValue(opt), opt);
    setQuery('');
    setOpen(false);
  };

  const clear = () => {
    onChange('');
    setQuery('');
    inputRef.current?.focus();
    openMenu();
  };

  const inputClass =
    className ??
    'min-w-0 flex-1 border-0 bg-transparent px-1 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0';

  return (
    <div ref={wrapperRef} className="relative min-w-0 flex-1">
      {required && (
        <input
          type="text"
          tabIndex={-1}
          value={value}
          required
          onChange={() => {}}
          className="pointer-events-none absolute h-0 w-0 opacity-0"
          aria-hidden
        />
      )}
      <div className="flex min-w-0 items-center">
        <input
          ref={inputRef}
          type="text"
          className={inputClass}
          value={open ? query : value}
          placeholder={placeholder}
          onChange={(e) => {
            const next = e.target.value;
            setQuery(next);
            setOpen(true);
            if (!next) {
              onChange('');
              return;
            }
            if (allowFreeText) {
              onChange(next);
            }
          }}
          onBlur={() => {
            window.setTimeout(() => {
              if (allowFreeText && query.trim()) {
                onChange(query.trim());
              }
              setOpen(false);
              setQuery('');
            }, 150);
          }}
          onFocus={openMenu}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
        />
        {value && !open && (
          <button
            type="button"
            onClick={clear}
            className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Hapus pilihan"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && (
        <ul
          style={menuStyle}
          className="max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          role="listbox"
        >
          {loading && (
            <li className="flex items-center gap-2 px-3 py-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Mencari...
            </li>
          )}
          {!loading && searchError && (
            <li className="px-3 py-2 text-sm text-red-600">{searchError}</li>
          )}
          {!loading && !searchError && options.length === 0 && (
            <li className="px-3 py-2 text-sm text-slate-500">Tidak ada hasil</li>
          )}
          {!loading &&
            options.map((opt) => {
              const label = getOptionLabel(opt);
              const selected = getOptionValue(opt) === value;
              return (
                <li key={getOptionKey(opt)}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-orange-50 ${
                      selected ? 'bg-orange-50 font-medium text-orange-800' : 'text-slate-800'
                    }`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(opt)}
                  >
                    {label}
                  </button>
                </li>
              );
            })}
        </ul>
      )}
    </div>
  );
}
