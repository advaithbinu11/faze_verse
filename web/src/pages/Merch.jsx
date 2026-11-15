import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Button, Chip, Field, Pill, errorMessage, inputClass } from '../ui/primitives.jsx';
import { CATEGORIES, MAX_QTY, MERCH, POINTS_PER_BLOCK, SIGNATURE_POINTS, SIZES, isSized, pointsEarned } from '../data/merch.js';
import { api } from '../data/index.js';
import { useAsync } from '../hooks/useAsync.js';
import { useAuth } from '../state/AuthContext.jsx';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const money = (n) => `$${n.toFixed(2)}`;
// Grid prices drop the cents on whole dollars ($90), as in the shop; item, checkout and receipt always show cents.
const gridPrice = (n) => (Number.isInteger(n) ? `$${n}` : money(n));
const clampQty = (text) => Math.min(MAX_QTY, Math.max(1, Math.floor(Number(text)) || 1));
const fmt = (n) => n.toLocaleString();
const cents = (dollars) => Math.round(dollars * 100);
const fromCents = (c) => money(c / 100);
// Reward codes: a percentage of the subtotal, or a fixed amount that never exceeds it. Whole cents throughout.
const discountFor = (coupon, subtotal) => {
  if (!coupon || subtotal < (coupon.min_spend_cents ?? 0)) return 0;
  return coupon.kind === 'merch_percent' ? Math.round((subtotal * coupon.percent) / 100) : Math.min(coupon.amount_cents, subtotal);
};
const orderNumber = () => `FZ-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

function Tile({ item, badges = true, className = '' }) {
  return (
    <div className={`relative aspect-square overflow-hidden rounded-sm bg-white ${className}`}>
      <img src={item.image} alt={item.name} loading="lazy" className="h-full w-full object-contain" />
      {badges && item.was && !item.soldOut && <span className="absolute left-1.5 top-1.5 bg-accent px-2 py-0.5 text-xs font-bold tracking-wider text-on-accent">SALE</span>}
      {badges && item.soldOut && <span className="absolute left-1.5 top-1.5 bg-text px-2 py-0.5 text-xs font-bold tracking-wider text-bg">SOLD OUT</span>}
    </div>
  );
}

const Price = ({ item }) => (item.was && !item.soldOut
  ? <><s className="text-muted">${item.was}</s> {gridPrice(item.price)}</>
  : gridPrice(item.price));

// Merch shop: grid -> item -> checkout -> confirmation. Checkout is a demo: nothing is charged, stored or shipped.
export default function Merch() {
  const { user, refresh } = useAuth();
  const myCodes = useAsync(() => (user ? api.listMyPerks() : []), [user?._id]);
  const [coupon, setCoupon] = useState(null);
  const [codeText, setCodeText] = useState('');
  const [codeError, setCodeError] = useState('');
  const [checking, setChecking] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [signed, setSigned] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [view, setView] = useState('list'); // list | item | checkout | confirmed
  const [category, setCategory] = useState('All');
  const [item, setItem] = useState(null);
  const [size, setSize] = useState('M');
  const [qtyText, setQtyText] = useState('1');
  const [form, setForm] = useState({ name: '', email: '', address: '' });
  const [errors, setErrors] = useState({});
  const [order, setOrder] = useState(null);
  const heading = useRef(null);

  // Each step is a new screen: scroll to the top and move focus to its heading for keyboard and screen-reader users.
  useEffect(() => { window.scrollTo(0, 0); heading.current?.focus({ preventScroll: true }); }, [view]);

  const qty = clampQty(qtyText);
  const sized = item ? isSized(item) : false;

  const open = (m) => { setItem(m); setSize('M'); setQtyText('1'); setView('item'); };
  const reset = () => { setSigned(false); setOrderError(''); setCoupon(null); setCodeText(''); setCodeError(''); setOrder(null); setItem(null); setForm({ name: '', email: '', address: '' }); setErrors({}); setView('list'); };
  const toCheckout = () => { setQtyText(String(qty)); setErrors({}); setSigned(false); setOrderError(''); setCoupon(null); setCodeText(''); setCodeError(''); myCodes.reload(); setView('checkout'); };

  const subtotal = item ? cents(item.price) * qty : 0;
  const discount = discountFor(coupon, subtotal);
  const total = subtotal - discount;
  const usable = (myCodes.data ?? []).filter((r) => r.usable);

  // Points: earned on what is paid (after any code); a signature is paid for with points you already have.
  const signatureCost = SIGNATURE_POINTS * qty;
  const canSign = Boolean(user) && user.faze_points >= signatureCost;
  const signing = signed && canSign;
  const earn = pointsEarned(total);

  // Codes are checked on the server (they belong to one account and work once); the minimum spend is checked here too.
  const applyCode = async (raw) => {
    const code = raw.trim();
    if (!code) return setCodeError('Enter a code.');
    setChecking(true); setCodeError('');
    try {
      const c = await api.getCoupon(code);
      if (c.min_spend_cents && subtotal < c.min_spend_cents) { setCoupon(null); return setCodeError(`This code needs an order of ${fromCents(c.min_spend_cents)} or more.`); }
      setCoupon(c); setCodeText('');
    } catch (err) { setCoupon(null); setCodeError(errorMessage(err)); } finally { setChecking(false); }
  };

  const submit = async (e) => {
    e.preventDefault();
    const found = {};
    if (!form.name.trim()) found.name = 'Enter your name.';
    if (!EMAIL.test(form.email.trim())) found.email = 'Enter a valid email address.';
    if (!form.address.trim()) found.address = 'Enter a shipping address.';
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) return document.getElementById(`mc-${first}`)?.focus();
    setPlacing(true); setOrderError('');
    if (!user) {
      // Signed out: a demo order that earns nothing and spends nothing.
      setPlacing(false);
      setOrder({ number: orderNumber(), name: form.name.trim(), item, qty, size: sized ? size : '', price: item.price, subtotal, discount: 0, total: subtotal, code: null, signaturePoints: 0, earned: 0, balance: null });
      return setView('confirmed');
    }
    try {
      // One request: the server prices the order, spends the code, debits any signature and credits the points, or does none of it.
      const { order: o, balance } = await api.placeMerchOrder({ item_id: item.id, qty, ...(sized && { size }), signed: signing, ...(coupon && { code: coupon.code }) });
      await refresh(); // the header balance reads the signed-in user
      myCodes.reload();
      setPlacing(false);
      setOrder({ number: o.number, name: form.name.trim(), item, qty: o.qty, size: o.size ?? '', price: o.unit_cents / 100, subtotal: o.subtotal_cents, discount: o.discount_cents, total: o.total_cents, code: o.coupon_code,
        signaturePoints: o.signature_points, earned: o.points_earned, balance });
      setView('confirmed');
    } catch (err) {
      setPlacing(false); myCodes.reload();
      const msg = errorMessage(err);
      if (/code/i.test(msg)) { setCoupon(null); setCodeError(msg); document.getElementById('mc-code')?.focus(); } else setOrderError(msg);
    }
  };
  const bind = (k) => ({
    id: `mc-${k}`, value: form[k], 'aria-invalid': Boolean(errors[k]) || undefined, 'aria-describedby': errors[k] ? `mc-${k}-err` : undefined,
    onChange: (e) => setForm((f) => ({ ...f, [k]: e.target.value })),
  });

  if (view === 'confirmed' && order) {
    const o = order;
    return (
      <div className="max-w-feed">
        <h1 ref={heading} tabIndex={-1} className="text-xl outline-none">Order confirmed</h1>
        <div className="frame mt-3 grid gap-4 p-5" role="status">
          <div><Chip accent>CONFIRMED</Chip></div>
          <div>
            <h2 className="text-lg">Thanks, {o.name}!</h2>
            <p className="mt-1 text-body-sm">Your mock order <b>{o.number}</b> is confirmed.</p>
          </div>
          <div className="flex items-center gap-3.5">
            <Tile item={o.item} badges={false} className="h-[90px] w-[90px] flex-none" />
            <div>
              <b>{o.item.name}</b>
              <div className="text-sm text-muted">{o.qty} × {money(o.price)}{o.size && ` · Size ${o.size}`}</div>
            </div>
          </div>
          {o.discount > 0 && (
            <dl className="m-0 grid gap-0.5 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-muted">Subtotal</dt><dd className="m-0">{fromCents(o.subtotal)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">Discount ({o.code})</dt><dd className="m-0 font-bold text-success">−{fromCents(o.discount)}</dd></div>
            </dl>
          )}
          <p className="font-display text-lg uppercase">Total: {fromCents(o.total)}</p>
          {o.balance !== null ? (
            <ul className="m-0 grid list-none gap-1 p-0 text-body-sm">
              <li>{o.earned > 0 ? <>You earned <b className="text-success">+{fmt(o.earned)} points</b>.</> : 'This order was under $10, so it earned no points.'}</li>
              {o.signaturePoints > 0 && <li>Signed: <b>{fmt(o.signaturePoints)} points</b> spent on {o.qty > 1 ? `${o.qty} signatures` : 'a signature'}.</li>}
              <li className="text-muted">Your balance is now {fmt(o.balance)} points.</li>
            </ul>
          ) : <p className="text-sm text-muted">Sign in to earn {fmt(pointsEarned(o.total))} points on orders like this.</p>}
          <p className="text-sm text-muted">Demo only. No payment was processed and nothing will be shipped.</p>
          <div><Button variant="primary" onClick={reset}>Back to merch</Button></div>
        </div>
      </div>
    );
  }

  if (view === 'checkout' && item) {
    return (
      <div>
        <Button onClick={() => setView('item')}>← Back to item</Button>
        <h1 ref={heading} tabIndex={-1} className="mt-3 text-xl outline-none">Checkout</h1>
        <div className="mt-4 grid gap-6 md:grid-cols-[1.4fr_1fr]">
          <form onSubmit={submit} noValidate className="grid content-start gap-4 rounded-md bg-surface p-4">
            <p className="text-sm text-muted">Demo checkout. No payment details are collected.</p>
            <Field id="mc-name" label="Name" error={errors.name}><input {...bind('name')} className={inputClass} autoComplete="name" required /></Field>
            <Field id="mc-email" label="Email" error={errors.email}><input {...bind('email')} className={inputClass} type="email" autoComplete="email" required /></Field>
            <Field id="mc-address" label="Shipping address" error={errors.address}><input {...bind('address')} className={inputClass} autoComplete="street-address" required /></Field>

            <div className="grid gap-2 border-t border-border pt-4">
              <Field id="mc-code" label="Discount code (optional)" error={codeError}>
                {user ? (
                  <>
                    {usable.length > 0 && (
                      <div role="group" aria-label="Your reward codes" className="flex flex-wrap gap-2">
                        {usable.map((r) => <Pill key={r.id} pressed={coupon?.code === r.code} onClick={() => (coupon?.code === r.code ? setCoupon(null) : applyCode(r.code))}>{r.title}</Pill>)}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input id="mc-code" className={inputClass} value={codeText} placeholder="FZ-XXXX-XXXX" autoComplete="off" spellCheck={false}
                        aria-invalid={Boolean(codeError) || undefined} aria-describedby={codeError ? 'mc-code-err' : undefined}
                        onChange={(e) => { setCodeText(e.target.value); setCodeError(''); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyCode(codeText); } }} />
                      <Button loading={checking} onClick={() => applyCode(codeText)}>Apply</Button>
                    </div>
                  </>
                ) : <span className="font-normal text-muted"><Link to="/login" className="font-bold text-accent-text underline">Sign in</Link> to use codes you redeem with points.</span>}
              </Field>
              {coupon && (
                <p role="status" className="text-sm font-semibold text-success">
                  {discount > 0 ? `${coupon.title} applied: −${fromCents(discount)}` : `${coupon.title} needs an order of ${fromCents(coupon.min_spend_cents ?? 0)} or more.`}
                </p>
              )}
            </div>

            <div className="grid gap-1 border-t border-border pt-4">
              <label className={`flex items-start gap-3 ${canSign ? 'cursor-pointer' : ''}`}>
                <input id="mc-sign" type="checkbox" className="mt-1 h-5 w-5 flex-none accent-[var(--color-accent)]" checked={signing} disabled={!canSign} onChange={(e) => setSigned(e.target.checked)} aria-describedby="mc-sign-note" />
                <span className={canSign ? '' : 'opacity-70'}>
                  <b>Add a signature</b> · {fmt(SIGNATURE_POINTS)} points per piece{qty > 1 && ` (${fmt(signatureCost)} for ${qty})`}
                  <span id="mc-sign-note" className="block text-sm font-normal text-muted">
                    {!user ? <><Link to="/login" className="font-bold text-accent-text underline">Sign in</Link> to add a signature with your points.</>
                      : !canSign ? `You have ${fmt(user.faze_points)} points and need ${fmt(signatureCost)}.`
                      : 'Paid with points, not dollars. Your piece is signed before it ships.'}
                  </span>
                </span>
              </label>
            </div>

            {orderError && <p role="alert" className="rounded-md bg-bg p-3 font-semibold text-danger">{orderError}</p>}
            <div><Button variant="primary" type="submit" loading={placing}>Confirm mock order</Button></div>
          </form>
          <section aria-labelledby="sum-h" className="frame grid content-start gap-2 p-5">
            <h2 id="sum-h" className="text-lg">Order summary</h2>
            <div className="flex items-center gap-3">
              <Tile item={item} badges={false} className="h-16 w-16 flex-none" />
              <b>{item.name}</b>
            </div>
            <p className="text-sm text-muted">Quantity: {qty}{sized && ` · Size ${size}`}</p>
            {discount > 0 && (
              <dl className="m-0 grid gap-0.5 text-sm">
                <div className="flex justify-between gap-4"><dt className="text-muted">Subtotal</dt><dd className="m-0">{fromCents(subtotal)}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted">Discount</dt><dd className="m-0 font-bold text-success">−{fromCents(discount)}</dd></div>
              </dl>
            )}
            <p className="font-display text-lg uppercase" aria-live="polite">{fromCents(total)}</p>
            {signing && <p className="text-sm">Signature: <b>−{fmt(signatureCost)} pts</b></p>}
            <p className="text-sm font-semibold text-success" aria-live="polite">
              {earn === 0 ? <span className="font-normal text-muted">Spend $10 or more to earn points.</span>
                : user ? `You'll earn +${fmt(earn)} points` : <span className="font-normal text-muted">Sign in to earn {fmt(earn)} points on this order.</span>}
            </p>
            <p className="text-sm text-muted">This is a mock order. No payment will be taken.</p>
          </section>
        </div>
      </div>
    );
  }

  if (view === 'item' && item) {
    return (
      <div>
        <Button onClick={() => setView('list')}>← Back to merch</Button>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div className="frame p-3.5"><Tile item={item} /></div>
          <div className="frame grid content-start gap-3 p-5">
            <div><Chip on={false}>{item.category}</Chip></div>
            <h1 ref={heading} tabIndex={-1} className="text-xl outline-none">{item.name}</h1>
            <p className="font-display text-lg uppercase">{item.was && !item.soldOut && <s className="mr-2 text-muted">{money(item.was)}</s>}{money(item.price)}</p>
            <p className="text-sm text-muted">{item.soldOut ? 'Sold out. This drop is no longer available.' : 'Limited supply only. Available while stocks last.'}</p>
            {!item.soldOut && (
              <p className="text-sm font-semibold text-success">
                Earn {fmt(pointsEarned(cents(item.price) * qty))} points with this order
                <span className="font-normal text-muted"> · {fmt(POINTS_PER_BLOCK)} for every $10 you spend. Add a signature for {fmt(SIGNATURE_POINTS)} points.</span>
              </p>
            )}
            {sized && (
              <div role="group" aria-labelledby="size-l" className="grid gap-1.5">
                <span id="size-l" className="text-[13px] font-semibold">Size</span>
                <div className="flex flex-wrap gap-2">{SIZES.map((s) => <Pill key={s} pressed={size === s} onClick={() => setSize(s)}>{s}</Pill>)}</div>
              </div>
            )}
            <Field id="mc-qty" label={`Quantity (up to ${MAX_QTY})`}>
              <input id="mc-qty" className={`${inputClass} max-w-[120px]`} type="number" inputMode="numeric" min="1" max={MAX_QTY} step="1" value={qtyText}
                onChange={(e) => setQtyText(e.target.value)} onBlur={() => setQtyText(String(qty))} />
            </Field>
            <div><Button variant="primary" disabled={item.soldOut} onClick={toCheckout}>{item.soldOut ? 'Sold out' : 'Continue to checkout'}</Button></div>
          </div>
        </div>
      </div>
    );
  }

  const shown = MERCH.filter((m) => category === 'All' || m.category === category);
  return (
    <div>
      <h1 ref={heading} tabIndex={-1} className="text-xl outline-none">Merch</h1>
      <p className="mb-3 text-body-sm text-muted">{MERCH.length} pieces from the FaZe Clan shop. Select an item to see details and continue through a demo checkout. Earn {fmt(POINTS_PER_BLOCK)} points for every $10 you spend, and add a signature for {fmt(SIGNATURE_POINTS)} points.</p>
      <div role="group" aria-label="Filter by category" className="mb-4 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => <Pill key={c} pressed={category === c} onClick={() => setCategory(c)}>{c}</Pill>)}
      </div>
      <p className="sr-only" aria-live="polite">{shown.length} items shown</p>
      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4 p-0">
        {shown.map((m) => (
          <li key={m.id} className="frame grid content-start gap-2 p-3">
            <Tile item={m} />
            <h2 className="text-base normal-case" style={{ fontFamily: 'var(--font-sans)', fontWeight: 700 }}>{m.name}</h2>
            <div className="font-display text-lg uppercase"><Price item={m} /></div>
            <Button className="w-full" variant={m.soldOut ? 'secondary' : 'primary'} aria-label={`View ${m.name}`} onClick={() => open(m)}>View item</Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
