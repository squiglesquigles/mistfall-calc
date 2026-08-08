import React, { useState, useEffect } from 'react';
import { classes, affixes, meta, generateBuild } from './lib/engine';

// ----------------------------------------------------------------
//  CONFIG — fill in your Twitch channel and Ko-fi username/page
// ----------------------------------------------------------------
const SITE = {
  twitchChannel: 'squigle8', // just the channel name — no https://, no www, no .tv
  kofi: 'squigle'            // just the username -> ko-fi.com/<this>
};

const COLORS = {
  bg: '#0c0d11', bgAlt: '#14151c', card: '#1a1b23', border: '#2a2b36',
  primary: '#c9a54a', primaryDark: '#a8842f', text: '#f3f4f6', textMuted: '#b9c0cc',
  offensive: '#fca5a5', defensive: '#7dd3fc', utility: '#fcd34d', danger: '#f87171'
};

// Max combined affix level across a build (gear + gems + wine buffer).
const MAX_AFFIX_BUDGET = 40;

const RARITY_COLORS = {
  'Common': '#9ca3af', 'Rare': '#3b82f6', 'Excellent': '#a855f7', 'Epic': '#ec4899', 'Legendary': '#f59e0b', 'Holy': '#ef4444'
};

function App() {
  const [selectedClass, setSelectedClass] = useState(null);
  const [weapon, setWeapon] = useState('Mace');
  const [selected, setSelected] = useState({}); // affix -> level
  const [builds, setBuilds] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('All');

  // The engine runs fully in the browser — no server calls.
  const weaponOptions = (meta.weaponsByClass && selectedClass && meta.weaponsByClass[selectedClass.name]) || [];

  // Clear target affixes + builds when class or weapon changes
  useEffect(() => { setSelected({}); setBuilds(null); }, [selectedClass, weapon]);

  // Reset the weapon to the first option for the newly picked class.
  useEffect(() => {
    if (!selectedClass) return;
    const opts = meta.weaponsByClass[selectedClass.name] || [];
    if (opts.length && !opts.includes(weapon)) setWeapon(opts[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setSelected(prev => {
      const next = { ...prev };
      if (name in next) delete next[name];
      else next[name] = 1;
      return next;
    });
    setBuilds(null);
  }

  function setLevel(name, lvl) {
    setSelected(prev => {
      const others = Object.entries(prev).filter(([k]) => k !== name).reduce((a, [k, v]) => a + v, 0);
      const maxLvl = affixMaxMap[name] || MAX_AFFIX_BUDGET;
      const clamp = Math.max(1, Math.min(lvl, maxLvl));
      return { ...prev, [name]: Math.min(clamp, maxLvl, MAX_AFFIX_BUDGET - others) };
    });
    setBuilds(null);
  }

  function generateBuilds() {
    if (!selectedClass || Object.keys(selected).length === 0 || overBudget) return;
    setLoading(true); setError(null);
    try {
      const result = generateBuild(selectedClass.name, weapon, null,
        Object.entries(selected).map(([affix, level]) => ({ affix, level })));
      setBuilds(result);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }

  const filteredAffixes = affixes.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) &&
    (groupFilter === 'All' || a.group === groupFilter)
  );

  const groupColor = g => g === 'Offensive' ? COLORS.offensive : g === 'Defensive' ? COLORS.defensive : COLORS.utility;
  const classHasData = cls => !!cls && !!(meta.complete && meta.complete[cls.name]);
  const cs = selectedClass ? !classHasData(selectedClass) : true;
  const weaponLabel = w => (w === 'Weapon' && selectedClass ? (selectedClass.weapon || 'Weapon') : w);

  function gemLabel(slot, gem) {
    if (!gem) return null;
    const afx = [gem.affix1, gem.affix2].filter(Boolean).join(' + ');
    const tier = slot.tier === 2 ? ' T2' : '';
    return slot.shape + tier + ': ' + afx;
  }

  function slotLabel(p) {
    const built = p.built_in_affix ? ' (' + p.built_in_affix + ')' : '';
    const gems = (p.sockets || []).map((s, i) => gemLabel(s, (p.gems || [])[i])).filter(Boolean);
    return [
      p.slot + ': ' + p.gear + ' [' + p.rarity + ']' + built,
      gems.length ? ' => ' + gems.join(' | ') : ''
    ].join('');
  }

  // Twitch embed parent must match the deployed hostname; localhost works locally.
  const twitchSrc = SITE.twitchChannel && SITE.twitchChannel !== 'YOUR_TWITCH_CHANNEL'
    ? `https://player.twitch.tv/?channel=${SITE.twitchChannel}&parent=${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}&muted=false&autoplay=true`
    : null;
  const kofiHref = SITE.kofi && SITE.kofi !== 'YOUR_KOFI_USERNAME' ? `https://ko-fi.com/${SITE.kofi}` : null;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: COLORS.bg, color: COLORS.text }}>
      <header style={{ borderBottom: '1px solid ' + COLORS.border, padding: '16px 24px', backgroundColor: COLORS.bgAlt }}>
        <h1 style={{ color: COLORS.primary, fontSize: '24px', fontWeight: 'bold' }}>⚔ Mistfall Hunter — Build Calculator</h1>
        <p style={{ color: COLORS.textMuted, fontSize: '14px', marginTop: '4px' }}>
          Pick a class, choose a weapon, and select affix levels (max {MAX_AFFIX_BUDGET} combined) to find a gear + gem loadout.
        </p>
      </header>

      <div style={{ maxWidth: '1320px', margin: '0 auto', padding: '24px', display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* MAIN CALCULATOR */}
        <main style={{ flex: '1 1 620px', minWidth: '0' }}>
          {error && <div style={{ backgroundColor: '#7f1d1d', padding: '12px', borderRadius: '8px', marginBottom: '16px', color: '#fecaca' }}>{error}</div>}

          {/* Step 1: Class */}
          <section style={{ marginBottom: '32px' }}>
            <h2 style={{ color: COLORS.primary, fontSize: '18px', marginBottom: '12px' }}>Step 1: Choose Your Class</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
              {classes.map(cls => {
                const comingSoon = !classHasData(cls);
                const active = selectedClass && selectedClass.slug === cls.slug;
                return (
                  <button key={cls.slug} disabled={comingSoon} onClick={() => setSelectedClass(cls)}
                    style={{ color: COLORS.text, opacity: comingSoon ? 0.6 : 1, padding: '12px', borderRadius: '8px', cursor: comingSoon ? 'not-allowed' : 'pointer', textAlign: 'left',
                      border: '2px solid ' + (active ? COLORS.primary : COLORS.border), backgroundColor: active ? '#2a2320' : COLORS.card }}>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: COLORS.text }}>{cls.name}</div>
                    <div style={{ fontSize: '12px', color: COLORS.textMuted, marginTop: '4px' }}>{cls.role} · {cls.weapon}</div>
                    {comingSoon && <span style={{ color: COLORS.danger, fontWeight: 'bold', fontSize: '11px' }}>⏳ Coming Soon</span>}
                  </button>
                );
              })}
            </div>
          </section>

          {selectedClass && (
            <section style={{ marginBottom: '24px' }}>
              <h2 style={{ color: COLORS.primary, fontSize: '18px', marginBottom: '12px' }}>Step 2: Choose a Weapon ({selectedClass.name})</h2>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {weaponOptions.map(w => {
                    const active = weapon === w;
                    return (
                      <button key={w} disabled={cs} onClick={() => setWeapon(w)}
                        style={{ color: COLORS.text, fontWeight: '600', opacity: cs ? 0.6 : 1, padding: '10px 18px', borderRadius: '8px', cursor: cs ? 'not-allowed' : 'pointer', fontSize: '14px',
                          border: '2px solid ' + (active ? COLORS.primary : COLORS.border), backgroundColor: active ? '#2a2320' : COLORS.card }}>
                        {weaponLabel(w)}
                      </button>
                    );
                  })}
              </div>
            </section>
          )}

          {selectedClass && !cs && (
            <section style={{ marginBottom: '32px' }}>
              <h2 style={{ color: COLORS.primary, fontSize: '18px', marginBottom: '12px' }}>Step 3: Select Affixes &amp; Levels (max {MAX_AFFIX_BUDGET})</h2>
              <input type="text" placeholder="Search affixes..." value={search} onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid ' + COLORS.border, backgroundColor: COLORS.bgAlt, color: COLORS.text, marginBottom: '12px' }} />
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                {['All', 'Defensive', 'Offensive', 'Utility'].map(g => {
                  const active = groupFilter === g;
                  const col = g === 'Defensive' ? COLORS.defensive : g === 'Offensive' ? COLORS.offensive : g === 'Utility' ? COLORS.utility : COLORS.primary;
                  return <button key={g} onClick={() => setGroupFilter(g)} style={{ padding: '6px 14px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer',
                    border: '1px solid ' + (active ? col : COLORS.border), backgroundColor: active ? col + '22' : COLORS.bgAlt, color: active ? col : COLORS.textMuted, fontWeight: active ? 'bold' : 'normal' }}>{g}</button>;
                })}
              </div>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap' }}>
                <strong style={{ color: overBudget ? COLORS.danger : COLORS.text }}>Combined level: {combined} / {MAX_AFFIX_BUDGET}</strong>
                {overBudget && <span style={{ color: COLORS.danger, fontWeight: 'bold' }}>(over budget — lower a level)</span>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '10px' }}>
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
                      style={{ color: COLORS.text, opacity: reachable_ ? 1 : 0.5, padding: '12px', borderRadius: '8px', textAlign: 'left',
                        border: '2px solid ' + (sel ? col : COLORS.border), backgroundColor: sel ? '#1d2430' : COLORS.card, cursor: reachable_ ? 'pointer' : 'not-allowed' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 'bold', color: COLORS.text }}>{affix.name}</span>
                        <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: col + '22', color: col }}>{affix.group}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: COLORS.textMuted, marginTop: '4px' }}>{affix.desc ? affix.desc.slice(0, 90) : ''}</div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px', alignItems: 'center' }}>
                        {hasPassive && <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: COLORS.primary + '33', color: COLORS.primary, fontWeight: 'bold' }}>Recommended Lv {affix.level[0]}</span>}
                        {maxLvl && <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: COLORS.border, color: COLORS.textMuted }}>Max Lv {maxLvl}</span>}
                      </div>
                      {!reachable_ && <div style={{ fontSize: '10px', color: COLORS.danger, marginTop: '4px' }}>Not reachable with {weapon}</div>}
                      {sel && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', backgroundColor: COLORS.bgAlt, padding: '6px', borderRadius: '6px' }}>
                          <button onClick={(e) => { e.stopPropagation(); setLevel(affix.name, cur - 1); }} disabled={cur <= 1}
                            style={{ borderRadius: 4, border: '1px solid ' + COLORS.border, background: COLORS.card, color: '#ffffff', fontWeight: 'bold', width: 28, height: 28, cursor: 'pointer', opacity: cur <= 1 ? 0.5 : 1 }}>−</button>
                          <span style={{ fontSize: '14px', minWidth: '70px', textAlign: 'center', color: '#ffffff', fontWeight: 'bold' }}>Lv {cur}/{aMax}</span>
                          <button onClick={(e) => { e.stopPropagation(); setLevel(affix.name, cur + 1); }} disabled={cur >= aMax || combined >= MAX_AFFIX_BUDGET}
                            style={{ borderRadius: 4, border: '1px solid ' + COLORS.border, background: COLORS.card, color: '#ffffff', fontWeight: 'bold', width: 28, height: 28, cursor: 'pointer', opacity: (cur >= aMax || combined >= MAX_AFFIX_BUDGET) ? 0.5 : 1 }}>+</button>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {selectedClass && !cs && Object.keys(selected).length > 0 && !overBudget && (
            <section style={{ marginBottom: '32px' }}>
              <button onClick={generateBuilds} disabled={loading}
                style={{ background: COLORS.primary, color: '#000', padding: '12px 24px', borderRadius: '8px', fontWeight: 'bold', fontSize: '16px', border: 'none', cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
                {loading ? 'Finding builds...' : `Generate Build (${Object.keys(selected).length} affixes · ${combined}/${MAX_AFFIX_BUDGET})`}
              </button>
            </section>
          )}

          {builds && builds.error && (
            <div style={{ backgroundColor: '#7f1d1d', padding: '16px', borderRadius: '8px', color: '#fecaca' }}><strong>Build generation failed:</strong> {builds.error}</div>
          )}

          {builds && builds.builds && (
            <section>
              <h2 style={{ color: COLORS.primary, fontSize: '18px', marginBottom: '8px' }}>{builds.className} · {builds.weapon} Builds</h2>
              <p style={{ color: COLORS.textMuted, marginBottom: '16px' }}>
                {builds.combinedLevel}/{MAX_AFFIX_BUDGET} combined · {builds.totalBuilds} found · wine: {builds.wine && builds.wine.label ? (builds.wine.label + ' · ' + builds.wine.cost + 'g') : 'none'} · targets: {builds.targetAffixes.map(t => t.affix + ' Lv' + t.level).join(', ')}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {builds.builds.map((b, i) => (
                  <div key={i} style={{ borderRadius: '8px', border: '1px solid ' + (i === 0 ? COLORS.primary : COLORS.border), backgroundColor: COLORS.card, overflow: 'hidden' }}>
                    <div style={{ padding: '10px 16px', backgroundColor: i === 0 ? '#2a2320' : COLORS.bgAlt, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                      <strong style={{ color: i === 0 ? COLORS.primary : COLORS.text }}>{i === 0 ? '🎯 Cheapest Build' : 'Option ' + (i + 1)}</strong>
                      <span style={{ color: COLORS.text, fontWeight: 'bold', fontSize: '14px' }}>💠 {b.cost}g · {b.wine ? ('🍷 ' + b.wine + (b.wineCost ? ' +' + b.wineCost + 'g' : ' (free)')) : 'no wine'}</span>
                    </div>
                    {b.capacityWarnings && b.capacityWarnings.length > 0 && (
                      <div style={{ padding: '4px 16px', backgroundColor: COLORS.danger + '22', color: COLORS.danger, fontSize: '11px' }}>
                        ⚠ {b.capacityWarnings.join(' · ')}
                      </div>
                    )}
                    {b.wine && b.wineGrants && Object.keys(b.wineGrants).length > 0 && (
                      <div style={{ padding: '4px 16px', fontSize: '11px', color: COLORS.primary, backgroundColor: COLORS.bgAlt }}>
                        🍷 {b.wine} grants: {Object.entries(b.wineGrants).map(([a, n]) => a + ' +' + n).join(', ')}
                      </div>
                    )}
                    <div style={{ padding: '6px 16px' }}>
                      {b.slots.map((p, j) => (
                        <div key={j} style={{ padding: '5px 0', fontSize: '13px', borderBottom: j < b.slots.length - 1 ? '1px solid ' + COLORS.border : 'none' }}>
                          {slotLabel(p)}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>

        {/* SIDEBAR: Twitch live + Ko-fi */}
        <aside style={{ flex: '0 1 380px', width: '100%', maxWidth: '380px', position: 'sticky', top: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ borderRadius: '8px', border: '1px solid ' + COLORS.border, backgroundColor: COLORS.card, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', backgroundColor: COLORS.bgAlt, borderBottom: '1px solid ' + COLORS.border }}>
              <strong style={{ color: COLORS.primary }}>🔴 Live — Watch &amp; Support the Stream</strong>
            </div>
            {twitchSrc ? (
              <iframe title="Twitch livestream" src={twitchSrc} height="380" width="100%" allowFullScreen
                style={{ border: 'none', display: 'block', backgroundColor: '#000' }} />
            ) : (
              <div style={{ padding: '24px', color: COLORS.textMuted, fontSize: '13px' }}>
                Set <code>twitchChannel</code> in <code>App.jsx</code> (SITE config) to show the live embed.
              </div>
            )}
            <div style={{ padding: '10px 14px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {SITE.twitchChannel && SITE.twitchChannel !== 'YOUR_TWITCH_CHANNEL' && (
                <a href={`https://twitch.tv/${SITE.twitchChannel}`} target="_blank" rel="noopener noreferrer"
                  style={{ flex: '1', textAlign: 'center', background: '#9146ff', color: '#fff', padding: '10px 12px', borderRadius: '6px', fontWeight: 'bold', textDecoration: 'none' }}>
                  Open on Twitch
                </a>
              )}
              {kofiHref && (
                <a href={kofiHref} target="_blank" rel="noopener noreferrer"
                  style={{ flex: '1', textAlign: 'center', background: '#29abe0', color: '#fff', padding: '10px 12px', borderRadius: '6px', fontWeight: 'bold', textDecoration: 'none' }}>
                  ☕ Support on Ko-fi
                </a>
              )}
            </div>
          </div>

          {kofiHref && (
            <div style={{ borderRadius: '8px', border: '1px solid ' + COLORS.border, backgroundColor: COLORS.card, padding: '14px' }}>
              <strong style={{ color: COLORS.primary, fontSize: '14px' }}>☕ Tip the build</strong>
              <p style={{ color: COLORS.textMuted, fontSize: '12px', marginTop: '6px', paddingBottom: '8px' }}>
                Love the calculator? A Ko-fi keeps this fan tool running and helps the stream.</p>
              <iframe title="Ko-fi donation widget" id="kofiframe"
                src={`https://ko-fi.com/${SITE.kofi}/?hidefeed=true&widget=true&embed=true&preview=true`}
                height="712" style={{ border: 'none', width: '100%', padding: '4px', background: '#f9f9f9' }} />
            </div>
          )}
        </aside>
      </div>

      <footer style={{ borderTop: '1px solid ' + COLORS.border, padding: '16px 24px', color: COLORS.textMuted, fontSize: '12px', textAlign: 'center' }}>
        Mistfall Hunter Build Calculator — Unofficial fan tool. Not affiliated with Bellring Games. · Helpful?{' '}
        {kofiHref && <a href={kofiHref} target="_blank" rel="noopener noreferrer" style={{ color: COLORS.primary }}>Support on Ko-fi</a>}
      </footer>
    </div>
  );
}

export default App;
