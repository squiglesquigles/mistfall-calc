// scripts/gen-guide-pages.mjs - static guide / page generator.
// Run: node scripts/gen-guide-pages.mjs
// Writes:
//   frontend/public/guides/{slug}/index.html             - class guides (real content)
//   frontend/public/builds/{slug}/index.html          - build guides (4 rarity tiers, "Coming soon")
//   frontend/public/{about,feedback,privacy-policy,terms-of-use}/index.html
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'frontend', 'public');
const SITE = 'https://www.mistfallcalc.com';

// ----------------------------------------------------------------
// Per-class guide data (original copy - follows Mobalytics structure)
// ----------------------------------------------------------------
const CLASSES = [
  {
    slug: 'mercenary', name: 'Mercenary', role: 'Bruiser', weapon: 'Sword & Shield / Hammer',
    tag: 'Frontline bruiser who absorbs damage and never stops pushing.',
    overview: [
      'The Mercenary is the frontline bruiser of Mistfall Hunter - a Sword & Shield or Hammer Hunter built to take hits, hold ground, and keep pushing. It is the most forgiving class to gear and the easiest to pick up, making it a natural first choice.',
      'Whether you block with the shield or swing a Hammer two-handed, the Mercenary stays in the enemy face long enough to convert survivability into damage. Cheap, durable upgrades usually come from armour with defensive built-in affixes.'
    ],
    strengths: [
      'Very tanky - among the highest effective HP pools in the game',
      'Forgiving to learn and cheap to gear, ideal as a first class',
      'Strong melee damage with both weapon sets',
      'Excellent defensive tools (block, counter, stun) for PvP and PvE'
    ],
    cons: [
      'Loses trades at range and must close distance',
      'Can be kited once movement abilities are on cooldown',
      'Raw damage is lower than dedicated DPS classes',
      'Sustain depends on affixes and gear quality'
    ],
    paths: [
      { name: 'Sword & Shield', desc: 'The defensive path: block, counter, and stun while weaving quick sword hits. A reliable front line for solo or teams.',
        skills: [
          ['Blade Charge / Shield Dash', 'Mobile engage that sets up the forward sword hit'],
          ['Stacking Blade', 'Builds stacks that feed your main damage spike'],
          ['Absolute Punishment', 'Landing it strips cooldown off your core skill'],
          ['Raging Earth Shake', 'Hits that slow and stun to control fast enemies'],
          ['Shield Counter', 'Block, then punish with a counter-attack']
        ] },
      { name: 'Hammer', desc: 'The aggressive path: big two-handed hits and durable crowd control.',
        skills: [
          ['Hammer Smash / Skull', 'Your biggest single-hit damage and CC'],
          ['Earthshaker', 'Ground impact that sends enemies reeling'],
          ['Charged Hammer', 'Longer-ranged poke while you approach'],
          ['Hammer Spin', 'AOE swing for tight clusters']
        ] }
    ],
    build: {
      skills: 'Pick your charge or hammer loadout and keep a defensive tool (shield counter / parry) for pressure.',
      talents: 'Prioritise survivability, dash distance and cooldown recovery for your main rotation.',
      affixes: 'Start with Attack and Movement Speed; add Defence %, Physical/Magic Resistance and Dodge cost reduction as budget allows.',
      wine: 'Victory Wine is a cheap way to add an extra Defence or Damage affix pair to any Mercenary set.'
    },
    tips: [
      'Stun first, punish second - your burst window opens after a successful stagger or counter.',
      'Use mobility skills to catch classes like Sorcerer and Blackarrow that try to kite you.',
      'Do not dump everything into damage until your Defence feels comfortable - a dead bruiser deals no damage.'
    ]
  },
  {
    slug: 'sorcerer', name: 'Sorcerer', role: 'Mage', weapon: 'Staff',
    tag: 'Ranged burst caster that controls the tempo of a fight.',
    overview: [
      'The Sorcerer is a ranged damage carry focused on controlling the pace of a fight. She either pours out massive burst damage with fire and stardust spells, or locks enemies down with ice and gravitational crowd control.',
      'Her spells have low cooldowns, which lets her keep constant pressure and pivot between damage and control. Because her power lives in the staff and magical scaling, Sorcerer builds are usually where the calculator saves the most gold.'
    ],
    strengths: [
      'Enormous damage potential with low-cooldown spell spam',
      'Very versatile - a spell for every situation',
      'Multiple true-damage tools in her kit',
      'Good defensive options for a squishy class'
    ],
    cons: [
      'Easily run down once enemies get close',
      'Short range on her best damage spells',
      'Hard to pick up - missing spells is punishing',
      'Strongly depends on gearing the right affixes'
    ],
    paths: [
      { name: 'Fire / Ice Elemental', desc: 'The recommended DPS route: Fire Bolt spam with burn procs plus Ice for control and space.',
        skills: [
          ['Fire Bolt', 'Charged main damage that explodes and burns on hit'],
          ['Flameblade', 'Close-range melee slash that applies burn'],
          ['Deep Freeze', 'Cone of frost that slows enemies around you'],
          ['Crystal Icebolt', 'Auto-firing ice that answers anyone who hits you'],
          ['Shadow Veil', 'Stealth + reposition, especially valuable in solo']
        ] },
      { name: 'Stardust', desc: 'The damage-control route: chant-and-unleash magic that moves, slows and debuffs.',
        skills: [
          ['Stardust Energy', 'Passive: faster chants and energy regeneration while casting'],
          ['Stardust Tempest', 'Targeted area slow plus damage'],
          ['Stardust Torrent', 'Guided torrent that grows stronger the longer it travels']
        ] }
    ],
    build: {
      skills: 'Fire/Ice kit: Fire Bolt, a melee blade, Deep Freeze, Crystal Icebolt, Shadow Veil and Elemental Affinity as finisher.',
      talents: 'Rapid Flamestrike and Summon Flameblade for true damage, plus cooldown (Deep Frost Embrace, Arcane Charge) and chant-speed talents.',
      affixes: 'Eloquence (chant speed) is a top pick; add Wise (magic damage), Fervid (high-HP damage) and Seamless (skill recovery) around stamina helpers.',
      wine: 'Wine can top up damage or chant-speed affixes without changing the core set.'
    },
    tips: [
      'Charge your spells - they hit harder and your talents often add true damage. Tap only in emergencies.',
      'Use Shadow Veil to reposition before a fight, not to re-enter it instantly.',
      'Enemies in melee mean death - burn Deep Freeze early; it is a life-saver.',
      'Prepare before a fight: drop Crystal Icebolt early so it is ready when they close.'
    ]
  },
  {
    slug: 'seer', name: 'Seer', role: 'Support', weapon: 'Catalyst / Mace',
    tag: 'Pocket cleric who heals, shields, and controls the battlefield.',
    overview: [
      'The Seer draws strength from faith in the return of the gods, using prayers and divine arts to heal, protect, and support allies. It is the closest Mistfall Hunter class to a cleric, and offers two very different build paths: the Reverent and the Blasphemer.',
      'Every Seer turn the battlefield into a safe zone for teammates: runes and shields keep allies alive while curse effects and crowd control buy time for the rest of the team.'
    ],
    strengths: [
      'Best healing and shielding support in the game',
      'Strong battlefield control (runes, knockbacks, stuns)',
      'Two distinct paths (Reverent support / Blasphemer duelist)',
      'Great value in trios, where a pocket healer shines'
    ],
    cons: [
      'Low raw damage - pure supports must rely on allies',
      'Healing and protection have limited uses per run',
      'Blasphemer path is mechanical and position-heavy',
      'Squishy and vulnerable while casting'
    ],
    paths: [
      { name: 'Reverent', desc: 'The support path: set rune pillars, shield teammates, and keep the party alive.',
        skills: [
          ['Psionic Orb', 'Light attack that feeds Psionic Energy for runes'],
          ['Rune Summon', 'Deploys a buildable rune pillar at a target spot'],
          ['Healing Art / Healing Rune', 'Recovers health for all allies in range'],
          ['Shelter Rune', 'Shields allies and the lowest-HP ally especially'],
          ['Binding Rune', 'Immobilizes enemies in range to protect allies'],
          ['Wind Surge', 'Cyclone that knocks melee enemies back']
        ] },
      { name: 'Blasphemer', desc: 'The aggressive path: curses, mobility, and huge dueling potential.',
        skills: [
          ['Shapeshift', 'Engage and disengage tool that jumps the backline'],
          ['Thorn Sigil', 'Immobilizes and slows enemies around you'],
          ['Rune: Stun / Rune: Sweep', 'High-damage CC follow-up after thorn hit'],
          ['Unleash Zeal', 'Buffs attack and defence, perfect for duels']
        ] }
    ],
    build: {
      skills: 'Reverent: Healing Art + Wind Surge, with Shelter and Binding runes that fit the team. Blasphemer: Shapeshift, Thorn Sigil, and a Stun or Sweep rune.',
      talents: 'Support builds focus on skill casts; Blasphemer builds focus on Unleash Zeal uptime.',
      affixes: 'Support Seers want skill-related and defence affixes; duelist Seers stack magic damage and control affixes.',
      wine: 'Wine can top up the support affixes without needing expensive gear rolls.'
    },
    tips: [
      'Place rune pillars in the middle of the fight - positioning beats instant value.',
      'Pre-cast Shelter before a fight starts for the enhanced shield.',
      'Healing has limited uses: say it to the team and retreat to heal when low.',
      'Hold your stuns for peel; a well-timed Binding Rune saves a fight.'
    ]
  },
  {
    slug: 'shadowstrix', name: 'Shadowstrix', role: 'Assassin', weapon: 'Dagger / Dual Blades',
    tag: 'Stealth assassin that ends fights in seconds.',
    overview: [
      'The Shadowstrix is a high-mobility assassin built on stealth, shadow movement, and fast melee strikes. It creates sudden openings, deletes squishy targets, and repositions before enemies can react.',
      'Rather than trading blows head-on, the Shadowstrix uses stealth and dashes to pick the perfect moment. It is the best class in the game for finishing a fight in a handful of seconds - if you can stay out of reach long enough.'
    ],
    strengths: [
      'Best single-target burst damage in the game',
      'Excels against squishy classes',
      'Stealth grants safe repositioning and escapes',
      'Quick ability casts and strong dodge game'
    ],
    cons: [
      'Low HP - mistakes are oneshot territory',
      'Fully dependent on abilities for safety and damage',
      'Relies on precise mechanics and fast reactions',
      'Can struggle in sustained PvE encounters'
    ],
    paths: [
      { name: 'Dagger', desc: 'Stealth-first openings and catching targets off guard.',
        skills: [
          ['Sneak', 'Enter stealth for a window of free positioning'],
          ['Smoke Bomb', 'Blind others while seeing clearly yourself'],
          ['Shadow Strike', 'Dash past, leave a shadow that snaps back and stuns'],
          ['Flash Stride', 'Fast forward dash that damages along the path']
        ] },
      { name: 'Dual Blades', desc: 'Sustained flurries and pressure for duel-oriented play.',
        skills: [
          ['Flurry Strike', 'Backstep into a charged dash for big damage'],
          ['Bloody Blade Dance', 'Channel forward slashes that deflect projectiles'],
          ['Inspiring Impale', 'Thrust that restores energy on hit'],
          ['Phantom Shift', 'Phantom dashes with calculated aim']
        ] }
    ],
    build: {
      skills: 'Choose one weapon line, pair crowd-control (Smoke/impale) with movement (Flash/Phantom) for openings.',
      talents: 'Crit and damage talents; cooldown reduction on mobility.',
      affixes: 'Crit-related affixes are king; add Attack, elusiveness, and Destructive damage.',
      wine: 'A cheap damage wine fills holes in the crit setup.'
    },
    tips: [
      'Engage only when your cooldowns are up - the class survives off timing.',
      'Use stealth to reposition, not just to start fights.',
      'Aim for the squishy carry: killing one target fast wins the fight.',
      'Keep a dodge for retreat; never enter with everything on cooldown.'
    ]
  },
  {
    slug: 'blackarrow', name: 'Blackarrow', role: 'Ranged', weapon: 'Bow',
    tag: 'Ranged archer who controls space with poison and pressure.',
    overview: [
      'The Blackarrow is the dedicated archer of Mistfall Hunter - a bow Hunter that controls space from range and converts positioning and physical damage into safe, sustained DPS.',
      'Arrows provide burst, poison and constant pressure while active skills create space and finish weakened targets. The Blackarrow lives and dies by range, so every build boosts movement, slows, and damage-over-time uptime.'
    ],
    strengths: [
      'Safe, sustained range damage - rarely has to touch melee',
      'Powerful DoT signatures (poison, bleed) that scale very high',
      'Great vs bosses and trios with constant pressure',
      'Movement + slow tools keep distance from aggression'
    ],
    cons: [
      'Fragile - loses all trades up close',
      'Positioning and spacing are demanding',
      'Damage window requires setting up Do effects',
      'Few defensive tools beyond distance itself'
    ],
    paths: [
      { name: 'Trio / Control (Spore + Do)', desc: 'Stack poison and bleed, hold enemies far, and farm fights.',
        skills: [
          ['Spore Arrow', 'Creates a damaging poison area - hit the floor, not the target'],
          ['Barbed Arrow', 'Do that punishes enemies whenever they dodge'],
          ['Impact Grenade', 'Knock enemies back - push them into the poison'],
          ['Scattershot', 'Get-away burst spread for defensive space']
        ] },
      { name: 'Solo / Burst (Bloodfly)', desc: 'Out-of-the-box burst windows and finishing.',
        skills: [
          ['Bloodfly Arrow', 'The build\'s largest single burst hit'],
          ['Rapid Arrows', 'Quick burst that finishes weakened targets'],
          ['Dodge Rapid Shot', 'Convert dodges into instant shots while staying ahead']
        ] }
    ],
    build: {
      skills: 'Spore + Barbed for sustained damage; add Impact Grenades and Scattershot to control space.',
      talents: 'Burst: Blood Infection keeps Bloodfly online. Sustained: Lasting, Fastened and powerful.',
      affixes: 'Ranged is the core damage affix; add Focused, Elusive, Curse, Seeker and Valor around it.',
      wine: 'A small wine investment completes Popular affix breakpoints at a fraction of gear cost.'
    },
    tips: [
      'Hit Bloodfly then fully-drawn follow-up shot to detonate the build\s big burst.',
      'Apply Barbed before the enemy starts dodging - each dodge ticks extra damage.',
      'Stay near the edge of your range; Ranged and poison fire count from distance.',
      'Push enemies into the Spore pool with Impact Grenade, then Scattershot away.'
    ]
  },
  {
    slug: 'withered-knight', name: 'Withered Knight', role: 'Heavy', weapon: 'Greatsword, Polearm and Shield',
    tag: 'Rushing heavy who executes targets with Wither.',
    overview: [
      'The Withered Knight specialises in heavy melee damage and rushing enemies down. It has two weapon sets - the greatsword for offense, and the Shield and Polearm for the game\'s best defense.',
      'Its kit revolves around applying Wither, a debuff that enables finisher executes, making it especially strong in 1v1 and solo play where enemies cannot escape the pressure.'
    ],
    strengths: [
      'Great front-loaded damage and chase tools',
      'Execute finishers once Wither is stacked',
      'Two modes: offence (Greatsword) and defense (Shield/Polearm)',
      'Some of the best defensive skills in the game'
    ],
    cons: [
      'Can get kited once mobility is on cooldown',
 'Relies completely on landing Wither',
      'Shield and Polearm sacrifices damage for defense',
      'Sustain comes from items and affixes'
    ],
    paths: [
      { name: 'Greatsword', desc: 'The offence build: charges, penalty and executes.',
        skills: [
          ['Breakthrough Charge', 'Charged lunge into sweeping combo attacks'],
          ['Radiant Retribution', 'Quick three-hitter with super armour finisher'],
          ['Withering Mark', 'Your Wither tool that sets up executes'],
          ['Sprinting Slash', 'Leap-in that can execute Wither-afflicted foes']
        ] },
      { name: 'Shield and Polearm', desc: 'The defense build: block, shield bash, and team-saves.',
        skills: [
          ['Sacred Bulwark', 'Massive barrier that blocks frontal damage entirely'],
          ['Intervene', 'Dash to an ally, knock enemies back, shield everyone'],
          ['Breaker Shield Bash', 'Area hit that applies Wither while blocking'],
          ['Spear Barrage', 'Rapid thrusts ending in a knockdown']
        ] }
    ],
    build: {
      skills: 'Greatsword for solo (Mark, Charge, Sprinting Slash); Shield/Polearm for trios (Bulwark, Intervene, Bash).',
      talents: 'Attack: Instant Wither, Cataclysm/Reprice, dominance. Tank: Off-balance, Focus, Unbreakable.',
      affixes: 'Mix Attack with defence and Wither/duration support; sustain affixes keep you above execute range.',
      wine: 'Wine fills remaining defensive or damage slots cheaply.'
    },
    tips: [
      'Land Wither first - executes make the class deadly.',
      'Use Breakthrough lunge to stay glued to kiting enemies.',
      'In trios, swap to Shield/Polearm and peel for your allies.',
      'Keep a block or Parry ready for burst windows.'
    ]
  },
]


// ----------------------------------------------------------------
// Shared template + footer columns
// ----------------------------------------------------------------
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const CSS = `
* { margin:0; padding:0; box-sizing:border-box; }
body { background:#0c0d11; color:#e5e7eb; font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif; line-height:1.65; }
a { color:#c9a54a; }
.wrap { max-width:1080px; margin:0 auto; padding:0 20px 24px; }
.topnav { display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; padding:20px 0; border-bottom:1px solid #2a2b36; margin-bottom:28px; }
.topnav .brand { font-weight:800; font-size:18px; color:#c9a54a; text-decoration:none; }
.topnav nav { display:flex; gap:18px; flex-wrap:wrap; }
.topnav nav a { color:#b9c0cc; text-decoration:none; font-size:14px; }
.topnav nav a:hover, .topnav nav a.on { color:#f3f4f6; }
header.guide { margin-bottom:24px; }
header.guide h1 { color:#c9a54a; font-size:30px; font-weight:800; }
header.guide .tag { color:#b9c0cc; margin-top:6px; font-size:16px; }
.crumb { color:#6b7280; font-size:13px; margin-top:10px; }
.crumb a { color:#c9a54a; text-decoration:none; }
.card { background:#14151c; border:1px solid #2a2b36; border-radius:12px; padding:20px 22px; margin:16px 0; }
.card h2 { color:#c9a54a; font-size:20px; margin-bottom:10px; }
.card p, .card li { color:#b9c0cc; font-size:15px; }
.card p+p { margin-top:10px; }
.proscons { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
@media (max-width:720px) { .proscons { grid-template-columns:1fr; } }
.pros h3 { color:#4ade80; font-size:15px; margin-bottom:8px; }
.cons h3 { color:#f87171; font-size:15px; margin-bottom:8px; }
.pros ul, .cons ul { list-style:none; }
.pros li, .cons li { padding:4px 0 4px 18px; position:relative; color:#b9c0cc; font-size:15px; }
.pros li:before { content:'+'; position:absolute; left:2px; color:#4ade80; font-weight:700; }
.cons li:before { content:'-'; position:absolute; left:2px; color:#f87171; font-weight:700; }
.paths { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
@media (max-width:720px) { .paths { grid-template-columns:1fr; } }
.path { background:#161722; border:1px solid #2a2b36; border-radius:10px; padding:16px; }
.path h3 { color:#f3f4f6; font-size:16px; margin-bottom:4px; }
.path .pdesc { color:#8b93a3; font-size:13px; margin-bottom:10px; }
.path ul { list-style:none; }
.path li { padding:6px 0; border-top:1px solid #23242e; font-size:14px; }
.path li b { color:#f3f4f6; }
.path li span { color:#9aa1ad; }
.buildgrid .stat { color:#b9c0cc; font-size:15px; }
.cta { display:inline-block; background:#c9a54a; color:#0c0d11; font-weight:700; padding:11px 18px; border-radius:8px; text-decoration:none; margin:6px 8px 0 0; }
.cta.alt { background:transparent; border:1px solid #c9a54a; color:#c9a54a; }
.foot { border-top:1px solid #2a2b36; margin-top:28px; padding:24px 0 0; }
.fcols { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:20px; }
@media (max-width:860px) { .fcols { grid-template-columns:repeat(2,1fr); } }
@media (max-width:480px) { .fcols { grid-template-columns:1fr; } }
.fcol h4 { color:#c9a54a; font-size:13px; text-transform:uppercase; letter-spacing:.06em; margin-bottom:10px; }
.fcol ul { list-style:none; }
.fcol li { margin:6px 0; }
.fcol a { color:#8b93a3; text-decoration:none; font-size:14px; }
.fcol a:hover { color:#c9a54a; }
.fcred { border-top:1px solid rgba(255,255,255,0.2); margin-top:20px; padding-top:14px; text-align:center; color:#6b7280; font-size:12px; }
.fcred a { color:#c9a54a; text-decoration:none; }
`;

function footerColumns() {
  const guides = CLASSES.map(c => '<li><a href="/guides/' + c.slug + '/">' + esc(c.name) + ' guide</a></li>').join('\n');
  const builds = CLASSES.map(c => '<li><a href="/builds/' + c.slug + '/">' + esc(c.name) + ' builds</a></li>').join('\n');
  return `
    <footer class="card" style="padding:20px 22px;">
      <div class="fcols">
        <div class="fcol"><h4>Class guides</h4><ul>\n${guides}</ul></div>
        <div class="fcol"><h4>Build guides</h4><ul>\n${builds}</ul></div>
        <div class="fcol"><h4>Site</h4><ul>
          <li><a href="/about/">About</a></li>
          <li><a href="/feedback/">Feedback</a></li>
          <li><a href="/privacy-policy/">Privacy policy</a></li>
          <li><a href="/terms-of-use/">Terms of use</a></li>
        </ul></div>
        <div class="fcol"><h4>Community</h4><ul>
          <li><a href="https://ko-fi.com/squigle" rel="noopener" target="_blank">Ko-fi</a></li>
          <li><a href="https://discord.gg/bXuR4Eh2DV" rel="noopener" target="_blank">Discord</a></li>
          <li><a href="https://twitch.tv/squigle8" rel="noopener" target="_blank">Twitch</a></li>
          <li><a href="https://linktr.ee/squigleV2" rel="noopener" target="_blank">Linktree</a></li>
        </ul></div>
      </div>
      <div class="fcred"><a href="/">Back to the main calculator</a> &middot; Mistfall Calc by Squigle - mistfallcalc.com - a free fan tool, not affiliated with Bellring Games.</div>
    </footer>`;
}

function topNav(on) {
  const item = (href, label, key) => '<a ' + (on === key ? 'class="on" ' : '') + 'href="' + href + '">' + label + '</a>';
  return `
    <div class="topnav">
      <a class="brand" href="/">Mistfall Build Calculator</a>
      <nav>${item('/', 'Calculator', 'calc')}${item('/guides/mercenary/', 'Class guides', 'guides')}${item('/builds/mercenary/', 'Build guides', 'builds')}${item('/about/', 'About', 'about')}${item('/feedback/', 'Feedback', 'feedback')}</nav>
    </div>`;
}

function head(title, desc, canonical, breadcrumb) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}" />
<meta name="robots" content="index, follow" />
<link rel="canonical" href="${canonical}" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="Mistfall Hunter Build Calculator" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:url" content="${canonical}" />
<meta property="og:image" content="https://www.mistfallcalc.com/og-image.png" />
<script type="application/ld+json">
${JSON.stringify(breadcrumb, null, 1)}
</script>
<style>${CSS}</style>
</head>
<body>
<div class="wrap">
`;
}

function tail() { return footerColumns() + '\n</div>\n</body>\n</html>\n'; }


// ----------------------------------------------------------------
// Class guide page
// ----------------------------------------------------------------
function breadcrumb(items) {
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it[0], item: it[1] })) };
}

function pathsHTML(paths) {
  return '<div class="paths">' + paths.map(pa => {
    const lis = pa.skills.map(([n, d]) => `<li><b>${esc(n)}</b> - <span>${esc(d)}</span></li>`).join('');
    return `<div class="path"><h3>${esc(pa.name)}</h3><p class="pdesc">${esc(pa.desc)}</p><ul>${lis}</ul></div>`;
  }).join('\n') + '</div>';
}

function guidePage(c) {
  const title = `Mistfall ${c.name} Guide - Playstyle, Strengths and Abilities`;
  const desc = `How to play the Mistfall ${c.name}: role, playstyle, abilities, pros and cons for ${c.weapon}. Plus a guide to the cheapest ${c.name} gear and gem loadouts.`;
  const canon = `${SITE}/guides/${c.slug}/`;
  const others = CLASSES.filter(x => x.slug !== c.slug)
    .map(x => `<a class="cta alt" href="/guides/${x.slug}/">${esc(x.name)} guide</a>`).join('');
  const content = `
    <header class="guide">
      <div class="crumb"><a href="/">Mistfall build calculator</a> / <a href="/guides/${c.slug}/">${esc(c.name)} guide</a></div>
      <h1>Mistfall ${esc(c.name)} Guide</h1>
      <p class="tag">${esc(c.tag)} ${esc(c.role)} - ${esc(c.weapon)}</p>
    </header>

    <section class="card"><h2>Overview</h2>${c.overview.map(p => `<p>${esc(p)}</p>`).join('')}</section>

    <section class="card"><h2>Strengths and Weaknesses</h2>
      <div class="proscons">
        <div class="pros"><h3>Strengths</h3><ul>${c.strengths.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
        <div class="cons"><h3>Weaknesses</h3><ul>${c.cons.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
      </div>
    </section>

    <section class="card"><h2>Playstyle and Abilities</h2>${pathsHTML(c.paths)}</section>

    <section class="card"><h2>How to Build</h2>
      <p><b>Skills:</b> ${esc(c.build.skills)}</p>
      <p><b>Talents:</b> ${esc(c.build.talents)}</p>
      <p><b>Affixes:</b> ${esc(c.build.affixes)}</p>
      <p><b>Wine:</b> ${esc(c.build.wine)}</p>
    </section>

    <section class="card"><h2>Tips and Tricks</h2><ul>${c.tips.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>

    <section class="card"><h2>Take it to the calculator</h2>
      <p>Turn this guide into the cheapest possible gear and gem loadout.</p>
      <a class="cta" href="/?class=${c.slug}">Open the ${esc(c.name)} build calculator</a>
      <a class="cta alt" href="/builds/${c.slug}/">${esc(c.name)} build guides</a>
      <div style="margin-top:14px;">${others}</div>
    </section>
  `;
  return head(title, desc, canon, breadcrumb([['Mistfall build calculator', 'https://www.mistfallcalc.com/'], [`${c.name} guide`, canon]])) + topNav('guides') + content + tail();
}

// ----------------------------------------------------------------
// Build guide page (4 rarity tiers)
// ----------------------------------------------------------------
function buildPage(c) {
  const title = `Mistfall ${c.name} Build Guide - Green, Blue, Purple and Legendary Sets`;
  const desc = `The four ${c.name} builds - Green (starter), Blue, Purple, and Legendary sets - with the affixes and loadout for each. Coming soon for the cheapest ${c.weapon} gear.`;
  const canon = `https://www.mistfallcalc.com/builds/${c.slug}/`;
  const sets = [
    ['Green', '#4ade80', 'The cheap starter set. Common and rare gear with the core affixes to get the class functional.'],
    ['Blue', '#3b82f6', 'The mid-budget set. Rare and epic gear that unlocks the class signature combo.'],
    ['Purple', '#a855f7', 'The high-budget set. Epic gear that pushes rank and solo performance.'],
    ['Legendary', '#f59e0b', 'The endgame min-maxed set. Every slot and gem tuned for the best value you can spend.']
  ];
  const cards = sets.map(([name, color, why]) => `
    <section class="card" style="border-left:4px solid ${color};">
      <h2><span style="color:${color}">\u2b24</span> ${name} set</h2>
      <p>${why}</p>
      <p><b>Affixes:</b> <span style="color:#6b7280;">Coming soon - loadout and affix details for the ${name} ${esc(c.name)} set will appear here.</span></p>
      <p style="margin:0;"><span class="stat">Rarity: ${name} - Weapon: ${esc(c.weapon)}</span></p>
    </section>`).join('\n');
  const content = `
    <header class="guide">
      <div class="crumb"><a href="/">Home</a> / <a href="/builds/${c.slug}/">${esc(c.name)} builds</a></div>
      <h1>Mistfall ${esc(c.name)} Build Guide</h1>
      <p class="tag">Four builds - ${esc(c.weapon)} - placeholder affix loadouts you can fill in.</p>
    </header>
    <section class="card"><h2>About these builds</h2>
      <p>Each ${esc(c.name)} build below targets a budget tier: Green for starts, Blue for a solid mid build, Purple once you save up, and Legendary for the final min-maxed loadout. The loadouts and affix lists are coming soon; use the ${esc(c.name)} guide above for playstyle and the calculator to optimise each set in the meantime.</p>
    </section>
    ${cards}
    <section class="card"><h2>Ready to price a build?</h2>
      <p>Pull your own affix targets and get a cheapest loadout in seconds.</p>
      <a class="cta" href="/?class=${c.slug}">Open the ${esc(c.name)} build calculator</a>
      <a class="cta alt" href="/guides/${c.slug}/">${esc(c.name)} class guide</a>
    </section>
  `;
  return head(title, desc, canon, breadcrumb([['Mistfall build calculator', 'https://www.mistfallcalc.com/'], [`${c.name} build guide`, canon]])) + topNav('builds') + content + tail();
}


// ----------------------------------------------------------------
// Site pages (About / Feedback / Privacy / Terms)
// ----------------------------------------------------------------
const SITE_PAGES = [
  { slug: 'about', title: 'About the Mistfall Hunter Build Calculator',
    body: `
    <section class="card"><h2>What is this?</h2>
      <p>The Mistfall build calculator is a free, fan-made tool that finds the cheapest gear, gem and socket loadout for any Mistfall Hunter class, weapon and affix combination.</p>
      <p>It is built by Squigle, inspired by the stream and the community. It is not affiliated with Bellring Games and is not an official product.</p>
    </section>
    <section class="card"><h2>How the calculator works</h2>
      <p>You pick a class, a weapon, and the affix levels you want (up to 40 combined). An optimizer that runs entirely in your browser tests every usable combination of gear and gems against average market prices and returns the cheapest loadouts first.</p>
      <p>All data - gear, gems, affixes and prices - is taken from public game data and the Mistfall Hunter community database, and is refreshed whenever the meta shifts.</p>
    </section>
    <section class="card"><h2>Why it is free</h2>
      <p>This is a fan project. If it helps you, support the stream on Twitch and Ko-fi - that keeps the tool alive.</p>
      <a class="cta" href="/">Open the calculator</a>
    </section>` },
  { slug: 'feedback', title: 'Feedback - Mistfall Hunter Build Calculator',
    short: `
    <section class="card"><h2>General feedback</h2>
      <p>The fastest way to get changes made is the in-app feedback form on the calculator.</p>
      <a class="cta" href="/?feedback=1">Open general feedback</a>
    </section>
    <section class="card"><h2>Send feedback</h2>
      <p>The fastest way to get changes made is via the in-app Report button under any gear slot, or by writing on the Discord below.</p>
    </section>
    <section class="card"><h2>Useful links</h2>
      <ul style="list-style:none;">
        <li><a href="https://discord.gg/bXuR4Eh2DV">\u2192 Join squigle's discord to check on your feedback updates or join the community</a></li>
        <li><a href="https://linktr.ee/squigleV2">\u2192 Linktree (Twitch, YouTube, socials)</a></li>
        <li><a href="https://youtu.be/5muPcO9QjuM">\u2192 Quick video on error with gem slots</a></li>
      </ul>
    </section>` },
  { slug: 'privacy-policy', title: 'Privacy Policy - Mistfall Hunter Build Calculator',
    short: `
    <section class="card"><h2>Privacy Policy</h2>
      <p>The calculator runs fully in your browser. It does not require an account and does not collect personal information.</p>
      <ul>
        <li><b>No sign-up:</b> you can use the whole tool without an account.</li>
        <li><b>Third-party embeds:</b> the page may load Twitch, Ko-fi and external resources such as the WdThing build database. Those providers have their own privacy policies.</li>
        <li><b>Feedback:</b> any feedback you submit (class, gear, affixes) is only used to improve the tool.</li>
      </ul>
    </section>` },
  { slug: 'terms-of-use', title: 'Terms of Use - Mistfall Hunter Build Calculator',
    short: `
    <section class="card"><h2>Terms of Use</h2>
      <p>Mistfall Hunter is a trademark of Bellring Games. This website is an unofficial fan tool and is not affiliated with Bellring Games.</p>
      <ul>
        <li>Use the calculator for personal, non-commercial purposes.</li>
        <li>Prices and data are estimates and can change.</li>
        <li>The tool is provided as-is, without warranty.</li>
      </ul>
    </section>` }
];

function sitePage(sp) {
  const canon = `${SITE}/${sp.slug}/`;
  const title = sp.title;
  const desc = title + ' - FAQ by Squigle.';
  return head(title, desc, canon, breadcrumb([['Mistfall build calculator', 'https://www.mistfallcalc.com/'], [sp.slug, canon]])) + topNav('about') + `
    <header class="guide"><h1>${esc(sp.title)}</h1></header>
    ${sp.body || sp.short}
  ` + tail();
}

// ----------------------------------------------------------------
// Write everything
// ----------------------------------------------------------------
function write(dir, html) { mkdirSync(dir, { recursive: true }); writeFileSync(dir + '/index.html', html); console.log('wrote', dir); }

for (const c of CLASSES) {
  write(join(OUT, 'guides', c.slug), guidePage(c));
  write(join(OUT, 'builds', c.slug), buildPage(c));
}
for (const sp of SITE_PAGES) write(join(OUT, sp.slug), sitePage(sp));
console.log('gen-guide-pages: done');
