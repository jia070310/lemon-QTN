import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { Product } from '../types';
import { SuggestPortal } from './SuggestPortal';

type Props = {
  value: string;
  onChange: (value: string) => void;
  onPickProduct: (product: Product) => void;
  onUnknownModel: (code: string) => void;
};

export function ModelAutocomplete({ value, onChange, onPickProduct, onUnknownModel }: Props) {
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    if (!value.trim()) {
      setSuggestions([]);
      return;
    }
    timer.current = window.setTimeout(async () => {
      try {
        const { items } = await api.listProducts(value.trim());
        setSuggestions(items);
        setOpen(true);
      } catch {
        setSuggestions([]);
      }
    }, 200);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [value]);

  async function handleBlur() {
    window.setTimeout(async () => {
      const code = value.trim();
      if (!code) return;
      try {
        const { items } = await api.listProducts(code);
        const exact = items.find((p) => p.code.toLowerCase() === code.toLowerCase());
        if (!exact) onUnknownModel(code);
      } catch {
        /* ignore */
      }
    }, 180);
  }

  return (
    <div className="autocomplete" ref={wrapRef}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => value && setOpen(true)}
        onBlur={handleBlur}
        placeholder="型号"
      />
      <SuggestPortal open={open && suggestions.length > 0} anchorRef={wrapRef} onClose={() => setOpen(false)}>
        {suggestions.map((p) => (
          <li
            key={p.id}
            onMouseDown={(e) => {
              e.preventDefault();
              onPickProduct(p);
              setOpen(false);
            }}
          >
            <strong>{p.code}</strong>
            <span>
              {p.type} · RM {p.defaultUnitPrice}
            </span>
          </li>
        ))}
      </SuggestPortal>
    </div>
  );
}
