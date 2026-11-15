import { PALETTE, HEX_COLOR, readableOn } from '../data/colors.js';
import { Avatar } from './primitives.jsx';

// Radio-style swatch group + a custom color input, with a live avatar preview.
// Selection is shown by a check mark and ring as well as by color, so it never depends on color alone.
export function ColorPicker({ value, onChange, name = 'Y', error }) {
  const custom = !PALETTE.some(([, hex]) => hex === value);
  return (
    <fieldset className="m-0 border-0 p-0" aria-describedby={error ? 'color-err' : undefined}>
      <legend className="text-[13px] font-semibold">Profile color</legend>
      <div className="mt-2 flex flex-wrap items-center gap-4">
        <Avatar name={name || 'You'} size={56} color={value} />
        <div role="radiogroup" aria-label="Profile color" className="flex max-w-[420px] flex-wrap gap-2">
          {PALETTE.map(([label, hex]) => {
            const on = value === hex;
            return (
              <button
                key={hex}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={label}
                title={label}
                onClick={() => onChange(hex)}
                style={{ background: hex, color: readableOn(hex) }}
                className={`grid h-10 w-10 place-items-center rounded-full border-2 text-base font-bold ${on ? 'border-text outline outline-2 outline-offset-2 outline-text' : 'border-border-input'}`}
              >
                {on ? '✓' : ''}
              </button>
            );
          })}
          <label className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 rounded-full border-control border-border-input px-3 text-sm font-semibold">
            <input
              type="color"
              value={HEX_COLOR.test(value) ? value : '#e4002b'}
              onChange={(e) => onChange(e.target.value.toLowerCase())}
              aria-label="Custom color"
              className="h-6 w-6 cursor-pointer border-0 bg-transparent p-0"
            />
            Custom{custom ? ' ✓' : ''}
          </label>
        </div>
      </div>
      {error && <span id="color-err" className="mt-1 block text-[13px] font-semibold text-danger">{error}</span>}
    </fieldset>
  );
}
