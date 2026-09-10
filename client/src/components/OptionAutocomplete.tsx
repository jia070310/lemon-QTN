import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { DictCategory, DictOption } from '../types';
import { SuggestPortal } from './SuggestPortal';

type Props = {
  category: DictCategory;
  value: string;
  placeholder?: string;
  options?: DictOption[];
  onChange: (value: string) => void;
  onUnknown?: (label: string) => void;
};

export function OptionAutocomplete({
  category,
  value,
  placeholder,
  options: externalOptions,
  onChange,
  onUnknown,
}: Props) {
  const [suggestions, setSuggestions] = useState<DictOption[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const knownRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (externalOptions) {
      knownRef.current = new Set(externalOptions.map((o) => o.label));
    }
  }, [externalOptions]);

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      try {
        if (externalOptions) {
          const q = value.trim().toLowerCase();
          const list = q
            ? externalOptions.filter(
                (o) =>
                  o.label.toLowerCase().includes(q) ||
                  o.labelEn.toLowerCase().includes(q),
              )
            : externalOptions;
          setSuggestions(list.slice(0, 30));
          if (value.trim()) setOpen(true);
          return;
        }
        const { items } = await api.listOptions(category, value.trim());
        knownRef.current = new Set(items.map((o) => o.label));
        setSuggestions(items);
        if (value.trim()) setOpen(true);
      } catch {
        setSuggestions([]);
      }
    }, 150);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [value, category, externalOptions]);

  function handleBlur() {
    window.setTimeout(() => {
      const label = value.trim();
      if (!label || !onUnknown) return;
      const known =
        knownRef.current.has(label) ||
        suggestions.some((s) => s.label === label) ||
        (externalOptions || []).some((s) => s.label === label);
      if (!known) onUnknown(label);
    }, 180);
  }

  return (
    <div className="autocomplete" ref={wrapRef}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        placeholder={placeholder}
        list={undefined}
      />
      <SuggestPortal open={open && suggestions.length > 0} anchorRef={wrapRef} onClose={() => setOpen(false)}>
        {suggestions.map((o) => (
          <li
            key={o.id}
            onMouseDown={(e) => {
              e.preventDefault();
              onChange(o.label);
              knownRef.current.add(o.label);
              setOpen(false);
            }}
          >
            <strong>{o.label}</strong>
            {o.labelEn ? <span>{o.labelEn}</span> : null}
          </li>
        ))}
      </SuggestPortal>
    </div>
  );
}
