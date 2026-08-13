import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { classes, affixes, meta, buildSetKey, accessoryOptions } from './lib/engine';
import { exportBuildCode } from './lib/buildCode';
import { AFFIX_ICONS } from './lib/affixIcons';

// ---- Icon assets (copied from the repo-root /icons folder) ----
import AmethystIcon from './assets/icons/Amethyst.png';
import BootsIcon from './assets/icons/Boots.png';
import ChestIcon from './assets/icons/Chest.png';
import GlovesIcon from './assets/icons/Gloves.png';
import HeadIcon from './assets/icons/Head.png';
import MoonstoneIcon from './assets/icons/Moonstone.png';
import NecklaceIcon from './assets/icons/Necklace.png';
import OnyxIcon from './assets/icons/Onyx.png';
import PantsIcon from './assets/icons/Pants.png';
import PeridotIcon from './assets/icons/Peridot.png';
import RingIcon from './assets/icons/Ring.png';
import WeaponIcon from './assets/icons/Weapon.png';
import KoFiLogo from './assets/icons/logomarkLogo.webp';
import ChevronDown from './assets/icons/ChevronDown.svg';
import ChevronRight from './assets/icons/ChevronRight.svg';
import CopyIcon from './assets/icons/copy.svg';
import CheckIcon from './assets/icons/check.svg';
import AlertIcon from './assets/icons/alert.svg';
import InfoSvg from './assets/icons/info.svg';

// ----------------------------------------------------------------
//  CONFIG — fill in your Twitch channel and Ko-fi username/page
// ----------------------------------------------------------------
const SITE = {
  twitchChannel: 'squigle8', // just the channel name — no https://, no www, no .tv
  kofi: 'squigle',            // just the username -> ko-fi.com/<this>
  discordInvite: 'https://discord.gg/bXuR4Eh2DV'
};

// Feedback goes to your Discord channel via a webhook.
// Create one: Server Settings -> Integrations -> Webhooks -> New Webhook -> Copy URL.
const FEEDBACK = {
  discordWebhook: 'https://discord.com/api/webhooks/1535730379770564691/8CVliAd6wLMxxXbJzLIhjUvA_k89T_OtvYGm6h1BDEEfEofrMW1qCj0xi5FDA0uQpLM2'
};

const COLORS = {
  bg: '#0c0d11', bgAlt: '#14151c', card: '#1a1b23', border: '#2a2b36',
  primary: '#c9a54a', primaryDark: '#a8842f', text: '#f3f4f6', textMuted: '#b9c0cc',
  offensive: '#fca5a5', defensive: '#7dd3fc', utility: '#fcd34d', danger: '#f87171'
};

// Max combined affix level across a build (gear + gems + wine buffer).
const MAX_AFFIX_BUDGET = 40;

const RARITY_COLORS = {
  'Common': '#4ade80', 'Rare': '#3b82f6', 'Excellent': '#a855f7', 'Epic': '#ec4899', 'Legendary': '#f59e0b', 'Holy': '#ef4444'
};

// Gem shape -> player-facing gem name. The data keeps the real shape names
// (Octagon/Rectangle/...); we only translate them for display.
const GEM_NAMES = {
  Octagon: 'Peridot', Rectangle: 'Onyx', Triangle: 'Amethyst',
  Square: 'Moonstone', Circle: 'All Gems', 'Circle/Swirl': 'All Gems'
};
const GEM_ICONS = {
  Peridot: PeridotIcon, Onyx: OnyxIcon, Amethyst: AmethystIcon, Moonstone: MoonstoneIcon
};
// Every slot now has an icon; all weapon slots share the Weapon icon.
const SLOT_ICONS = {
  Head: HeadIcon, Chest: ChestIcon, Gloves: GlovesIcon, Pants: PantsIcon, Boots: BootsIcon,
  Ring: RingIcon, Necklace: NecklaceIcon,
  // All weapon slot types share the Weapon icon.
  Weapon: WeaponIcon, Mace: WeaponIcon, Catalyst: WeaponIcon,
  Bow: WeaponIcon, Staff: WeaponIcon, Hammer: WeaponIcon, Dagger: WeaponIcon,
  Greatsword: WeaponIcon, 'Sword and Shield': WeaponIcon,
  'Dual Blades': WeaponIcon, 'Polearm and Shield': WeaponIcon
};

function gemName(shape) { return GEM_NAMES[shape] || shape || '?'; }
function gemIcon(shape) { return GEM_ICONS[gemName(shape)] || null; }
function slotIcon(slot) { return SLOT_ICONS[slot] || null; }

function raritySummary(slots) {
  const m = {};
  for (const s of slots || []) if (s && s.rarity) m[s.rarity] = (m[s.rarity] || 0) + 1;
  return Object.entries(m).map(([r, c]) => r + ' ×' + c).join(' · ');
}


function InfoIcon({ color = 'rgb(243, 244, 246)' }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
      <path d="M12 16V12M12 8H12.01M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FilterDropdown({ label, value, options, onSelect, open, onOpen, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  const [tipEl, setTipEl] = useState(null); // { hint, x, y } for the info tooltip portal
  const [hov, setHov] = useState(null);        // hovered option value for whole-row select cue
  const sel = options.find(o => o.value === value) || options[0];

  return (
    <div ref={ref} style={{ position: 'relative', minWidth: '220px' }}>
      <button onClick={() => (open ? onClose() : onOpen())} aria-expanded={open}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', width: '100%', padding: '8px 12px', borderRadius: '8px',
          border: '1px solid ' + COLORS.border, backgroundColor: COLORS.bgAlt, color: COLORS.text, fontSize: '14px', cursor: 'pointer', textAlign: 'left' }}>
        <span><strong style={{ color: COLORS.primary }}>{label}:</strong> <span style={{ color: sel ? (sel.color || COLORS.text) : COLORS.text }}>{sel ? sel.name : 'All'}</span></span>
        <img src={ChevronDown} alt={open ? 'Close' : 'Open'} style={{ width: 16, height: 16, flex: '0 0 auto', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, zIndex: 30, maxHeight: '280px', overflowY: 'auto',
          backgroundColor: COLORS.card, border: '1px solid ' + COLORS.border, borderRadius: '8px', boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)' }}>
          {options.map(o => {
            const active = o.value === value;
            return (
              <div key={o.value} onClick={() => { if (!o.disabled) { onSelect(o.value); onClose(); } }}
                onMouseEnter={() => setHov(o.value)}
                onMouseLeave={() => setHov(null)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', width: '100%', textAlign: 'left', padding: '8px 12px', border: 'none', borderBottom: '1px solid ' + COLORS.border, cursor: o.disabled ? 'not-allowed' : 'pointer',
                  backgroundColor: active ? '#2a2320' : hov === o.value ? (o.disabled ? 'transparent' : 'rgba(201, 165, 74, 0.12)') : 'transparent', color: COLORS.text, fontSize: '14px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '0', opacity: o.disabled ? 0.45 : 1 }}>
                  <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: o.color || COLORS.text }}>{o.name}</span>
                  {o.rarity ? <span style={{ flex: '0 0 auto', fontSize: '11px', color: o.color || COLORS.text, border: '1px solid ' + (o.color || COLORS.border), borderRadius: '4px', padding: '1px 6px' }}>{o.rarity}</span> : null}
                </span>
                {o.disabled && o.hint ? (
                  <span role="img" aria-label={o.hint} tabIndex={0}
                    onClick={(e) => e.stopPropagation()}
                    onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setTipEl({ hint: o.hint, x: r.right + 8, y: r.top + r.height / 2 }); }}
                    onMouseLeave={() => setTipEl(null)}
                    onFocus={(e) => { const r = e.currentTarget.getBoundingClientRect(); setTipEl({ hint: o.hint, x: r.right + 8, y: r.top + r.height / 2 }); }}
                    onBlur={() => setTipEl(null)}
                    style={{ flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'help', paddingLeft: '8px', color: 'rgb(243, 244, 246)' }}>
                    <InfoIcon color="rgb(243, 244, 246)" />
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
      {tipEl && createPortal(
        <span role="tooltip" style={{ position: 'fixed', left: tipEl.x, top: tipEl.y, transform: 'translateY(-50%)', zIndex: 1000, maxWidth: '260px', background: COLORS.card, border: '1px solid ' + COLORS.border, borderRadius: '8px', padding: '8px 12px', fontSize: '12px', lineHeight: '1.4', color: COLORS.text, boxShadow: '0 8px 24px rgba(0,0,0,0.45)', pointerEvents: 'none', whiteSpace: 'normal', textAlign: 'left' }}>
          {tipEl.hint}
        </span>,
        document.body
      )}
    </div>
  );
}


function ClearAllFilters({ onClick, style }) {
  return (
    <button type="button" onClick={onClick}
      style={Object.assign({ background: 'transparent', border: 'none', padding: '0', color: COLORS.primary, fontSize: '14px', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer', whiteSpace: 'nowrap' }, style || {})}>
      Clear all Filters
    </button>
  );
}

function App() {
  const [selectedClass, setSelectedClass] = useState(null);
  const [weapon, setWeapon] = useState(null);
  const [selected, setSelected] = useState({}); // affix -> level
  const [builds, setBuilds] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('All');
  const [buildCount, setBuildCount] = useState(2); // builds shown initially (more on demand)
  const [openBuilds, setOpenBuilds] = useState({}); // accordion: which build cards are expanded (default: all open)
  const [budgetNotice, setBudgetNotice] = useState(null); // shown when adding an affix at max budget
  const [ringFilter, setRingFilter] = useState('all');   // post-build Ring accessory filter
  const [neckFilter, setNeckFilter] = useState('all');   // post-build Necklace accessory filter
  const [openFilter, setOpenFilter] = useState(null);    // which accessory dropdown is open: 'ring' | 'neck' | null
  const [rarityPref, setRarityPref] = useState({});          // optional per-slot rarity filter (slot -> rarity)
  const [forcedAcc, setForcedAcc] = useState({});            // pre-generation specific Ring/Necklace selection (slot -> gear name)
  const [extra, setExtra] = useState([]);                      // builds generated on-demand by Show more
  const [moreBusy, setMoreBusy] = useState(false);             // a 'more' search is in flight
  const [noMore, setNoMore] = useState(false);                 // engine reports no further builds
  const [codeStatus, setCodeStatus] = useState('');              // build-code copy feedback
  const [copiedIndex, setCopiedIndex] = useState(null);        // which build card's Copy button shows "Copied code"


  // Feedback report (per gear slot -> Discord webhook)
  const [feedbackCtx, setFeedbackCtx] = useState(null); // null = closed
  const [fType, setFType] = useState('Wrong gear');
  const [fNote, setFNote] = useState('');
  const [fHp, setFHp] = useState('');                 // honeypot (anti-spam)
  const [fStatus, setFStatus] = useState(null);      // 'sending' | 'ok' | 'error' | 'config'

  const openFeedback = (b, p, i) => {
    setFeedbackCtx({
      className: builds.className, weapon: builds.weapon,
      option: i === 0 ? 'Cheapest Build' : 'Option ' + (i + 1),
      slot: p.slot, gear: p.gear, rarity: p.rarity, builtIn: p.built_in_affix,
      sockets: p.sockets || [], gems: p.gems || [],
      affixes: builds.targetAffixes || [], cost: b.cost
    });
    setFType('Wrong gear'); setFNote(''); setFStatus(null);
  };

  const openGenericFeedback = () => {
    setFeedbackCtx({
      className: builds ? builds.className : null, weapon: builds ? builds.weapon : null,
      option: null, slot: 'General', gear: null, rarity: null, builtIn: null,
      sockets: [], gems: [], affixes: builds ? builds.targetAffixes : [], cost: null
    });
    setFType('Other'); setFNote(''); setFStatus(null);
  };

  const closeFeedback = () => setFeedbackCtx(null);

  async function submitFeedback(e) {
    e.preventDefault();
    if (fHp) { setFStatus('ok'); return; } // bot trap: pretend it worked, send nothing
    const url = FEEDBACK.discordWebhook;
    if (!url || url === 'YOUR_DISCORD_WEBHOOK_URL') { setFStatus('config'); return; }
    setFStatus('sending');
    const c = feedbackCtx || {};
    const gemsTxt = (c.sockets || []).map((s, i) => {
      const g = (c.gems || [])[i];
      return gemName(s.shape) + (s.tier === 2 ? ' T2' : '') + (g ? ': ' + [g.affix1, g.affix2].filter(Boolean).join(' + ') : ' (empty)');
    }).join(', ') || 'None';
    const embed = {
      title: '⚠️ Build Issue Report',
      color: 16733525,
      fields: [
        { name: 'Class / Weapon', value: `${c.className || '—'} · ${c.weapon || '—'}`, inline: true },
        { name: 'Option', value: `${c.option || '—'}`, inline: true },
        { name: 'Slot', value: `${c.slot || '—'}`, inline: true },
        { name: 'Gear', value: (c.gear || '—') + (c.rarity ? ` [${c.rarity}]` : ''), inline: true },
        { name: 'Built-in affix', value: c.builtIn || '—', inline: true },
        { name: 'Sockets / Gems', value: (gemsTxt || '—').slice(0, 1024) },
        { name: 'Target affixes', value: ((c.affixes || []).map(a => a.affix + ' Lv' + a.level).join(', ') || '—').slice(0, 1024) },
        { name: 'Recommended cost', value: (c.cost != null ? c.cost + 'g' : '—'), inline: true },
        { name: 'Issue type', value: fType, inline: true },
        { name: 'Note from user', value: (fNote || '—').slice(0, 1024) }
      ],
      footer: { text: 'mistfallcalc.com · ' + new Date().toISOString() }
    };
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'Mistfall Build Feedback', embeds: [embed] })
      });
      if (res.ok) {
        setFStatus('ok');
        setTimeout(closeFeedback, 1600);
      } else setFStatus('error');
    } catch (err) { setFStatus('error'); }
  }

  // The engine runs fully in the browser — no server calls.
  const weaponOptions = (meta.weaponsByClass && selectedClass && meta.weaponsByClass[selectedClass.name]) || [];

  // Clear target affixes + builds when class or weapon changes
  useEffect(() => { setSelected({}); setBuilds(null); setOpenBuilds({}); setRingFilter('all'); setNeckFilter('all'); setOpenFilter(null); setRarityPref({}); setForcedAcc({}); setExtra([]); setNoMore(false); setMoreBusy(false); }, [selectedClass, weapon]);

  // Reset the chosen weapon whenever a new class is picked (forces an explicit Step 2 choice).
  useEffect(() => { setWeapon(null); }, [selectedClass]);

  // Auto-select the (single) weapon for classes with only one option (Sorcerer,
  // Blackarrow) so the user lands straight on Step 3. Runs after the reset above.
  useEffect(() => {
    if (!selectedClass) return;
    const opts = (meta.weaponsByClass && meta.weaponsByClass[selectedClass.name]) || [];
    if (opts.length === 1) setWeapon(opts[0]);
  }, [selectedClass]);

  const reachable = meta.reachable ? (meta.reachable[selectedClass ? selectedClass.name + '-' + weapon : ''] || []) : [];
  const reachableSet = new Set(reachable);

  const combined = Object.values(selected).reduce((a, b) => a + b, 0);
  const overBudget = combined > MAX_AFFIX_BUDGET;

  // Per-affix max level from affixes.json (e.g. [4,5] -> 5, [5,7] -> 7).
  const affixMaxMap = {};
  affixes.forEach(a => {
    affixMaxMap[a.name] = Array.isArray(a.level) && a.level.length ? a.level[a.level.length - 1] : MAX_AFFIX_BUDGET;
  });

  function toggleAffix(name) {
    // Budget guard: can't add a NEW affix when already at the max combined level.
    if (!(name in selected) && combined + 1 > MAX_AFFIX_BUDGET) {
      setBudgetNotice('Budget full (' + combined + '/' + MAX_AFFIX_BUDGET + ') — lower an existing affix first (use −) before adding another.');
      return;
    }
    setBudgetNotice(null);
    setSelected(prev => {
      const next = { ...prev };
      if (name in next) delete next[name];
      else next[name] = 1;
      return next;
    });
    setBuilds(null);
  }

  function setLevel(name, lvl) {
    setBudgetNotice(null);
    setSelected(prev => {
      const others = Object.entries(prev).filter(([k]) => k !== name).reduce((a, [k, v]) => a + v, 0);
      const maxLvl = affixMaxMap[name] || MAX_AFFIX_BUDGET;
      const clamp = Math.max(1, Math.min(lvl, maxLvl));
      return { ...prev, [name]: Math.min(clamp, maxLvl, MAX_AFFIX_BUDGET - others) };
    });
    setBuilds(null);
  }

  function resetAffixes() {
    if (Object.keys(selected).length === 0) return;
    setBudgetNotice(null);
    setSelected({});
    setBuilds(null);
    setOpenFilter(null);
  }


// Build engine runs in a Web Worker so the UI never freezes during the solve.
  const workerRef = useRef(null);
  useEffect(() => {
    const w = new Worker(new URL('./lib/buildWorker.js', import.meta.url), { type: 'module' });
    workerRef.current = w;
    w.onmessage = (e) => {
      const { ok, result, error, type } = e.data || {};
      if (type === 'more') {
        setMoreBusy(false);
        if (ok && result && result.builds && result.builds.length) {
          setExtra(prev => [...prev, ...result.builds]);
          setBuildCount(c => c + result.builds.length);
        } else if (ok) {
          setNoMore(true);
        } else {
          setNoMore(true); setError(error || 'Could not generate more builds.');
        }
        return;
      }
      setLoading(false);
      if (ok) { setBuilds(result); setBuildCount(2); setOpenBuilds({}); setRingFilter('all'); setNeckFilter('all'); setOpenFilter(null); setExtra([]); setNoMore(false); }
      else { setError(error || 'Could not generate builds.'); }
    };
    w.onerror = (err) => { setLoading(false); setError('Build engine failed to start: ' + (err.message || 'worker error')); };
    return () => w.terminate();
  }, []);

  function showMoreBuilds() {
    if (!selectedClass || moreBusy || loading) return;
    setError(null);
    if (buildCount < visibleBuilds.length) { setBuildCount(c => c + 5); return; }
    if (noMore) return;
    setMoreBusy(true);
    const all = baseBuilds.concat(extra);
    const seen = all.map(b => buildSetKey(b.slots));
    let minCost = 0;
    for (const b of all) if (b.cost > minCost) minCost = b.cost;
    workerRef.current.postMessage({
      type: 'more',
      className: selectedClass.name,
      weapon,
      wine: null,
      targets: Object.entries(selected).map(([affix, level]) => ({ affix, level })),
      rarityPref,
      forcedAccessories: forcedAcc,
      seenKeys: seen,
      minCost
    });
  }

  function copyBuildCode(b, idx) {
    if (!b) return;
    const payload = {
      className: builds.className,
      weapon: builds.weapon,
      targets: builds.targetAffixes || [],
      cost: b.cost,
      slots: b.slots.map(s => ({ slot: s.slot, gear: s.gear, rarity: s.rarity, built_in_affix: s.built_in_affix, sockets: s.sockets || [], gems: s.gems || [] }))
    };
    exportBuildCode(payload)
      .then(r => {
        if (!r.code) throw new Error('No code returned');
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(r.code);
        setCopiedIndex(idx);
        setCodeStatus('');
        setTimeout(() => setCopiedIndex(prev => (prev === idx ? null : prev)), 2500);
      })
      .catch(err => setCodeStatus('Code error: ' + ((err && err.message) || err)));
  }

  function generateBuilds() {
    if (!selectedClass || Object.keys(selected).length === 0 || overBudget || loading) return;
    setLoading(true); setError(null);
    if (!workerRef.current) {
      setLoading(false);
      setError('Build engine isn’t ready yet — try again in a second.');
      return;
    }
    workerRef.current.postMessage({
      className: selectedClass.name,
      weapon,
      wine: null,
      targets: Object.entries(selected).map(([affix, level]) => ({ affix, level })),
      rarityPref,
      forcedAccessories: forcedAcc
    });
  }

  const filteredAffixes = affixes.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) &&
    (groupFilter === 'All' || a.group === groupFilter)
  );

  const groupColor = g => g === 'Offensive' ? COLORS.offensive : g === 'Defensive' ? COLORS.defensive : COLORS.utility;
  const classHasData = cls => !!cls && !!(meta.complete && meta.complete[cls.name]);
  const cs = selectedClass ? !classHasData(selectedClass) : true;
  const weaponLabel = w => (w === 'Weapon' && selectedClass ? (selectedClass.weapon || 'Weapon') : w);
  // ---- Post-build Ring / Necklace accessory filters ----
  const baseBuilds = builds && builds.builds ? builds.builds : [];
  const buildResults = baseBuilds.concat(extra);
  const slotGear = (b, slot) => {
    const s = (b.slots || []).find(x => x.slot === slot);
    return s && s.gear ? s.gear : null;
  };
  const ringMatches = (b, v) => {
    if (v === 'all') return true;
    const g = slotGear(b, 'Ring');
    if (v === '__none__') return !g;
    return g === v;
  };
  const neckMatches = (b, v) => {
    if (v === 'all') return true;
    const g = slotGear(b, 'Necklace');
    if (v === '__none__') return !g;
    return g === v;
  };

  const ringOptions = [];
  const neckOptions = [];
  if (buildResults.length) {
    const rset = new Set();
    const nset = new Set();
    let noRing = false;
    let noNeck = false;
    for (const b of buildResults) {
      const r = slotGear(b, 'Ring');
      const n = slotGear(b, 'Necklace');
      if (r) rset.add(r); else noRing = true;
      if (n) nset.add(n); else noNeck = true;
    }
    ringOptions.push({ value: 'all', name: 'All' });
    [...rset].sort().forEach(n => ringOptions.push({ value: n, name: n }));
    if (noRing) ringOptions.push({ value: '__none__', name: 'None — no ring' });
    neckOptions.push({ value: 'all', name: 'All' });
    [...nset].sort().forEach(n => neckOptions.push({ value: n, name: n }));
    if (noNeck) neckOptions.push({ value: '__none__', name: 'None — no necklace' });
  }
  const FILTER_HINT = 'No existing build with the combination of filters';
  const ringFilterOpts = ringOptions.map(o => {
    const disabled = o.value !== 'all' && !buildResults.some(b => ringMatches(b, o.value) && neckMatches(b, neckFilter));
    return { ...o, disabled, hint: disabled ? FILTER_HINT : null };
  });
  const neckFilterOpts = neckOptions.map(o => {
    const disabled = o.value !== 'all' && !buildResults.some(b => neckMatches(b, o.value) && ringMatches(b, ringFilter));
    return { ...o, disabled, hint: disabled ? FILTER_HINT : null };
  });
  const visibleBuilds = buildResults.filter(b => ringMatches(b, ringFilter) && neckMatches(b, neckFilter));

  // ---- Pre-generation Ring / Necklace selectors ----
  const ACC_OPTS = accessoryOptions();
  const accOptions = (slot) => {
    const rp = rarityPref[slot];
    const rows = (ACC_OPTS[slot] || []).filter(o => !rp || o.rarity === rp);
    return [{ value: 'all', name: 'Any ' + slot }, ...rows.map(o => ({ value: o.gear + '\u0000' + o.rarity, gear: o.gear, rarity: o.rarity, name: o.gear, color: RARITY_COLORS[o.rarity] || COLORS.text }))];
  };
  const ringAccOpts = accOptions('Ring');
  const neckAccOpts = accOptions('Necklace');
  const pickAcc = (slot, value) => {
    if (!value) { setForcedAcc(pv => ({ ...pv, [slot]: null })); setRarityPref(pv => ({ ...pv, [slot]: null })); return; }
    const list = slot === 'Ring' ? ringAccOpts : neckAccOpts;
    const o = list.find(x => x.gear === value);
    setForcedAcc(pv => ({ ...pv, [slot]: o ? o.gear : null }));
    if (o) setRarityPref(pv => ({ ...pv, [slot]: o.rarity }));
  };


  // Deep-link support: the static class pages (frontend/public/*-build-calculator/)
  // link in as /?class=mercenary, /?class=sorcerer, ... so the class is preselected.
  useEffect(() => {
    const wanted = (new URLSearchParams(window.location.search).get('class') || '').toLowerCase();
    if (!wanted) return;
    const match = classes.find(c => c.slug === wanted || c.name.toLowerCase() === wanted);
    if (match && classHasData(match)) setSelectedClass(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function gemLabel(slot, gem) {
    if (!gem) return null;
    const afx = [gem.affix1, gem.affix2].filter(Boolean).join(' + ');
    const tier = slot.tier === 2 ? ' T2' : '';
    const isAll = slot.shape === 'Circle' || slot.shape === 'Circle/Swirl';
    const shape = (gem && gem.shape) || slot.shape;
    const name = gemName(shape);
    const icon = gemIcon(shape);
    const label = (isAll ? '(All gems) ' : '') + name + tier;
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: COLORS.bgAlt, borderRadius: '8px', padding: '8px 12px', fontSize: '16px', margin: '0' }}>
        {icon && <img src={icon} alt={name} style={{ width: 20, height: 20 }} />}
        <span>{label}: <strong style={{ fontWeight: 600 }}>{afx}</strong></span>
      </span>
    );
  }

  // Secondary weapon = the class's OTHER weapon type (not the one chosen in Step 2).
  const secondaryWeapon = weaponOptions.length > 1 ? weaponOptions.find(w => w !== weapon) : null;
  const secondaryActive = !!(secondaryWeapon && rarityPref[secondaryWeapon]);

  function slotLabel(p) {
    const built = p.built_in_affix ? ' (' + p.built_in_affix + ')' : '';
    const gems = (p.sockets || []).map((s, i) => {
      const gem = (p.gems || [])[i];
      if (gem) return <span key={i} style={{ display: 'inline-flex' }}>{gemLabel(s, gem)}</span>;
      const tt = s.tier === 2 ? ' T2' : '';
      return (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', border: '1px dashed ' + COLORS.border, borderRadius: '8px', padding: '8px 12px', fontSize: '16px', color: COLORS.textMuted }}>
          {gemName(s.shape)}{tt}: <strong style={{ fontWeight: 600, color: COLORS.text }}>empty</strong>
        </span>
      );
    });
    const icon = slotIcon(p.slot);
    const isSecondary = secondaryActive && p.slot === secondaryWeapon;
    return (
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          {icon && <img src={icon} alt={p.slot} style={{ width: 20, height: 20 }} />}
          <span>
            {p.slot}: <strong>{p.gear}</strong>{' '}
            <span style={{ color: RARITY_COLORS[p.rarity] || COLORS.textMuted }}>[{p.rarity}]</span>{built}
          </span>
        </span>
        {isSecondary ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: COLORS.textMuted, marginTop: '2px' }}>
            <img src={InfoSvg} alt="" style={{ width: 16, height: 16, flex: '0 0 auto' }} />
            <span>Gems are not calculated for the secondary weapon</span>
          </span>
        ) : (
          gems.length > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>{gems}</span>
        )}
      </span>
    );
  }

  // Twitch embed parent must match the deployed hostname; localhost works locally.
  const twitchSrc = SITE.twitchChannel && SITE.twitchChannel !== 'YOUR_TWITCH_CHANNEL'
    ? `https://player.twitch.tv/?channel=${SITE.twitchChannel}&parent=${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}&muted=false&autoplay=true`
    : null;
  const kofiHref = SITE.kofi && SITE.kofi !== 'YOUR_KOFI_USERNAME' ? `https://ko-fi.com/${SITE.kofi}` : null;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: COLORS.bg, color: COLORS.text }}>
      <style>{`@keyframes mc-spin { to { transform: rotate(360deg); } }
.mc-spinner { display: inline-block; width: 20px; height: 20px; border: 3px solid #2a2b36; border-top-color: #c9a54a; border-radius: 50%; animation: mc-spin 0.8s linear infinite; }`}</style>
      <header style={{ borderBottom: '1px solid ' + COLORS.border, padding: '20px 28px', backgroundColor: COLORS.bgAlt }}>
        <h1 style={{ color: COLORS.primary, fontSize: '24px', fontWeight: 'bold' }}>Mistfall Hunter Build Calculator</h1>
        <p style={{ color: COLORS.textMuted, fontSize: '16px', marginTop: '8px' }}>
          Pick a class, choose a weapon, and select affix levels (max {MAX_AFFIX_BUDGET} combined) to find a gear + gem loadout.
        </p>
      </header>

      <div style={{ maxWidth: '1320px', margin: '0 auto', padding: '28px', display: 'flex', gap: '28px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* MAIN CALCULATOR */}
        <main style={{ flex: '1 1 620px', minWidth: '0' }}>
          {error && <div style={{ backgroundColor: '#7f1d1d', padding: '12px', borderRadius: '8px', marginBottom: '16px', color: '#fecaca' }}>{error}</div>}

          {/* Step 1: Class */}
          <section style={{ marginBottom: '36px' }}>
            <h2 style={{ color: COLORS.primary, fontSize: '20px', marginBottom: '16px' }}>Step 1: Choose Your Class</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
              {classes.map(cls => {
                const comingSoon = !classHasData(cls);
                const active = selectedClass && selectedClass.slug === cls.slug;
                return (
                  <button key={cls.slug} disabled={comingSoon} onClick={() => setSelectedClass(cls)}
                    style={{ color: COLORS.text, opacity: comingSoon ? 0.6 : 1, padding: '12px', borderRadius: '8px', cursor: comingSoon ? 'not-allowed' : 'pointer', textAlign: 'left',
                      border: '2px solid ' + (active ? COLORS.primary : COLORS.border), backgroundColor: active ? '#2a2320' : COLORS.card }}>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: COLORS.text }}>{cls.name}</div>
                    <div style={{ fontSize: '16px', color: COLORS.textMuted, marginTop: '8px' }}>{cls.role} · {cls.weapon}</div>
                    {comingSoon && <span style={{ color: COLORS.danger, fontWeight: 'bold', fontSize: '12px' }}>⏳ Coming Soon</span>}
                  </button>
                );
              })}
            </div>
          </section>

          {selectedClass && (
            <section style={{ marginBottom: '24px' }}>
              <h2 style={{ color: COLORS.primary, fontSize: '20px', marginBottom: '16px' }}>Step 2: Choose a Weapon ({selectedClass.name})</h2>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {weaponOptions.map(w => {
                    const active = weapon === w;
                    return (
                      <button key={w} disabled={cs} onClick={() => setWeapon(w)}
                        style={{ color: COLORS.text, fontWeight: '600', opacity: cs ? 0.6 : 1, padding: '12px 20px', borderRadius: '8px', cursor: cs ? 'not-allowed' : 'pointer', fontSize: '16px',
                          border: '2px solid ' + (active ? COLORS.primary : COLORS.border), backgroundColor: active ? '#2a2320' : COLORS.card }}>
                        {weaponLabel(w)}
                      </button>
                    );
                  })}
              </div>
            </section>
          )}

          {selectedClass && !cs && weapon && (
            <section style={{ marginBottom: '36px' }}>
              <h2 style={{ color: COLORS.primary, fontSize: '20px', marginBottom: '16px' }}>Step 3: Select Affixes &amp; Levels (max {MAX_AFFIX_BUDGET})</h2>
              <input type="text" placeholder="Search affixes..." value={search} onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid ' + COLORS.border, backgroundColor: COLORS.bgAlt, color: COLORS.text, marginBottom: '16px' }} />
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                {['All', 'Defensive', 'Offensive', 'Utility'].map(g => {
                  const active = groupFilter === g;
                  const col = g === 'Defensive' ? COLORS.defensive : g === 'Offensive' ? COLORS.offensive : g === 'Utility' ? COLORS.utility : COLORS.primary;
                  return <button key={g} onClick={() => setGroupFilter(g)} style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '16px', cursor: 'pointer',
                    border: '1px solid ' + (active ? col : COLORS.border), backgroundColor: active ? col + '22' : COLORS.bgAlt, color: active ? col : COLORS.textMuted, fontWeight: active ? 'bold' : 'normal' }}>{g}</button>;
                })}
              </div>

              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
                <strong style={{ color: overBudget ? COLORS.danger : COLORS.text }}>Combined level: {combined} / {MAX_AFFIX_BUDGET}</strong>
                <button onClick={resetAffixes} disabled={combined === 0} title="Clear all chosen affixes"
                  style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid ' + COLORS.border, backgroundColor: COLORS.bgAlt, color: COLORS.textMuted, fontSize: '14px', fontWeight: 'bold', cursor: combined === 0 ? 'not-allowed' : 'pointer', opacity: combined === 0 ? 0.5 : 1 }}>↺ Reset</button>

                {overBudget && <span style={{ color: COLORS.danger, fontWeight: 'bold' }}>(over budget — lower a level)</span>}
              </div>
              {budgetNotice && (
                <div style={{ backgroundColor: COLORS.danger + '1f', border: '1px solid ' + COLORS.danger, color: COLORS.danger, borderRadius: '8px', padding: '12px 16px', fontSize: '16px', marginBottom: '16px' }}>
                  ⚠ {budgetNotice}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '12px' }}>
                {filteredAffixes.map(affix => {
                  const reachable_ = true; // wine can grant any affix
                  const sel = (affix.name in selected);
                  const col = groupColor(affix.group);
                  const hasPassive = Array.isArray(affix.level) && affix.level.length === 2;
                  const maxLvl = Array.isArray(affix.level) ? affix.level[affix.level.length - 1] : null;
                  const aMax = affixMaxMap[affix.name] || MAX_AFFIX_BUDGET;
                  const cur = sel ? selected[affix.name] : 0;
                  return (
                    <button key={affix.slug} disabled={!reachable_}
                      onClick={() => reachable_ && toggleAffix(affix.name)}
                      style={{ color: COLORS.text, opacity: reachable_ ? 1 : 0.5, height: '212px', padding: '16px', borderRadius: '8px', textAlign: 'left', display: 'flex', flexDirection: 'column', overflow: 'hidden',
                        border: '2px solid ' + (sel ? col : COLORS.border), backgroundColor: sel ? '#1d2430' : COLORS.card, cursor: reachable_ ? 'pointer' : 'not-allowed' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: '0 0 auto' }}>
                        {AFFIX_ICONS[affix.name] && (
                          <img src={AFFIX_ICONS[affix.name]} alt={affix.name + ' icon'} style={{ width: 48, height: 48, flex: '0 0 auto', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px' }} />
                        )}
                        <span style={{ flex: '1 1 auto', minWidth: '0', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 'bold', color: COLORS.text, fontSize: '16px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{affix.name}</span>
                            <span style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '4px', backgroundColor: col + '22', color: col, whiteSpace: 'nowrap' }}>{affix.group}</span>
                          </span>
                          <span title={affix.desc || undefined} style={{ fontSize: '14px', lineHeight: '1.35', opacity: 0.8, color: COLORS.textMuted, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {affix.desc || ''}
                          </span>
                        </span>
                      </div>
                      <div style={{ flex: '1 1 auto', minHeight: '0' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flex: '0 0 auto' }}>
                        <span style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          {!reachable_ && <span style={{ fontSize: '12px', color: COLORS.danger }}>Not reachable with {weapon}</span>}
                          {hasPassive && <span style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '4px', backgroundColor: COLORS.border, color: COLORS.textMuted, fontWeight: 'bold' }}>Recommended Lv {affix.level[0]}</span>}
                        </span>
                        <span style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          {maxLvl && <span style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '4px', backgroundColor: COLORS.border, color: COLORS.textMuted }}>Max Lv {maxLvl}</span>}
                        </span>
                      </div>
                      {sel && (
                        <div style={{ flex: '0 0 auto', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: COLORS.bgAlt, padding: '8px', borderRadius: '8px' }}>
                          <button onClick={(e) => { e.stopPropagation(); setLevel(affix.name, cur - 1); }} disabled={cur <= 1}
                            style={{ borderRadius: 4, border: '1px solid ' + COLORS.border, background: COLORS.card, color: '#ffffff', fontWeight: 'bold', width: 28, height: 28, cursor: 'pointer', opacity: cur <= 1 ? 0.5 : 1 }}>−</button>
                          <span style={{ fontSize: '16px', minWidth: '72px', textAlign: 'center', color: '#ffffff', fontWeight: 'bold' }}>Lv {cur}/{aMax}</span>
                          <button onClick={(e) => { e.stopPropagation(); setLevel(affix.name, cur + 1); }} disabled={cur >= aMax || combined >= MAX_AFFIX_BUDGET}
                            style={{ borderRadius: 4, border: '1px solid ' + COLORS.border, background: COLORS.card, color: '#ffffff', fontWeight: 'bold', width: 28, height: 28, cursor: 'pointer', opacity: (cur >= aMax || combined >= MAX_AFFIX_BUDGET) ? 0.5 : 1 }}>+</button>
                          <button onClick={(e) => { e.stopPropagation(); setLevel(affix.name, aMax); }} disabled={cur >= aMax}
                            style={{ borderRadius: 4, border: '1px solid ' + COLORS.border, background: COLORS.card, color: COLORS.primary, fontSize: '12px', height: 28, padding: '0 8px', cursor: 'pointer', fontWeight: 'bold', opacity: cur >= aMax ? 0.5 : 1 }}>Max</button>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {selectedClass && !cs && Object.keys(selected).length > 0 && !overBudget && (
            <section style={{ marginBottom: '36px' }}>
              <div style={{ marginBottom: '16px' }}>
                <h2 style={{ color: COLORS.primary, fontSize: '20px', marginBottom: '12px' }}>Rarity preference (optional):</h2>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  {['Head', 'Chest', 'Gloves', 'Pants', 'Boots'].concat(weaponOptions).concat(['Ring', 'Necklace']).map(slot => (
                    <label key={slot} style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px', color: COLORS.textMuted }}>
                      {slot === 'Weapon' ? weaponLabel('Weapon') : slot}
                      <select value={rarityPref[slot] || ''} onChange={(e) => { const rv = e.target.value || null; setRarityPref(pv => ({ ...pv, [slot]: rv })); if (slot === 'Ring' || slot === 'Necklace') setForcedAcc(pv => ({ ...pv, [slot]: null })); }}
                        style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid ' + COLORS.border, backgroundColor: COLORS.bgAlt, color: COLORS.text, fontSize: '14px', cursor: 'pointer' }}>
                        <option value="">Any</option>
                        {['Common', 'Rare', 'Epic', 'Legendary'].map(r => (
                          <option key={r} value={r} style={{ color: RARITY_COLORS[r] || COLORS.text }}>{r}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                  <ClearAllFilters onClick={() => setRarityPref({})} style={{ alignSelf: 'flex-end', marginBottom: '10px' }} />
                </div>
              </div>
              <h2 style={{ color: COLORS.primary, fontSize: '20px', marginBottom: '12px' }}>Ring &amp; Necklace selection (optional)</h2>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '16px' }}>
                {['Ring', 'Necklace'].map(slot => {
                  const rows = slot === 'Ring' ? ringAccOpts : neckAccOpts;
                  return (
                    <label key={slot} style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px', color: COLORS.textMuted }}>
                      {slot}
                      <select value={forcedAcc[slot] || ''} onChange={(e) => pickAcc(slot, e.target.value)}
                        style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid ' + COLORS.border, backgroundColor: COLORS.bgAlt, color: COLORS.text, fontSize: '14px', cursor: 'pointer' }}>
                        <option value="">Any</option>
                        {rows.map(o => (
                          <option key={o.value} value={o.gear} style={{ color: o.color || COLORS.text }}>{o.gear}</option>
                        ))}
                      </select>
                    </label>
                  );
                })}
                <ClearAllFilters onClick={() => { setForcedAcc({}); setRarityPref(pv => { const n = { ...pv }; delete n.Ring; delete n.Necklace; return n; }); }} style={{ alignSelf: 'flex-end', marginBottom: '10px' }} />
              </div>
              <button onClick={generateBuilds} disabled={loading}
                style={{ background: COLORS.primary, color: '#000', padding: '12px 24px', borderRadius: '8px', fontWeight: 'bold', fontSize: '16px', border: 'none', cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
                {loading ? 'Finding builds...' : `Generate Build (${Object.keys(selected).length} affixes · ${combined}/${MAX_AFFIX_BUDGET})`}
              </button>
              {loading && (
                <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span className="mc-spinner"></span>
                  <div>
                    <div style={{ color: COLORS.primary, fontWeight: 'bold', fontSize: '16px' }}>Finding the cheapest builds…</div>
                    <div style={{ color: COLORS.textMuted, fontSize: '16px' }}>Full-legendary requests can take a few seconds.</div>
                  </div>
                </div>
              )}
            </section>
          )}

          {builds && builds.error && (
            <div style={{ backgroundColor: '#7f1d1d', padding: '16px', borderRadius: '8px', color: '#fecaca' }}><strong>Build generation failed:</strong> {builds.error}</div>
          )}

          {builds && builds.builds && (
            <section>
              <h2 style={{ color: COLORS.primary, fontSize: '20px', marginBottom: '12px' }}>{builds.className} · {builds.weapon} Builds</h2>
              <p style={{ color: COLORS.textMuted, fontSize: '14px', marginBottom: '16px' }}>
                {builds.combinedLevel}/{MAX_AFFIX_BUDGET} combined · {builds.totalBuilds} found{visibleBuilds.length < builds.builds.length ? ' · showing ' + visibleBuilds.length : ''} · wine: {builds.wine && builds.wine.label ? (builds.wine.label + ' · ' + builds.wine.cost + 'g') : 'none'} · targets: {builds.targetAffixes.map(t => t.affix + ' Lv' + t.level).join(', ')}
              </p>
              {codeStatus && <div style={{ color: COLORS.textMuted, fontSize: '14px', marginBottom: '16px' }}>{codeStatus}</div>}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {visibleBuilds.length === 0 && (
                  <div style={{ color: COLORS.textMuted, fontSize: '16px', padding: '16px', border: '1px dashed ' + COLORS.border, borderRadius: '8px' }}>
                    No builds match the current filters.
                  </div>
                )}

                {visibleBuilds.slice(0, buildCount).map((b, i) => {
                  const isOpen = openBuilds[i] !== false;
                  return (
                    <div key={i} style={{ borderRadius: '8px', border: '1px solid ' + (i === 0 ? COLORS.primary : COLORS.border), backgroundColor: COLORS.card, overflow: 'hidden' }}>
                      <div onClick={() => setOpenBuilds(prev => ({ ...prev, [i]: !isOpen }))}
                        style={{ padding: '12px 20px', backgroundColor: i === 0 ? '#2a2320' : COLORS.bgAlt, display: 'flex', flexDirection: 'column', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                          <strong style={{ flex: '1 1 auto', minWidth: '0', color: i === 0 ? COLORS.primary : COLORS.text }}>{i === 0 ? '🎯 Cheapest Build' : 'Option ' + (i + 1)}</strong>
                          <a href="https://youtu.be/5muPcO9QjuM" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                            style={{ display: 'inline-flex', alignItems: 'flex-start', gap: '6px', fontSize: '14px', color: '#FF484B', textDecoration: 'none', lineHeight: 1.3, maxWidth: '320px' }}>
                            <img src={AlertIcon} alt="" style={{ width: 16, height: 16, flex: '0 0 auto', marginTop: '2px' }} />
                            <span style={{ flex: '1 1 auto', minWidth: '0' }}>If you get a in-game pop up saying "Equipment slot does not match gem" watch this <span style={{ textDecoration: 'underline', fontWeight: 'bold', color: '#3b82f6', cursor: 'pointer' }}>video</span>.</span>
                          </a>
                          <button onClick={(e) => { e.stopPropagation(); copyBuildCode(b, i); }} title="Copy this build as a game share code"
                            style={{ flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: COLORS.primary, fontSize: '14px', fontWeight: 'bold', padding: '8px 12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            <img src={copiedIndex === i ? CheckIcon : CopyIcon} alt="" style={{ width: 16, height: 16 }} /> {copiedIndex === i ? 'Copied code' : 'Copy code'}
                          </button>
                          <img src={isOpen ? ChevronDown : ChevronRight} alt={isOpen ? 'Collapse build' : 'Expand build'} style={{ flex: '0 0 auto', width: 24, height: 24 }} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '12px', color: COLORS.textMuted, backgroundColor: COLORS.bg, border: '1px solid ' + COLORS.border, borderRadius: '4px', padding: '4px 8px' }}>{raritySummary(b.slots)}</span>
                          <span style={{ flex: '1 1 auto', minWidth: '0', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ color: COLORS.text, fontWeight: 'bold', fontSize: '14px' }}>💠 Average market price: {b.cost}g · {b.wine ? ('🍷 ' + b.wine + (b.wineCost ? ' +' + b.wineCost + 'g' : ' (free)')) : 'no wine'}</span>
                          </span>
                        </div>
                      </div>
                      {isOpen && (
                        <>
                          {b.capacityWarnings && b.capacityWarnings.length > 0 && (
                            <div style={{ padding: '8px 20px', backgroundColor: COLORS.danger + '22', color: COLORS.danger, fontSize: '16px' }}>
                              ⚠ {b.capacityWarnings.join(' · ')}
                            </div>
                          )}
                          {b.wine && b.wineGrants && Object.keys(b.wineGrants).length > 0 && (
                            <div style={{ padding: '12px 16px', fontSize: '14px', color: COLORS.primary, backgroundColor: COLORS.bgAlt }}>
                              🍷 <span style={{ fontWeight: 600 }}>{b.wine} grants: </span>{Object.entries(b.wineGrants).map(([a, n]) => a + ' +' + n).join(', ') }
                            </div>
                          )}
                          <div style={{ padding: '12px 16px' }}>
                            {b.slots.map((p, j) => (
                              <div key={j} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', fontSize: '16px', padding: '12px 0', borderBottom: j < b.slots.length - 1 ? '1px solid ' + COLORS.border : 'none' }}>
                                <span style={{ flex: '1 1 auto', minWidth: '0' }}>{slotLabel(p)}</span>
                                <button onClick={() => openFeedback(b, p, i)} title="Report an issue with this gear slot"
                                  style={{ flex: '0 0 auto', background: 'transparent', border: '1px solid ' + COLORS.border, borderRadius: '8px', color: COLORS.textMuted, fontSize: '14px', padding: '4px 8px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                  ⚠️ Report
                                </button>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
                {visibleBuilds.length > 0 && (
                  <div style={{ marginTop: '16px', width: '100%' }}>
                    <button onClick={showMoreBuilds}
                      disabled={moreBusy || loading || (buildCount >= visibleBuilds.length && noMore)}
                      style={{ width: '100%', padding: '12px', borderRadius: '8px', background: COLORS.bgAlt, border: '1px solid ' + COLORS.border, color: COLORS.primary, fontWeight: 'bold', fontSize: '16px', cursor: (moreBusy || loading || (buildCount >= visibleBuilds.length && noMore)) ? 'not-allowed' : 'pointer', opacity: (moreBusy || loading || (buildCount >= visibleBuilds.length && noMore)) ? 0.5 : 1 }}>
                      {moreBusy ? 'Searching for more builds…' : buildCount < visibleBuilds.length ? `Show more builds (${Math.min(5, visibleBuilds.length - buildCount)} more)` : noMore ? 'No more builds' : 'Show more builds'}
                    </button>
                    {(moreBusy || (buildCount >= visibleBuilds.length && noMore)) && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: COLORS.textMuted, fontSize: '14px', marginTop: '8px' }}>
                        {moreBusy && <span className="mc-spinner"></span>}
                        <span>{moreBusy ? 'Searching for more builds — exploring pricier gear…' : noMore ? 'No builds found — no more matches available.' : ''}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}
        </main>

        {/* SIDEBAR: Twitch live + Ko-fi */}
        <aside style={{ flex: '0 1 380px', width: '100%', maxWidth: '380px', position: 'sticky', top: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ borderRadius: '8px', border: '1px solid ' + COLORS.border, backgroundColor: COLORS.card, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', backgroundColor: COLORS.bgAlt, borderBottom: '1px solid ' + COLORS.border }}>
              <strong style={{ color: COLORS.primary, fontSize: '16px' }}>🔴 Live — Watch &amp; Support the Stream</strong>
            </div>
            {twitchSrc ? (
              <iframe title="Twitch livestream" src={twitchSrc} height="380" width="100%" allowFullScreen
                style={{ border: 'none', display: 'block', backgroundColor: '#000' }} />
            ) : (
              <div style={{ padding: '24px', color: COLORS.textMuted, fontSize: '16px' }}>
                Set <code>twitchChannel</code> in <code>App.jsx</code> (SITE config) to show the live embed.
              </div>
            )}
            <div style={{ padding: '16px' }}>
              {SITE.twitchChannel && SITE.twitchChannel !== 'YOUR_TWITCH_CHANNEL' && (
                <a href={`https://twitch.tv/${SITE.twitchChannel}`} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'block', width: '100%', textAlign: 'center', whiteSpace: 'nowrap', background: '#9146ff', color: '#fff', padding: '12px 0', borderRadius: '8px', fontWeight: 'bold', fontSize: '16px', textDecoration: 'none' }}>
                  Open on Twitch
                </a>
              )}
            </div>
          </div>

          {kofiHref && (
            <div style={{ borderRadius: '8px', border: '1px solid ' + COLORS.border, backgroundColor: COLORS.card, padding: '16px' }}>
              <strong style={{ color: COLORS.primary, fontSize: '16px' }}>☕ Tip the build</strong>
              <p style={{ color: COLORS.textMuted, fontSize: '16px', marginTop: '8px', paddingBottom: '12px' }}>
                Love the calculator? A Ko-fi keeps this fan tool running and helps the stream.</p>
              <a href={kofiHref} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', whiteSpace: 'nowrap', background: '#f45d22', color: '#fff', padding: '12px 0', borderRadius: '8px', fontWeight: 'bold', fontSize: '16px', textDecoration: 'none' }}>
                <img src={KoFiLogo} alt="Ko-fi" style={{ height: 20, width: 'auto' }} />
                Support me
              </a>
              <iframe id="kofiframe"
                src={`https://ko-fi.com/${SITE.kofi}/?hidefeed=true&widget=true&embed=true&preview=true`}
                title="squigle" height="712" style={{ border: 'none', width: '100%', padding: '4px', background: '#f9f9f9', marginTop: '8px', borderRadius: '8px' }} />
            </div>
          )}
        </aside>
      </div>

      <footer style={{ borderTop: '1px solid ' + COLORS.border, padding: '20px 24px', color: COLORS.textMuted, fontSize: '16px', textAlign: 'center' }}>
        Mistfall Hunter Build Calculator — a free fan tool by{' '}
        <a href="https://github.com/squiglesquigles/mistfall-calc" target="_blank" rel="noopener noreferrer" style={{ color: COLORS.primary }}>Squigle</a>.
        Not affiliated with Bellring Games. · Helpful?{' '}
        {kofiHref && <a href={kofiHref} target="_blank" rel="noopener noreferrer" style={{ color: COLORS.primary }}>Support on Ko-fi</a>}
        {' '}·{' '}
        <a href="#" onClick={(e) => { e.preventDefault(); openGenericFeedback(); }} style={{ color: COLORS.primary }}>Feedback</a>
        {' '}·{' '}
        <a href={SITE.discordInvite} target="_blank" rel="noopener noreferrer" style={{ color: COLORS.primary }}>Join the Discord</a>
      </footer>

      {feedbackCtx && (
        <div onClick={closeFeedback} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: COLORS.card, border: '1px solid ' + COLORS.border, borderRadius: '12px', width: '100%', maxWidth: '520px', padding: '20px', color: COLORS.text }}>
            <h3 style={{ color: COLORS.primary, fontSize: '16px', marginBottom: '8px' }}>📣 Feedback</h3>
            <p style={{ color: COLORS.textMuted, fontSize: '16px', marginBottom: '16px' }}>
              Have feedback for the build team? Tell us what's off, what's missing, or what could be clearer — it goes straight to us. Thanks for helping!
            </p>

            <div style={{ borderRadius: '8px', border: '1px solid ' + COLORS.border, backgroundColor: COLORS.bgAlt, padding: '12px 16px', marginBottom: '16px', fontSize: '16px' }}>
              <div style={{ color: COLORS.textMuted, marginBottom: '8px' }}>FEEDBACK</div>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                {feedbackCtx.slot !== 'General' ? (feedbackCtx.slot + ': ' + feedbackCtx.gear + (feedbackCtx.rarity ? ' [' + feedbackCtx.rarity + ']' : '')) : 'General feedback'}
              </div>
              <div style={{ color: COLORS.textMuted }}>
                {[feedbackCtx.className, feedbackCtx.weapon, feedbackCtx.option].filter(Boolean).join(' · ') || '—'} · cost: {feedbackCtx.cost != null ? feedbackCtx.cost + 'g' : '—'}
              </div>
              {feedbackCtx.sockets && feedbackCtx.sockets.length > 0 && (
                <div style={{ color: COLORS.textMuted, marginTop: '8px' }}>
                  sockets/gems: {(feedbackCtx.sockets || []).map((s, i) => {
                    const g = (feedbackCtx.gems || [])[i];
                    return gemName(s.shape) + (s.tier === 2 ? ' T2' : '') + (g ? ' → ' + [g.affix1, g.affix2].filter(Boolean).join(' + ') : ' (empty)');
                  }).join(' · ')}
                </div>
              )}
            </div>

            <form onSubmit={submitFeedback}>
              <input type="text" value={fHp} onChange={(e) => setFHp(e.target.value)} name="website" tabIndex={-1} autoComplete="off"
                style={{ position: 'absolute', left: '-9999px', top: '-9999px', height: 0, opacity: 0 }} aria-hidden="true" />

              <label style={{ display: 'block', fontSize: '16px', color: COLORS.textMuted, marginBottom: '8px' }}>What's the issue?</label>
              <select value={fType} onChange={(e) => setFType(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid ' + COLORS.border, backgroundColor: COLORS.bgAlt, color: COLORS.text, marginBottom: '16px' }}>
                <option>Wrong gear</option>
                <option>Wrong rarity</option>
                <option>Wrong socket</option>
                <option>Wrong gem</option>
                <option>Wrong price</option>
                <option>Other</option>
              </select>

              <label style={{ display: 'block', fontSize: '16px', color: COLORS.textMuted, marginBottom: '8px' }}>Your note (what should it be?)</label>
              <textarea value={fNote} onChange={(e) => setFNote(e.target.value)} rows={4} placeholder="e.g. This slot should recommend Ardent Hood instead — the socket is wrong for this class."
                maxLength={1000}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid ' + COLORS.border, backgroundColor: COLORS.bgAlt, color: COLORS.text, resize: 'vertical', marginBottom: '16px' }}></textarea>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                <span style={{ fontSize: '16px', color: COLORS.textMuted }}>
                  {fStatus === 'sending' && 'Sending…'}
                  {fStatus === 'ok' && '✅ Sent, thank you!'}
                  {fStatus === 'error' && '⚠️ Could not send — please try again.'}
                  {fStatus === 'config' && '⚠️ Feedback isn’t configured yet (webhook URL missing).'}
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" onClick={closeFeedback}
                    style={{ padding: '12px 16px', borderRadius: '8px', border: '1px solid ' + COLORS.border, background: COLORS.bgAlt, color: COLORS.textMuted, fontSize: '16px', cursor: 'pointer' }}>Cancel</button>
                  <button type="submit" disabled={fStatus === 'sending'}
                    style={{ padding: '12px 20px', borderRadius: '8px', border: 'none', background: COLORS.primary, color: '#000', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', opacity: fStatus === 'sending' ? 0.6 : 1 }}>
                    {fStatus === 'sending' ? 'Sending…' : 'Send feedback'}
                  </button>
                </div>
              </div>
            </form>

            <p style={{ color: COLORS.textMuted, fontSize: '16px', marginTop: '16px', borderTop: '1px solid ' + COLORS.border, paddingTop: '16px' }}>
              Want to track updates on your feedback?{' '}
              <a href={SITE.discordInvite} target="_blank" rel="noopener noreferrer" style={{ color: COLORS.primary, fontWeight: 'bold' }}>Join the Discord →</a>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

