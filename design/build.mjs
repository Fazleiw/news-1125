// Builds design/atlas.html: a 1024x1024 front page of the world news of Wednesday 25 November 2026.
// Deterministic: no randomness, no clock, no network, system fonts only. Map data: Natural Earth via world-atlas (data/).
// CHECK=1 node design/build.mjs adds a layout checker to the page (clipping, band slack, pins, font sizes);
// render.sh never sets it. Every story, place and figure traces to a row of design/sources.md (src: row number).
//
// Page, top to bottom: masthead with the date / three-teaser deck / 4 lead stories with scenes / 8 second-tier
// stories with scenes / locator map + "Also on Wednesday" (24 one-liners) / closing line restating the date.
//
// Type scale, px at 1024 (nothing smaller than 15): 96 date / 34 lead figure / 25 second figure / 21 lead headline /
// 19 deck / 18 legend / 17 masthead strap, closing line / 16 card headline, digest, lead place / 15 place, numbers, sources.
import { readFileSync, writeFileSync } from 'node:fs';

const here = new URL('./', import.meta.url);
const topo = JSON.parse(readFileSync(new URL('data/countries-110m.json', here)));

// ---- palette ----------------------------------------------------------------------------------
// Paper, ink, one accent (figures, the strike marks) and one secondary (ochre). The six region colours appear only on
// number chips, map pins and the legend; each carries white numbers at >= 4.5:1.
const PAPER = '#F4F0E6', INK = '#191C22', ACC = '#C0391F', OCHRE = '#C9952E';
const MUTE = '#3E424A', PANEL = '#E4DED0', LIGHT = '#FBF8F1', SMOKE = '#8E9094', SEA = '#6F95A6', EUBLUE = '#22409A';
const REGION = {
  Asia: '#A8285F', Americas: '#2356A0', Europe: '#6A3D9A',
  'Middle East': '#8F5400', Africa: '#2C7232', Oceania: '#0B6E7A',
};
const REGION_ORDER = Object.keys(REGION);
const WORLD = INK; // the one story with no single place (UN figures) uses an ink chip and has no pin

// ---- page bands (y, px at 1024) ---------------------------------------------------------------
const W = 1024, M = 20;
const HEAD_H = 118, DECK_Y = 126, DECK_H = 30, RULE_Y = 163, LEAD_Y = 172, LEAD_H = 256;
const SEC_Y = LEAD_Y + LEAD_H + 12, SEC_ROW = 112, SEC_GAP = 10, SEC_H = 2 * SEC_ROW + SEC_GAP;
const FOOT_H = 52, FOOT_Y = W - FOOT_H, LOW_Y = SEC_Y + SEC_H + 12, LOW_H = FOOT_Y - 6 - LOW_Y;
const COL_GAP = 14, COL_W = (W - 2 * M - 3 * COL_GAP) / 4;

// ---- projection (Miller, cropped to where the day's stories are) ------------------------------
const MAP_W = 304, LON0 = -100, LON1 = 166, LAT_TOP = 63, LAT_BOT = -42, K = MAP_W / (LON1 - LON0);
const miller = (lat) => 1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * lat * Math.PI / 180)) * 180 / Math.PI;
const MAP_H = Math.round((miller(LAT_TOP) - miller(LAT_BOT)) * K);
const px = (lon, lat) => [(lon - LON0) * K, (miller(LAT_TOP) - miller(lat)) * K];

// ---- topojson decode --------------------------------------------------------------------------
const [sx, sy] = topo.transform.scale, [tx, ty] = topo.transform.translate;
const arcs = topo.arcs.map((a) => {
  let x = 0, y = 0;
  return a.map(([dx, dy]) => { x += dx; y += dy; return [x * sx + tx, y * sy + ty]; });
});
const ring = (idx) => {
  const pts = [];
  for (const i of idx) {
    const a = i < 0 ? arcs[~i].slice().reverse() : arcs[i];
    pts.push(...(pts.length ? a.slice(1) : a));
  }
  return pts;
};
const ringPath = (pts) => {
  let d = '';
  pts.forEach(([lo, la], i) => {
    const [x, y] = px(lo, Math.max(la, -80));
    d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
  });
  return d + 'Z';
};
const geomPath = (g) => {
  const polys = g.type === 'Polygon' ? [g.arcs] : g.type === 'MultiPolygon' ? g.arcs : [];
  return polys.map((p) => p.map((r) => ringPath(ring(r))).join('')).join('');
};
let land = '';
for (const g of topo.objects.countries.geometries) {
  if (g.properties.name !== 'Antarctica') land += geomPath(g);
}

// ---- illustration primitives ------------------------------------------------------------------
// Bold flat shapes, no hairlines: every scene has to stay an object at 300 px. Nothing is drawn that the row does not say.
const burst = (cx, cy, r) => {
  let d = '';
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8 - Math.PI / 2, rr = i % 2 ? r * 0.5 : r;
    d += (i ? 'L' : 'M') + (cx + rr * Math.cos(a)).toFixed(1) + ' ' + (cy + rr * Math.sin(a)).toFixed(1);
  }
  return `<path d="${d}Z" fill="${ACC}"/><circle cx="${cx}" cy="${cy}" r="${(r * 0.34).toFixed(1)}" fill="${OCHRE}"/>`;
};
const chip = (x, y, s, die = OCHRE) => {
  let pins = '';
  for (let i = 0; i < 4; i++) {
    const o = (12 + i * 20) * s;
    pins += `M${x + o} ${y - 10 * s}v${10 * s}M${x + o} ${y + 84 * s}v${10 * s}M${x - 10 * s} ${y + o}h${10 * s}M${x + 84 * s} ${y + o}h${10 * s}`;
  }
  return `<path d="${pins}" stroke="${INK}" stroke-width="${7 * s}"/>` +
    `<rect x="${x}" y="${y}" width="${84 * s}" height="${84 * s}" rx="${7 * s}" fill="${INK}"/>` +
    `<rect x="${x + 22 * s}" y="${y + 22 * s}" width="${40 * s}" height="${40 * s}" fill="${die}"/>`;
};
const gavel = (x, y, s, a) =>
  `<g transform="translate(${x} ${y}) rotate(${a}) scale(${s})" fill="${INK}">` +
  `<rect x="-6" y="0" width="12" height="62" rx="4"/><rect x="-28" y="-20" width="56" height="26" rx="5"/>` +
  `<rect x="-32" y="-23" width="9" height="32" rx="3"/><rect x="23" y="-23" width="9" height="32" rx="3"/></g>`;
const person = (x, y, s, fill = INK) =>
  `<g transform="translate(${x} ${y}) scale(${s})" fill="${fill}"><circle cx="0" cy="-34" r="8"/>` +
  `<path d="M-10 -22H10L13 6H5L4 30H-4L-5 6H-13Z"/></g>`;
const woman = (x, y, fill) =>
  `<g transform="translate(${x} ${y})" fill="${fill}"><circle cx="0" cy="-23" r="5"/><path d="M-4 -16H4L9 4H-9Z"/>` +
  `<rect x="-4" y="4" width="3" height="7"/><rect x="1" y="4" width="3" height="7"/></g>`;
const star = (cx, cy, r, fill) => {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r;
    d += (i ? 'L' : 'M') + (cx + rr * Math.cos(a)).toFixed(2) + ' ' + (cy + rr * Math.sin(a)).toFixed(2);
  }
  return `<path d="${d}Z" fill="${fill}"/>`;
};
const art = (vw, vh, bg, body) =>
  `<svg viewBox="0 0 ${vw} ${vh}" preserveAspectRatio="xMidYMid slice"><rect width="${vw}" height="${vh}" fill="${bg}"/>${body}</svg>`;

// ---- lead scenes (viewBox 236 x 112) ----------------------------------------------------------
const LEAD_ART = {
  // Stacked shipping containers on a quay and a red arrow going up: tariffs to rise.
  tariffs: () => art(236, 112, PANEL, `
<rect y="98" width="236" height="14" fill="${INK}"/>
<rect x="12" y="72" width="44" height="26" fill="${INK}"/><rect x="58" y="72" width="44" height="26" fill="${OCHRE}"/><rect x="104" y="72" width="44" height="26" fill="${MUTE}"/>
<rect x="35" y="44" width="44" height="26" fill="${OCHRE}"/><rect x="81" y="44" width="44" height="26" fill="${INK}"/>
<rect x="58" y="16" width="44" height="26" fill="${MUTE}"/>
<path d="M22 72v26M34 72v26M46 72v26M68 72v26M80 72v26M92 72v26M114 72v26M126 72v26M138 72v26M45 44v26M57 44v26M69 44v26M91 44v26M103 44v26M115 44v26M68 16v26M80 16v26M92 16v26" stroke="${PANEL}" stroke-opacity=".45" stroke-width="3"/>
<rect x="176" y="46" width="30" height="52" fill="${ACC}"/><path d="M158 50L191 8L224 50Z" fill="${ACC}"/>`),

  // A market board with a red line falling hard, beside a microchip: chip stocks slide.
  chips: () => art(236, 112, PANEL, `
<rect x="10" y="10" width="146" height="92" rx="6" fill="${INK}"/>
<path d="M18 36H148M18 60H148M18 84H148" stroke="#394049" stroke-width="3"/>
<path d="M22 26L44 34L60 28L82 58L100 50L124 80L136 84" fill="none" stroke="${ACC}" stroke-width="8" stroke-linejoin="round" stroke-linecap="round"/>
<path d="M128 70L148 92L120 94Z" fill="${ACC}"/>
${chip(172, 30, 0.6)}`),

  // A tall tower over low buildings; a delta-wing drone on a dashed track, and the hit near the top.
  riyadh: () => art(236, 112, PANEL, `
<rect y="98" width="236" height="14" fill="${OCHRE}"/>
<path d="M14 98V64H44V98ZM48 98V76H74V98ZM160 98V70H190V98ZM194 98V80H222V98Z" fill="${MUTE}"/>
<path d="M90 98L98 10H126L134 98Z" fill="${INK}"/><path d="M104 10Q112 26 120 10Z" fill="${PANEL}"/>
<path d="M102 40H122M101 54H123M100 68H124M99 82H125" stroke="${LIGHT}" stroke-width="4"/>
<path d="M216 18L138 28" stroke="${ACC}" stroke-width="5" stroke-dasharray="9 7"/>
<path d="M196 18L230 4L222 18L230 32Z" fill="${INK}"/>
${burst(126, 28, 17)}`),

  // A long wooden boat crowded with people, on the open sea; a radio signal crossed out: contact lost.
  boat: () => art(236, 112, PANEL, `
<rect y="70" width="236" height="42" fill="${SEA}"/>
<path d="M0 88q10 -8 20 0t20 0t20 0t20 0t20 0t20 0t20 0t20 0t20 0t20 0t20 0t20 0M0 104q10 -8 20 0t20 0t20 0t20 0t20 0t20 0t20 0t20 0t20 0t20 0t20 0t20 0" fill="none" stroke="${LIGHT}" stroke-width="4"/>
${[24, 38, 52, 66, 80, 94, 108, 122, 136, 150].map((x) => `<circle cx="${x}" cy="${x % 28 ? 52 : 50}" r="6.5" fill="${INK}"/><rect x="${x - 6}" y="57" width="12" height="14" rx="3" fill="${INK}"/>`).join('')}
<path d="M8 66H176L160 88Q92 96 24 88Z" fill="${OCHRE}"/><path d="M14 72H170" stroke="${INK}" stroke-width="4"/>
<circle cx="206" cy="38" r="6" fill="${INK}"/>
<path d="M192 26A20 20 0 0 1 220 26M184 16A32 32 0 0 1 228 16" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
<path d="M186 6L226 50" stroke="${ACC}" stroke-width="7" stroke-linecap="round"/>`),
};

// ---- second-tier scenes (viewBox 88 x 78) -----------------------------------------------------
const SPOT = {
  // A rocket climbing on its flame, launch smoke below.
  rocket: () => art(88, 78, PANEL, `
<circle cx="24" cy="74" r="12" fill="${SMOKE}"/><circle cx="44" cy="76" r="13" fill="${SMOKE}"/><circle cx="64" cy="74" r="12" fill="${SMOKE}"/>
<path d="M36 52L44 74L52 52Z" fill="${ACC}"/><path d="M40 52L44 64L48 52Z" fill="${OCHRE}"/>
<path d="M36 22Q36 6 44 0Q52 6 52 22V52H36Z" fill="${LIGHT}" stroke="${INK}" stroke-width="3"/>
<path d="M36 36L26 54H36ZM52 36L62 54H52Z" fill="${INK}"/><path d="M38 14H50" stroke="${ACC}" stroke-width="5"/>
<circle cx="14" cy="14" r="2.5" fill="${INK}"/><circle cx="74" cy="22" r="2.5" fill="${INK}"/>`),
  // A gavel coming down on a microchip.
  huawei: () => art(88, 78, PANEL, `
<rect x="6" y="68" width="76" height="10" fill="${INK}"/>${chip(14, 40, 0.3)}${gavel(58, 22, 0.55, 40)}
<path d="M36 22l-6-6M46 18V10M56 22l6-6" stroke="${ACC}" stroke-width="4"/>`),
  // The EU flag: twelve gold stars on blue.
  eu: () => art(88, 78, PANEL, `
<rect x="6" y="8" width="76" height="60" fill="${EUBLUE}"/>
${Array.from({ length: 12 }, (_, i) => star(44 + 19 * Math.cos(i * Math.PI / 6), 38 + 19 * Math.sin(i * Math.PI / 6), 5, '#F2C230')).join('')}`),
  // A clock over five women: five an hour.
  un: () => art(88, 78, PANEL, `
<circle cx="44" cy="20" r="16" fill="${LIGHT}" stroke="${INK}" stroke-width="4"/>
<path d="M44 10V20L51 25" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
${[12, 28, 44, 60, 76].map((x) => woman(x, 66, ACC)).join('')}`),
  // A signed treaty and a pen.
  treaty: () => art(88, 78, PANEL, `
<rect x="12" y="6" width="48" height="66" fill="${LIGHT}" stroke="${INK}" stroke-width="3"/>
<path d="M20 18H52M20 28H52M20 38H52M20 48H40" stroke="${INK}" stroke-width="4"/>
<path d="M20 61q5 -9 9 0t9 0t9 0" fill="none" stroke="${ACC}" stroke-width="3.5"/>
<g transform="translate(66 46) rotate(35)"><rect x="-5" y="-38" width="10" height="34" rx="3" fill="${INK}"/><path d="M-5 -4H5L0 8Z" fill="${OCHRE}"/></g>`),
  // A supermarket front, trolley sign in the window, people walking out of the open door.
  market: () => art(88, 78, PANEL, `
<rect x="4" y="8" width="80" height="62" fill="${INK}"/>
<path d="M4 8H84V22H4Z" fill="${ACC}"/><path d="M14 8V22M28 8V22M42 8V22M56 8V22M70 8V22" stroke="${LIGHT}" stroke-width="6"/>
<rect x="10" y="28" width="34" height="24" fill="${LIGHT}"/>
<path d="M13 32H18L22 44H38L41 35H20" fill="none" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
<circle cx="24" cy="48" r="2.5" fill="${INK}"/><circle cx="36" cy="48" r="2.5" fill="${INK}"/>
<rect x="52" y="30" width="26" height="40" fill="${LIGHT}"/>
<rect y="70" width="88" height="8" fill="${MUTE}"/>
${person(58, 52, 0.6, OCHRE)}${person(72, 54, 0.6, OCHRE)}`),
  // A military helicopter going down nose-first, trailing smoke.
  heli: () => art(88, 78, PANEL, `
<rect y="70" width="88" height="8" fill="${OCHRE}"/>
<circle cx="74" cy="20" r="8" fill="${SMOKE}"/><circle cx="82" cy="10" r="7" fill="${SMOKE}"/><circle cx="64" cy="28" r="6" fill="${SMOKE}"/>
<g transform="translate(38 42) rotate(24)" fill="${INK}">
<rect x="-34" y="-20" width="68" height="5" rx="2"/><rect x="-2" y="-18" width="4" height="8"/>
<path d="M-22 -10H8Q22 -10 22 2Q22 12 8 12H-22Z"/><rect x="18" y="-4" width="28" height="6"/><rect x="42" y="-12" width="5" height="16"/>
<path d="M-18 16H14" stroke="${INK}" stroke-width="4"/></g>`),
  // A garment on a hanger and a red arrow up: the wage rise.
  wage: () => art(88, 78, PANEL, `
<path d="M32 4q6 -4 10 2" fill="none" stroke="${INK}" stroke-width="3"/>
<path d="M18 16L30 10Q37 17 44 10L56 16L64 30L55 35L53 31V72H21V31L19 35L10 30Z" fill="${LIGHT}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
<path d="M30 10Q37 17 44 10" fill="none" stroke="${INK}" stroke-width="3"/>
<rect x="70" y="34" width="10" height="36" fill="${ACC}"/><path d="M63 38L75 20L87 38Z" fill="${ACC}"/>`),
};

// ---- stories ----------------------------------------------------------------------------------
// src: the row in design/sources.md. fig: the one figure the card leads with (sources.md, column 5).
// loc: where the pin goes; stories with no single place (src 13) have none.
const LEAD = [
  { src: 3, art: 'tariffs', loc: [-77.04, 38.9], region: 'Americas', place: 'Washington',
    fig: '16 economies', hd: 'Trump to raise tariffs on China, the EU and 14 more economies' },
  { src: 2, art: 'chips', loc: [126.98, 37.57], region: 'Asia', place: 'Seoul · Taipei · Tokyo',
    fig: 'Kospi −6.2%', hd: 'Asia’s chip stocks slide as the AI rally stumbles' },
  { src: 10, art: 'riyadh', loc: [46.68, 24.71], region: 'Middle East', place: 'Riyadh, Saudi Arabia',
    fig: '2nd strike', hd: 'Houthi drone hits Riyadh’s tallest tower twice in a week' },
  { src: 24, art: 'boat', loc: [-17.45, 14.7], region: 'Africa', place: 'Dakar, Senegal',
    fig: '175 missing', hd: 'About 175 migrants missing after a boat to Europe loses contact' },
];
const CARDS = [
  { src: 1, art: 'rocket', loc: [100.3, 40.96], region: 'Asia', place: 'Jiuquan, China',
    fig: '1st foreigner', hd: 'China flies Pakistan’s first astronaut to the Tiangong station' },
  { src: 4, art: 'huawei', loc: [-74.0, 40.71], region: 'Americas', place: 'New York',
    fig: 'Guilty', hd: 'US jury convicts Huawei of fraud; acquits on wider conspiracy' },
  { src: 7, art: 'eu', loc: [4.35, 50.85], region: 'Europe', place: 'Brussels',
    fig: '€50bn', hd: 'EU plans tech fund to cut reliance on US and Chinese tech' },
  { src: 13, art: 'un', region: 'World', place: 'Worldwide · UN',
    fig: '47,000 a year', hd: 'Relatives kill a woman every 11 minutes, UN says' },
  { src: 19, art: 'treaty', loc: [159.95, -9.43], region: 'Oceania', place: 'Solomon Islands',
    fig: 'Treaty signed', hd: 'Security treaty with Australia; Honiara rules out foreign bases' },
  { src: 26, art: 'market', loc: [-75.5, 10.4], region: 'Americas', place: 'Cartagena, Colombia',
    fig: 'All freed', hd: 'Security forces storm a supermarket and free the hostages' },
  { src: 28, art: 'heli', loc: [30.52, 39.78], region: 'Middle East', place: 'Eskişehir, Turkey',
    fig: '5 killed', hd: 'Turkish soldiers die in a military helicopter crash' },
  { src: 14, art: 'wage', loc: [90.4, 23.8], region: 'Asia', place: 'Dhaka, Bangladesh',
    fig: '17,000 taka', hd: 'Garment minimum wage up 36% after protests' },
];
// Grouped by region in legend order, so the chip colours run in blocks down the columns.
const DIGEST = [
  { src: 5, loc: [116.4, 39.9], region: 'Asia', hd: 'Xi purges a 4th Politburo member' },
  { src: 20, loc: [116.4, 39.9], region: 'Asia', hd: 'China extends US export‑curb pause' },
  { src: 8, loc: [139.7, 35.7], region: 'Asia', hd: 'SoftBank credit risk widest in 4 years' },
  { src: 15, loc: [125.75, 39.03], region: 'Asia', hd: 'N Korea expels Swiss mission head' },
  { src: 16, loc: [126.98, 37.57], region: 'Asia', hd: 'S Korea drafts stablecoin rules' },
  { src: 17, loc: [129.3, 35.5], region: 'Asia', hd: 'Aramco, S‑Oil open $7bn Ulsan plant' },
  { src: 6, loc: [-74.0, 40.71], region: 'Americas', hd: 'Jensen Huang back as Nvidia CEO' },
  { src: 9, loc: [-77.04, 38.9], region: 'Americas', hd: 'Traders: 97% odds of Dec rate rise' },
  { src: 30, loc: [-77.15, 38.95], region: 'Americas', hd: 'CIA and ODNI report a cyber breach' },
  { src: 25, loc: [-66.9, 10.5], region: 'Americas', hd: 'Venezuela discloses $237bn debt' },
  { src: 27, loc: [-73.1, 5.5], region: 'Americas', hd: 'Colombia: car bomb wrecks govt HQ' },
  { src: 36, loc: [-82.36, 23.1], region: 'Americas', hd: 'WHO: lift US fuel blockade on Cuba' },
  { src: 21, loc: [13.4, 52.5], region: 'Europe', hd: 'Merz: Russia wants more than Ukraine' },
  { src: 22, loc: [30.5, 50.45], region: 'Europe', hd: 'Zelenskyy and Magyar hail a new era' },
  { src: 23, loc: [7.45, 46.95], region: 'Europe', hd: 'Swiss frozen Russian assets: CHF 8.5bn' },
  { src: 11, loc: [42.95, 14.8], region: 'Middle East', hd: 'Hodeidah port told to evacuate' },
  { src: 12, loc: [39.2, 21.5], region: 'Middle East', hd: 'Houthis threaten Saudi Red Sea ports' },
  { src: 31, loc: [44.4, 33.3], region: 'Middle East', hd: 'Iraq PM orders Kurdish fields seized' },
  { src: 29, loc: [32.85, 39.93], region: 'Middle East', hd: 'Turkey: AKP founder Yazıcı quits post' },
  { src: 32, loc: [7.5, 9.06], region: 'Africa', hd: 'Tinubu: cut budget to 65.2trn naira' },
  { src: 33, loc: [47.5, -18.9], region: 'Africa', hd: 'Madagascar MPs remove the speaker' },
  { src: 34, loc: [28.05, -26.2], region: 'Africa', hd: 'S Africa jails recruit for Russia’s army' },
  { src: 35, loc: [32.57, -25.97], region: 'Africa', hd: 'Mozambique: EU military aid to 2028' },
  { src: 18, loc: [149.13, -35.28], region: 'Oceania', hd: 'Australia apologises to LGBTQ troops' },
];
// Numbering is assigned here, in reading order, so no literal can drift out of sync.
const ALL = [...LEAD, ...CARDS, ...DIGEST];
ALL.forEach((s, i) => { s.n = i + 1; });
const FEATURED = LEAD.length + CARDS.length;
const srcs = ALL.map((s) => s.src).sort((a, b) => a - b);
if (srcs.length !== 36 || srcs.some((v, i) => v !== i + 1)) throw new Error('every sources.md row must appear exactly once');
for (const s of ALL) if (!REGION[s.region] && s.region !== 'World') throw new Error('unknown region ' + s.region);
const tally = REGION_ORDER.map((r) => [r, ALL.filter((s) => s.region === r).length]);
const color = (s) => REGION[s.region] ?? WORLD;
const byRow = Object.fromEntries(ALL.map((s) => [s.src, s]));

// ---- map pins ---------------------------------------------------------------------------------
// Featured stories get a numbered pin in their region colour; off:[dx, dy] moves a crowded pin and draws a tick back.
const PIN_OFF = { 1: [-10, 12], 6: [6, -12], 10: [6, 8], 2: [6, 4], 5: [-6, -8], 12: [0, 8], 3: [4, 6], 11: [-6, -6], 7: [0, -6], 9: [-8, 0] };
const PIN = 18, PH = PIN / 2;
const f1 = (v) => +v.toFixed(1);
const geo = { pins: [] };
let dots = '', ticks = '', pins = '';
for (const s of DIGEST) {
  const [x, y] = px(...s.loc).map(f1);
  dots += `<circle cx="${x}" cy="${y}" r="3.6" fill="${color(s)}" stroke="#fff" stroke-width="1"/>`;
}
for (const s of [...LEAD, ...CARDS]) {
  if (!s.loc) continue;
  const [x, y] = px(...s.loc).map(f1);
  const [dx, dy] = PIN_OFF[s.n] ?? [0, 0];
  const X = f1(x + dx), Y = f1(y + dy);
  if (dx || dy) ticks += `<path d="M${x} ${y}L${X} ${Y}" stroke="${INK}" stroke-width="2"/>`;
  pins += `<g transform="translate(${X} ${Y})"><rect x="${-PH}" y="${-PH}" width="${PIN}" height="${PIN}" rx="4" fill="${color(s)}" stroke="#fff" stroke-width="1.5"/><text class="pn" y="5.5">${s.n}</text></g>`;
  geo.pins.push({ n: s.n, x: X, y: Y });
}

// ---- render -----------------------------------------------------------------------------------
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const num = (s) => `<span class="nb" style="background:${color(s)}"><i>${s.n}</i></span>`;
const kicker = (s) => `<div class="kick">${num(s)}<span class="pc">${esc(s.place)}</span></div>`;

const leads = LEAD.map((s) => `
<article class="lead">${kicker(s)}${LEAD_ART[s.art]()}<div class="fig">${esc(s.fig)}</div><h2 class="hd">${esc(s.hd)}</h2></article>`).join('');
const cards = CARDS.map((s) => `
<article class="card">${kicker(s)}<div class="cb">${SPOT[s.art]()}<div class="tx"><div class="fig2">${esc(s.fig)}</div><h3 class="h3">${esc(s.hd)}</h3></div></div></article>`).join('');
const digest = DIGEST.map((s) => `
<li>${num(s)}<span class="di">${esc(s.hd)}</span></li>`).join('');
const worldN = ALL.filter((s) => s.region === 'World').length;
const legend = [...tally, ...(worldN ? [['World', worldN]] : [])]
  .map(([r, c]) => `<span class="lg"><b style="background:${REGION[r] ?? WORLD}"></b>${r} ${c}</span>`).join('');
const teaser = (row, text) => `<span class="ts">${num(byRow[row])}<span>${esc(text)}</span></span>`;

// Layout checker (CHECK=1 only): measures the laid-out page, writes a JSON report into document.title.
const checker = !process.env.CHECK ? '' : `<script>try{
const out=[],G=${JSON.stringify(geo)},R=${PH};
const html=[...document.querySelectorAll('body *')].filter(e=>!e.closest('svg')&&e.tagName!=='SCRIPT');
const trimmed=(e)=>getComputedStyle(e).textBoxTrim!=='none'||[...e.querySelectorAll('*')].some(c=>getComputedStyle(c).textBoxTrim!=='none');
html.forEach(e=>{if(!e.clientWidth&&!e.clientHeight)return;const cs=getComputedStyle(e),dx=e.scrollWidth-e.clientWidth,dy=cs.overflow!=='visible'&&!trimmed(e)?e.scrollHeight-e.clientHeight:0;if(dx>1||dy>1)out.push('CLIP '+(e.className||e.tagName)+' '+dx+'x'+dy+': '+e.textContent.trim().slice(0,48))});
document.querySelectorAll('.lead,.card,.tx,.map,.also,.legend').forEach(e=>{const r=e.getBoundingClientRect();e.querySelectorAll('*').forEach(c=>{if(c.closest('svg')&&c.tagName!=='svg')return;const q=c.getBoundingClientRect();if(q.height&&(q.bottom>r.bottom+.5||q.right>r.right+.5))out.push('CLIP '+e.className+' child past edge: '+c.textContent.trim().slice(0,40))})});
const lines=(e)=>Math.round(e.getBoundingClientRect().height/parseFloat(getComputedStyle(e).lineHeight));
document.querySelectorAll('.hd').forEach(e=>lines(e)>3&&out.push('CLIP lead headline '+lines(e)+' lines: '+e.textContent));
document.querySelectorAll('.h3').forEach(e=>lines(e)>3&&out.push('CLIP card headline '+lines(e)+' lines: '+e.textContent));
document.querySelectorAll('.di,.fig,.fig2').forEach(e=>lines(e)>1&&out.push('CLIP wraps: '+e.textContent));
const bands=[...document.querySelectorAll('[data-b]')].map(e=>[e.dataset.b,e,e.getBoundingClientRect()]);
bands.forEach(([a,,r],i)=>{bands.slice(i+1).forEach(([b,,q])=>{if(r.bottom>q.top+.5&&q.bottom>r.top+.5)out.push('OVERLAP bands '+a+'/'+b)});if(r.bottom>1024.5||r.right>1024.5)out.push('OFF PAGE '+a)});
const slack=bands.map(([a,e,r])=>{const k=[...e.querySelectorAll('*')].filter(c=>!c.closest('svg')||c.tagName==='svg').reduce((m,c)=>Math.max(m,c.getBoundingClientRect().bottom),0);return a+' '+Math.round(r.bottom-k)});
out.push('band slack: '+slack.join(' | '));
bands.forEach(([a,e,r])=>e.querySelectorAll('*').forEach(c=>{if(c.closest('svg')&&c.tagName!=='svg')return;const q=c.getBoundingClientRect();if(q.bottom>r.bottom+.5)out.push('OFF BAND '+a+' by '+Math.round(q.bottom-r.bottom)+': '+((c.className.baseVal??c.className)||c.tagName)+' '+c.textContent.trim().slice(0,30))}));
const room=(sel)=>{let mn=1e9;document.querySelectorAll(sel).forEach(e=>{const b=e.getBoundingClientRect().bottom,k=[...e.children].reduce((m,c)=>Math.max(m,c.getBoundingClientRect().bottom),0);mn=Math.min(mn,b-k)});return Math.round(mn)};
out.push('inner room (min, px): lead '+room('.lead')+' | card text '+room('.tx')+' | map col '+room('.map')+' | digest col '+room('.also'));
G.pins.forEach((a,i)=>G.pins.slice(i+1).forEach(b=>Math.abs(a.x-b.x)<2*R+1&&Math.abs(a.y-b.y)<2*R+1&&out.push('PINS overlap '+a.n+'/'+b.n)));
G.pins.forEach(p=>(p.x<R||p.y<R||p.x>${MAP_W}-R||p.y>${MAP_H}-R)&&out.push('PIN off map '+p.n));
const sz=new Set();html.forEach(e=>{if([...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))sz.add(parseFloat(getComputedStyle(e).fontSize))});
document.querySelectorAll('svg text').forEach(e=>sz.add(parseFloat(getComputedStyle(e).fontSize)));
const s=[...sz].sort((a,b)=>a-b);out.push('font sizes '+s.join(','));out.push('min font '+s[0]+' px');
out.push(out.some(l=>/^(CLIP|OVERLAP|OFF|PINS|PIN )/.test(l))?'RESULT: problems above':'RESULT: no clipping, no overlap');
document.title=JSON.stringify(out);
}catch(e){document.title=JSON.stringify(['checker error: '+e.message])}</script>`;

const SANS = '"Avenir Next","Helvetica Neue",sans-serif';
const COND = '"Avenir Next Condensed","Avenir Next","Helvetica Neue",sans-serif';
const DATE = '"DIN Condensed","Avenir Next Condensed",sans-serif';
const html = `<!doctype html><html><head><meta charset="utf-8"><title>Wednesday 25 November 2026</title><style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1024px;height:1024px;overflow:hidden;background:${PAPER};color:${INK}}
body{position:relative;font:500 16px ${SANS};-webkit-font-smoothing:antialiased}
i{font-style:normal;text-box:trim-both cap alphabetic}
[data-b]{position:absolute;left:${M}px;width:${W - 2 * M}px}
.head{left:0;top:0;width:${W}px;height:${HEAD_H}px;background:${INK};color:${PAPER};padding:13px ${M}px 0;display:flex;flex-direction:column;justify-content:space-between}
.strap{display:flex;justify-content:space-between;font:700 17px/1 ${SANS};letter-spacing:.09em;text-transform:uppercase;color:#E9E3D6}
.strap b{color:#F2A58F;font-weight:800}
h1{font:700 96px/1 ${DATE};white-space:nowrap;padding-bottom:12px;text-box:trim-both cap alphabetic;color:#fff}
.deck{top:${DECK_Y}px;height:${DECK_H}px;display:flex;align-items:stretch;justify-content:space-between;font:700 19px/1 ${SANS};white-space:nowrap}
.ts{display:flex;align-items:center;gap:8px}
.ts>span:last-child{text-box:trim-both cap alphabetic}
.deck .nb{height:${DECK_H}px;min-width:30px;font-size:18px}
.rule{position:absolute;left:${M}px;width:${W - 2 * M}px;top:${RULE_Y}px;height:3px;background:${INK}}
.nb{display:inline-flex;align-items:center;justify-content:center;flex:none;min-width:26px;height:26px;padding:0 4px;color:#fff;font:800 16px/1 ${SANS}}
.kick{display:flex;align-items:center;gap:8px;height:26px;flex:none;border-bottom:3px solid ${INK}}
.pc{flex:1;min-width:0;font:700 15px/1 ${SANS};letter-spacing:.05em;text-transform:uppercase;white-space:nowrap;text-box:trim-both cap alphabetic}
.lead .pc{font-size:16px}
.leads{top:${LEAD_Y}px;height:${LEAD_H}px;display:grid;grid-template-columns:repeat(4,1fr);column-gap:${COL_GAP}px}
.lead,.card{display:flex;flex-direction:column;overflow:hidden;min-width:0}
.lead>svg{display:block;width:100%;height:108px;flex:none;margin-top:6px}
.fig{font:800 34px/38px ${COND};color:${ACC};margin-top:3px;white-space:nowrap;letter-spacing:-.005em}
.hd{font:700 21px/24px ${SANS};letter-spacing:-.012em}
.secs{top:${SEC_Y}px;height:${SEC_H}px;display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(2,${SEC_ROW}px);gap:${SEC_GAP}px ${COL_GAP}px}
.cb{display:flex;gap:8px;margin-top:5px;flex:1;min-height:0}
.cb>svg{display:block;width:78px;height:78px;flex:none}
.tx{flex:1;min-width:0;display:flex;flex-direction:column;overflow:hidden}
.fig2{font:800 25px/26px ${COND};color:${ACC};white-space:nowrap;margin-top:-3px}
.h3{font:600 16px/18px ${COND};margin-top:1px}
.low{top:${LOW_Y}px;height:${LOW_H}px;display:grid;grid-template-columns:${MAP_W}px 1fr;column-gap:20px}
.sec{display:flex;align-items:center;height:28px;background:${INK};color:${PAPER};padding:0 9px;font:800 16px/1 ${SANS};letter-spacing:.07em;text-transform:uppercase;white-space:nowrap}
.sec span{text-box:trim-both cap alphabetic}
.map,.also{display:flex;flex-direction:column;min-width:0}
.map svg{display:block;margin-top:6px;flex:none}
.pn{font:800 15px ${SANS};fill:#fff;text-anchor:middle}
.legend{display:grid;grid-template-columns:repeat(2,1fr);row-gap:5px;margin-top:5px;font:700 16px/1 ${SANS}}
.lg{display:flex;align-items:center;gap:6px;white-space:nowrap;text-box:trim-both cap alphabetic}
.lg b{width:14px;height:14px;flex:none;border-radius:3px}
.mnote{font:500 15px/18px ${SANS};color:${MUTE};margin-top:auto}
.digest{list-style:none;display:grid;grid-template-columns:1fr 1fr;grid-auto-flow:column;grid-template-rows:repeat(12,1fr);column-gap:16px;margin-top:4px;flex:1}
.digest li{display:flex;align-items:center;gap:8px;min-width:0}
.digest .nb{min-width:28px;height:20px;font-size:15px}
.di{font:500 16px/19px ${SANS};white-space:nowrap;overflow:hidden;min-width:0}
.foot{left:0;top:${FOOT_Y}px;width:${W}px;height:${FOOT_H}px;background:${INK};color:#E9E3D6;padding:7px ${M}px 0;display:flex;flex-direction:column;gap:4px}
.foot div{white-space:nowrap;overflow:hidden}
.foot .c1{font:600 17px/20px ${SANS};color:#fff}
.foot .c1 b{color:#F2A58F;font-weight:800}
.foot .c2{font:500 15px/18px ${SANS};flex:1}
</style></head><body>
<header class="head" data-b="head"><div class="strap"><span><b>What happened in the world on Wednesday</b></span><span>${ALL.length} stories · five continents</span></div>
<h1>WEDNESDAY 25 NOVEMBER 2026</h1></header>
<div class="deck" data-b="deck">${teaser(3, 'Trump to raise tariffs on 16 economies')}${teaser(2, 'Chip stocks slide: Kospi −6.2%')}${teaser(1, 'First Pakistani in orbit')}</div>
<div class="rule"></div>
<section class="leads" data-b="leads">${leads}</section>
<section class="secs" data-b="seconds">${cards}</section>
<section class="low" data-b="low">
<div class="map"><div class="sec"><span>Where it happened</span></div>
<svg width="${MAP_W}" height="${MAP_H}" viewBox="0 0 ${MAP_W} ${MAP_H}">
<rect width="${MAP_W}" height="${MAP_H}" fill="#CFDCDF"/><path d="${land}" fill="#E3DBC8" stroke="#FBF8F1" stroke-width=".6"/>
${dots}${ticks}${pins}</svg>
<div class="legend">${legend}</div>
<div class="mnote">Squares ${LEAD[0].n}–${FEATURED}, dots ${FEATURED + 1}–${ALL.length}; ${ALL.filter((s) => !s.loc).map((s) => s.n).join(', ')} is worldwide</div></div>
<div class="also"><div class="sec"><span>Also on Wednesday 25 November 2026</span></div><ol class="digest">${digest}</ol></div>
</section>
<footer class="foot" data-b="foot">
<div class="c1"><b>Wednesday 25 November 2026.</b> Every story on this page happened, or was first reported, on 25 November 2026.</div>
<div class="c2">Sources: Reuters, AP, The Guardian, WSJ, Bloomberg, FT, UN News, RNZ, AFP · Map: Natural Earth · Scenes drawn for this page</div>
</footer>
${checker}
</body></html>`;

writeFileSync(new URL('atlas.html', here), html);
console.log('map', MAP_W + 'x' + MAP_H, 'stories', ALL.length, 'featured', FEATURED, 'pins', geo.pins.length,
  'regions', tally.map(([r, c]) => r + ' ' + c).join(', ') + ', World ' + ALL.filter((s) => s.region === 'World').length);
