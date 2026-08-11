// Static per-class SEO landing pages generator.
// Run: node scripts/gen-class-pages.mjs
// Writes frontend/public/{slug}-build-calculator/index.html for each class.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'frontend', 'public');
const urlFor = s => `https://www.mistfallcalc.com/${s}-build-calculator/`;

// Original copy only - never reuse competitor (MistfallDB) wording.
const CLASSES = [
  { slug: 'mercenary', name: 'Mercenary', role: 'Bruiser', weapon: 'Sword & Shield / Hammer',
    title: 'Mistfall Mercenary Build Calculator — Cheapest Mercenary Gear & Gems',
    desc: 'Free Mistfall Mercenary build calculator. Find the cheapest sword-and-board or hammer gear, gem and socket loadout for your bruiser affixes.',
    blurb: 'The Mercenary is the frontline bruiser of Mistfall Hunter — a sword-and-board or hammer Hunter built to take hits, hold ground and keep pushing. It is the most forgiving class to gear, and cheap upgrades usually come from armour with defensive built-in affixes rather than rare weapon rolls.',
    help: 'Pick the affixes your tank build needs — defence, block, HP — and the calc finds the cheapest Mercenary gear, gems and sockets that hit your targets, so you can spend your gold on the ring and necklace slots where the real price differences live.',
    },
  { slug: 'sorcerer', name: 'Sorcerer', role: 'Mage', weapon: 'Staff',
    title: 'Mistfall Sorcerer Build Calculator — Cheapest Sorcerer Gear & Gems',
    desc: 'Free Mistfall Sorcerer build calculator. Find the cheapest staff, gear and gem loadout for your burst-mage affixes, optimised against average market prices.',
    blurb: 'The Sorcerer is a ranged burst caster that scales with Magical Increase, leaning on the staff to delete targets from a safe distance. Staff prices swing hard with the meta, so Sorcerer builds are usually where the calculator saves the most gold.',
    help: 'Select your spell affixes — Magical Increase, cooldown, mana — and the calc finds the cheapest staff plus the armour that slots the same affixes, and shows exactly which gems to buy instead of overpaying for gear with built-in rolls.',
    },
  { slug: 'blackarrow', name: 'Blackarrow', role: 'Ranged', weapon: 'Bow',
    title: 'Mistfall Blackarrow Build Calculator — Cheapest Blackarrow Gear & Gems',
    desc: 'Free Mistfall Blackarrow build calculator. Find the cheapest bow loadout for your crit and physical-damage affixes — every slot optimised for gold.',
    blurb: 'The Blackarrow is the dedicated archer — a bow Hunter that controls space from range and turns positioning and physical damage into safe, sustained DPS. Bow affixes like crit and physical damage drive most of the build cost.',
    help: 'Enter the exact affixes your bow build wants and the calc returns the cheapest Blackarrow gear and gem loadout ranked by price, so you never spend legendary money where a rare piece does the same job.',
    },
  { slug: 'shadowstrix', name: 'Shadowstrix', role: 'Assassin', weapon: 'Dagger / Dual Blades',
    title: 'Mistfall Shadowstrix Build Calculator — Cheapest Shadowstrix Gear & Gems',
    desc: 'Free Mistfall Shadowstrix build calculator. Find the cheapest dagger or dual-blade assassin loadout for your crit affixes, priced against average market prices.',
    blurb: 'The Shadowstrix is a high-mobility assassin built for daggers and dual blades — it closes distance, opens with critical strikes, and disengages before retaliation lands. Cheap Shadowstrix builds live or die by their weapon and crit scaling.',
    help: 'Choose your crit and dagger affixes, then let the calc find the cheapest Shadowstrix loadout — every slot, socket and gem priced and optimised against average market prices.',
    },
  { slug: 'seer', name: 'Seer', role: 'Support', weapon: 'Catalyst / Mace',
    title: 'Mistfall Seer Build Calculator — Cheapest Seer Gear & Gems',
    desc: 'Free Mistfall Seer build calculator. Find the cheapest Catalyst gear, gem and socket loadout to hit your healing and support affixes on a budget.',
    blurb: 'The Seer is the healing-focused support class, built around the catalyst and Healing Bonus to keep a party alive through tough pulls. Because so many Seer affixes are cheap to equip, a good calculator saves real gold here.',
    help: 'Pick your healing and support affixes and the Seer build calculator returns the cheapest gear, gem and socket loadout that keeps your party topped up on a budget.',
    },
  { slug: 'withered-knight', name: 'Withered Knight', role: 'Heavy', weapon: 'Greatsword',
    title: 'Mistfall Withered Knight Build Calculator — Cheapest Withered Knight Gear & Gems',
    desc: 'Free Mistfall Withered Knight build calculator. Optimise the six gear slots around your greatsword and find the cheapest heavy loadout for your affixes.',
    blurb: 'The Withered Knight is a heavy greatsword specialist — slower attacks with huge reach and poise, built to break toughness and bully the frontline. Greatswords are the most expensive slot in the game, so optimising the other six slots is where the gold is.',
    help: 'Enter the affixes for your Wither or defensive build and the calc finds the cheapest Withered Knight gear around that greatsword, so the rest of your loadout never drains your stash.',
    }
];

// Uniform FAQ shared by every class page: the same set of questions on all six
// classes, with the weapon answer pulled from each class's real weapon data.
const CLASS_FAQ = [
  {
    q: c => `Is the Mistfall ${c.name} build calculator free?`,
    a: c => `Yes — it is free, needs no sign-up, shows no ads, and runs entirely in your browser. It is an unofficial fan tool by Squigle, not affiliated with Bellring Games.`
  },
  {
    q: c => `How does the ${c.name} build calculator find the cheapest build?`,
    a: c => `It tries every legal combination of ${c.name} gear, gems and sockets against average market prices and returns the cheapest loadout that reaches your chosen affix levels.`
  },
  {
    q: c => `Which weapons does the ${c.name} build calculator support?`,
    a: c => `The ${c.name} build calculator supports ${c.weapon}. Switch weapons and the whole loadout re-optimises automatically.`
  },
  {
    q: c => `Does the ${c.name} build calculator include gem and socket prices?`,
    a: c => `Yes — gear, gems and sockets are all priced at average market prices, so the total shown covers the full loadout cost.`
  },
  {
    q: () => 'Why can I not see all Necklaces and Rings?',
    a: () => 'The calculator shows only the possible combinations of gear plus Necklaces and Rings that can create your build. If you have found a build that includes a specific ring or necklace, please leave some feedback and I will update accordingly.'
  }
];

function page(c) {
  const others = CLASSES.map(o => {
    const cur = o.slug === c.slug ? ' class="current"' : '';
    return `        <li><a${cur} href="/${o.slug}-build-calculator/">${o.name} build calculator</a></li>`;
  }).join('\n');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${c.title}</title>
  <meta name="description" content="${c.desc}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${urlFor(c.slug)}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Mistfall Hunter Build Calculator" />
  <meta property="og:title" content="${c.title}" />
  <meta property="og:description" content="${c.desc}" />
  <meta property="og:url" content="${urlFor(c.slug)}" />
  <meta property="og:image" content="https://www.mistfallcalc.com/og-image.png" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${c.title}" />
  <meta name="twitter:description" content="${c.desc}" />
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Mistfall ${c.name} Build Calculator",
    "url": "${urlFor(c.slug)}",
    "description": "${c.desc}",
    "applicationCategory": "GameApplication",
    "operatingSystem": "Any (web browser)",
    "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
    "author": { "@type": "Person", "name": "Squigle", "url": "https://github.com/squiglesquigles" },
    "breadcrumb": {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Mistfall Build Calculator", "item": "https://www.mistfallcalc.com/" },
        { "@type": "ListItem", "position": 2, "name": "Mistfall ${c.name} Build Calculator", "item": "${urlFor(c.slug)}" }
      ]
    }
  }
  </script>

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
${CLASS_FAQ.map(f => `      {
        "@type": "Question",
        "name": "${f.q(c)}",
        "acceptedAnswer": { "@type": "Answer", "text": "${f.a(c)}" }
      }`).join(',\n')}
    ]
  }
  </script>

  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0c0d11; color: #e5e7eb; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.65; padding: 32px 20px 48px; }
    .wrap { max-width: 860px; margin: 0 auto; }
    header { border-bottom: 1px solid #2a2b36; padding-bottom: 16px; margin-bottom: 24px; }
    h1 { color: #c9a54a; font-size: 28px; font-weight: 700; }
    .sub { color: #b9c0cc; font-size: 16px; margin-top: 8px; }
    .card { background: #14151c; border: 1px solid #2a2b36; border-radius: 12px; padding: 20px 24px; margin-bottom: 20px; }
    .card h2 { color: #c9a54a; font-size: 20px; margin-bottom: 12px; }
    .card p { font-size: 16px; color: #b9c0cc; margin-bottom: 12px; }
    .meta { color: #f3f4f6; font-weight: 600; }
    .cta { display: inline-block; background: #c9a54a; color: #0c0d11; font-weight: 700; padding: 12px 20px; border-radius: 8px; text-decoration: none; margin-top: 8px; }
    .classes ul { list-style: none; display: flex; flex-wrap: wrap; gap: 8px 16px; }
    .classes li a { color: #c9a54a; text-decoration: none; }
    .classes li a.current { color: #f3f4f6; border-bottom: 1px solid #c9a54a; }
    footer { border-top: 1px solid #2a2b36; margin-top: 24px; padding-top: 16px; color: #6b7280; font-size: 12px; }
    footer a { color: #c9a54a; }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <h1>Mistfall ${c.name} Build Calculator</h1>
      <p class="sub">Find the cheapest ${c.name} gear, gem and socket loadout for your affixes — ${c.role} · ${c.weapon}</p>
    </header>

    <section class="card">
      <h2>About the ${c.name}</h2>
      <p>${c.blurb}</p>
      <p class="meta">Role: ${c.role} · Weapon(s): ${c.weapon}</p>
    </section>

    <section class="card">
      <h2>How the Mistfall ${c.name} calc helps</h2>
      <p>${c.help}</p>
      <a class="cta" href="/?class=${c.slug}">Open the ${c.name} build calculator →</a>
    </section>

    <section class="card">
      <h2>${c.name} build calculator — FAQ</h2>
${CLASS_FAQ.map(f => `      <p><strong>${f.q(c)}</strong></p>
      <p>${f.a(c)}</p>`).join('\n')}
    </section>

    <nav class="card classes">
      <h2>All Mistfall class calculators</h2>
      <ul>
${others}
        <li><a href="/">Mistfall build calculator — all classes</a></li>
      </ul>
    </nav>

    <footer>
      mistfallcalc.com — free Mistfall Hunter build calculator by Squigle. Not affiliated with Bellring Games.
      <a href="/">← Back to the main Mistfall build calculator</a>
    </footer>
  </div>
</body>
</html>
`;
}

for (const c of CLASSES) {
  const dir = join(OUT, `${c.slug}-build-calculator`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), page(c));
  console.log('wrote ' + c.slug);
}
