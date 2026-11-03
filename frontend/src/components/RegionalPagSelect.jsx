import { useEffect, useId, useRef, useState } from 'react';

function normalize(value) {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export default function RegionalPagSelect({ value, options, onChange, disabled }) {
  const id = useId();
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const matches = options.filter((option) => !searching || normalize(option).includes(normalize(value)));
  const activeOptionId = open && matches[activeIndex] ? `${id}-option-${activeIndex}` : undefined;

  useEffect(() => {
    if (open && activeIndex >= 0) listRef.current?.children[activeIndex]?.scrollIntoView?.({ block: 'nearest' });
  }, [open, activeIndex]);

  function select(option) {
    onChange(option);
    setSearching(false);
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      if (matches.length) {
        const step = event.key === 'ArrowDown' ? 1 : -1;
        setActiveIndex((current) => !open || current < 0
          ? step > 0 ? 0 : matches.length - 1
          : (current + step + matches.length) % matches.length);
      }
    } else if (event.key === 'Enter' && open && matches.length) {
      event.preventDefault();
      select(matches[Math.max(0, activeIndex)]);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    }
  }

  return (
    <div className="pag-regional-field">
      <label htmlFor={id}>Regional PAG</label>
      <div className="pag-regional-select">
        <input ref={inputRef} id={id} type="text" role="combobox" required maxLength={80}
          autoComplete="off" value={value} disabled={disabled} placeholder="Escriba para buscar una regional"
          aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-list`}
          aria-activedescendant={activeOptionId}
          onFocus={() => { setOpen(true); setSearching(false); setActiveIndex(-1); }}
          onBlur={() => {
            setOpen(false);
            const exact = options.find((option) => normalize(option) === normalize(value));
            if (exact) onChange(exact);
          }}
          onChange={(event) => {
            onChange(event.target.value);
            setSearching(true);
            setActiveIndex(0);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown} />
        <button type="button" tabIndex={-1} disabled={disabled} aria-label="Mostrar regionales PAG"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => { const nextOpen = !open; inputRef.current?.focus(); setOpen(nextOpen); }}>
          <span aria-hidden="true">▾</span>
        </button>
        {open ? (
          <div className="pag-regional-options">
            <ul ref={listRef} id={`${id}-list`} role="listbox" aria-label="Regionales PAG">
              {matches.map((option, index) => (
                <li key={option} id={`${id}-option-${index}`} role="option"
                  aria-selected={index === activeIndex} className={index === activeIndex ? 'is-active' : ''}
                  onMouseDown={(event) => event.preventDefault()} onClick={() => select(option)}>
                  {option}
                </li>
              ))}
            </ul>
            {!matches.length ? <p role="status">No hay regionales que coincidan.</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
