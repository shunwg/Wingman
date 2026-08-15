/* ============================================================
   WINGMAN — seeded fixtures
   (maps to src/data/ in the eventual TanStack Start build)
   Oslo / OSL Gardermoen · evening arrival bank, tonight
   ============================================================ */

const AIRPORT = { code: 'OSL', name: 'Gardermoen' };

const FARES = { cabSolo: 749, flytoget: 240, vy: 124 }; // NOK, seeded estimates

/* Neighbourhood anchor points — real Oslo coordinates, each with a
   PUBLIC meeting point (addresses are never used anywhere in the app). */
const AREAS = [
  { id: 'grunerlokka',  label: 'Grünerløkka',    lat: 59.9227, lon: 10.7597, meet: 'Olaf Ryes plass tram stop' },
  { id: 'sofienberg',   label: 'Sofienberg',     lat: 59.9204, lon: 10.7699, meet: 'Sofienbergparken south gate' },
  { id: 'toyen',        label: 'Tøyen',          lat: 59.9139, lon: 10.7743, meet: 'Tøyen torg' },
  { id: 'gronland',     label: 'Grønland',       lat: 59.9110, lon: 10.7623, meet: 'Grønland torg' },
  { id: 'sentrum',      label: 'Sentrum',        lat: 59.9127, lon: 10.7461, meet: 'Oslo S main entrance' },
  { id: 'bislett',      label: 'Bislett',        lat: 59.9250, lon: 10.7343, meet: 'Bislett stadion corner' },
  { id: 'sthanshaugen', label: 'St. Hanshaugen', lat: 59.9280, lon: 10.7389, meet: 'St. Hanshaugen park gate' },
  { id: 'majorstuen',   label: 'Majorstuen',     lat: 59.9294, lon: 10.7161, meet: 'Majorstuen station' },
  { id: 'frogner',      label: 'Frogner',        lat: 59.9223, lon: 10.7047, meet: 'Frogner plass' },
  { id: 'sagene',       label: 'Sagene',         lat: 59.9377, lon: 10.7565, meet: 'Sagene kirke stop' },
  { id: 'nydalen',      label: 'Nydalen',        lat: 59.9494, lon: 10.7645, meet: 'Nydalen T-bane' },
  { id: 'akerbrygge',   label: 'Aker Brygge',    lat: 59.9106, lon: 10.7300, meet: 'Aker Brygge pier clock' },
];

/* Tonight's flights. Times are local. */
const FLIGHTS = [
  // arrivals
  { no: 'DY631',  city: 'Tromsø',     iata: 'TOS', time: '21:35', dir: 'arriving' },
  { no: 'SK4489', city: 'Trondheim',  iata: 'TRD', time: '21:45', dir: 'arriving' },
  { no: 'SK272',  city: 'London',     iata: 'LHR', time: '21:55', dir: 'arriving' },
  { no: 'WF569',  city: 'Bergen',     iata: 'BGO', time: '22:05', dir: 'arriving' },
  { no: 'DY1305', city: 'Copenhagen', iata: 'CPH', time: '22:10', dir: 'arriving' },
  { no: 'AY917',  city: 'Helsinki',   iata: 'HEL', time: '22:20', dir: 'arriving' },
  { no: 'BA766',  city: 'London',     iata: 'LHR', time: '22:25', dir: 'arriving' },
  { no: 'KL1147', city: 'Amsterdam',  iata: 'AMS', time: '22:35', dir: 'arriving' },
  // departures
  { no: 'SK273',  city: 'London',     iata: 'LHR', time: '22:45', dir: 'departing' },
  { no: 'DY1309', city: 'Copenhagen', iata: 'CPH', time: '23:05', dir: 'departing' },
  { no: 'WF624',  city: 'Bergen',     iata: 'BGO', time: '23:20', dir: 'departing' },
];

/* 30 fictional travellers.
   mode: 'cab' | 'train' | 'either'
   vibes: subset of ['quiet','chatty','music','business']
   recip: seconds until they "join your route back" after you join theirs
          (null = they never do — the join simply expires at wheels-down)
   spot: their drop-off (arriving) or pick-up (departing) point */
const TRAVELLERS = [
  // ---- arriving ----
  { id: 'jonas',  name: 'Jonas',  gender: 'M', flight: 'DY1305', dir: 'arriving', flex: 45, mode: 'either', vibes: ['chatty', 'music'],   area: 'grunerlokka',  spot: { lat: 59.9241, lon: 10.7621 }, recip: 14,  hue: 28, verify: 'bankid', visibleTo: 'everyone',
    line: 'Same flight as you, apparently. I’ll be the one with the cello case.' },
  { id: 'maya',   name: 'Maya',   gender: 'F', flight: 'SK272',  dir: 'arriving', flex: 60, mode: 'cab',    vibes: ['quiet', 'music'],    area: 'sofienberg',   spot: { lat: 59.9209, lon: 10.7674 }, recip: 7,   hue: 340, verify: 'linkedin', visibleTo: 'everyone',
    line: 'Back from a London design sprint. Quiet cab, good playlist.' },
  { id: 'amina',  name: 'Amina',  gender: 'F', flight: 'BA766',  dir: 'arriving', flex: 30, mode: 'either', vibes: ['quiet', 'chatty'],   area: 'grunerlokka',  spot: { lat: 59.9214, lon: 10.7591 }, recip: 26,  hue: 200, verify: 'instagram', visibleTo: 'women',
    line: 'Long week in London. Happy to split and be human about it.' },
  { id: 'ingrid', name: 'Ingrid', gender: 'F', flight: 'AY917',  dir: 'arriving', flex: 60, mode: 'train',  vibes: ['quiet'],             area: 'grunerlokka',  spot: { lat: 59.9268, lon: 10.7580 }, recip: null, hue: 160, verify: 'bankid', visibleTo: 'verified',
    line: 'Flytoget person. Will absolutely share the walk from Oslo S.' },
  { id: 'henrik', name: 'Henrik', gender: 'M', flight: 'SK4489', dir: 'arriving', flex: 75, mode: 'cab',    vibes: ['business'],          area: 'sofienberg',   spot: { lat: 59.9195, lon: 10.7712 }, recip: null, hue: 215, verify: 'linkedin', visibleTo: 'everyone',
    line: 'Trondheim day trip. Suit, laptop, no small talk needed.' },
  { id: 'nora',   name: 'Nora',   gender: 'F', flight: 'KL1147', dir: 'arriving', flex: 15, mode: 'cab',    vibes: ['quiet', 'music'],    area: 'grunerlokka',  spot: { lat: 59.9233, lon: 10.7570 }, recip: null, hue: 300, verify: 'bankid', visibleTo: 'women',
    line: 'Tight schedule, tight window. If it fits, it fits.' },
  { id: 'hanna',  name: 'Hanna',  gender: 'F', flight: 'DY631',  dir: 'arriving', flex: 30, mode: 'either', vibes: ['quiet', 'chatty'],   area: 'sofienberg',   spot: { lat: 59.9199, lon: 10.7688 }, recip: null, hue: 45, verify: 'bankid', visibleTo: 'verified',
    line: 'Tromsø fieldwork done. Craving city lights and a shared fare.' },
  { id: 'elias',  name: 'Elias',  gender: 'M', flight: 'DY631',  dir: 'arriving', flex: 60, mode: 'either', vibes: ['chatty'],            area: 'toyen',        spot: { lat: 59.9139, lon: 10.7743 }, recip: 18,  hue: 10, verify: 'facebook', visibleTo: 'everyone',
    line: 'Northern lights photographer, southbound. Ask me anything.' },
  { id: 'sofie',  name: 'Sofie',  gender: 'F', flight: 'SK272',  dir: 'arriving', flex: 45, mode: 'either', vibes: ['music', 'chatty'],   area: 'majorstuen',   spot: { lat: 59.9294, lon: 10.7161 }, recip: 20,  hue: 275, verify: 'instagram', visibleTo: 'verified',
    line: 'West-side girl. Will trade playlist control for good stories.' },
  { id: 'aksel',  name: 'Aksel',  gender: 'M', flight: 'DY1305', dir: 'arriving', flex: 30, mode: 'cab',    vibes: ['business'],          area: 'sentrum',      spot: { lat: 59.9127, lon: 10.7461 }, recip: null, hue: 190, verify: 'linkedin', visibleTo: 'everyone',
    line: 'Hotel by Oslo S. Efficient exits appreciated.' },
  { id: 'thea',   name: 'Thea',   gender: 'F', flight: 'WF569',  dir: 'arriving', flex: 45, mode: 'cab',    vibes: ['quiet'],             area: 'bislett',      spot: { lat: 59.9250, lon: 10.7343 }, recip: 22,  hue: 130, verify: 'bankid', visibleTo: 'verified',
    line: 'Bergen rain to Oslo night. Quiet ride, please.' },
  { id: 'viktor', name: 'Viktor', gender: 'M', flight: 'SK4489', dir: 'arriving', flex: 60, mode: 'either', vibes: ['music'],             area: 'gronland',     spot: { lat: 59.9110, lon: 10.7623 }, recip: null, hue: 355, verify: 'facebook', visibleTo: 'everyone',
    line: 'Vinyl in my carry-on. Handle with care.' },
  { id: 'lea',    name: 'Lea',    gender: 'F', flight: 'AY917',  dir: 'arriving', flex: 90, mode: 'train',  vibes: ['quiet', 'business'], area: 'sthanshaugen', spot: { lat: 59.9280, lon: 10.7389 }, recip: null, hue: 240, verify: 'bankid', visibleTo: 'women',
    line: 'Helsinki conference survivor. Train, tea, silence.' },
  { id: 'oskar',  name: 'Oskar',  gender: 'M', flight: 'BA766',  dir: 'arriving', flex: 45, mode: 'cab',    vibes: ['chatty', 'music'],   area: 'frogner',      spot: { lat: 59.9223, lon: 10.7047 }, recip: null, hue: 60, verify: 'instagram', visibleTo: 'everyone',
    line: 'Two gigs in London, zero sleep. Still chatty though.' },
  { id: 'selma',  name: 'Selma',  gender: 'F', flight: 'KL1147', dir: 'arriving', flex: 60, mode: 'either', vibes: ['quiet'],             area: 'sagene',       spot: { lat: 59.9377, lon: 10.7565 }, recip: null, hue: 95, verify: 'bankid', visibleTo: 'verified',
    line: 'Amsterdam to Sagene. Bicycle withdrawal already.' },
  { id: 'kasper', name: 'Kasper', gender: 'M', flight: 'DY631',  dir: 'arriving', flex: 30, mode: 'train',  vibes: ['business'],          area: 'nydalen',      spot: { lat: 59.9494, lon: 10.7645 }, recip: null, hue: 205, verify: 'linkedin', visibleTo: 'everyone',
    line: 'Nydalen office at 08:00. The train is non-negotiable.' },
  { id: 'anna',   name: 'Anna',   gender: 'F', flight: 'WF569',  dir: 'arriving', flex: 60, mode: 'cab',    vibes: ['chatty'],            area: 'toyen',        spot: { lat: 59.9146, lon: 10.7729 }, recip: 16,  hue: 320, verify: 'bankid', visibleTo: 'everyone',
    line: 'Tøyen-bound with a suitcase full of brunost. Long story.' },
  { id: 'mats',   name: 'Mats',   gender: 'M', flight: 'SK272',  dir: 'arriving', flex: 90, mode: 'either', vibes: ['music', 'chatty'],   area: 'gronland',     spot: { lat: 59.9118, lon: 10.7605 }, recip: null, hue: 20, verify: 'facebook', visibleTo: 'everyone',
    line: 'Flexible on everything except the aux cord.' },
  { id: 'frida',  name: 'Frida',  gender: 'F', flight: 'DY1305', dir: 'arriving', flex: 60, mode: 'cab',    vibes: ['quiet', 'music'],    area: 'akerbrygge',   spot: { lat: 59.9106, lon: 10.7300 }, recip: null, hue: 180, verify: 'linkedin', visibleTo: 'women',
    line: 'Harbour views over small talk. But I share fares fairly.' },
  { id: 'tobias', name: 'Tobias', gender: 'M', flight: 'AY917',  dir: 'arriving', flex: 45, mode: 'either', vibes: ['chatty'],            area: 'sentrum',      spot: { lat: 59.9135, lon: 10.7480 }, recip: null, hue: 145, verify: 'instagram', visibleTo: 'everyone',
    line: 'Will point out every building we pass. Consider it a tour.' },
  { id: 'julie',  name: 'Julie',  gender: 'F', flight: 'SK4489', dir: 'arriving', flex: 30, mode: 'cab',    vibes: ['music'],             area: 'bislett',      spot: { lat: 59.9243, lon: 10.7351 }, recip: null, hue: 265, verify: 'bankid', visibleTo: 'verified',
    line: 'Straight to Bislett, volume at a polite seven.' },
  { id: 'sander', name: 'Sander', gender: 'M', flight: 'KL1147', dir: 'arriving', flex: 75, mode: 'train',  vibes: ['quiet', 'business'], area: 'majorstuen',   spot: { lat: 59.9301, lon: 10.7149 }, recip: null, hue: 230, verify: 'linkedin', visibleTo: 'everyone',
    line: 'Schiphol delay veteran. Nothing fazes me anymore.' },
  { id: 'erik',   name: 'Erik',   gender: 'M', flight: 'WF569',  dir: 'arriving', flex: 45, mode: 'cab',    vibes: ['business', 'chatty'], area: 'frogner',     spot: { lat: 59.9230, lon: 10.7060 }, recip: null, hue: 40, verify: 'linkedin', visibleTo: 'everyone',
    line: 'Consulting gig in Bergen. I expense, you save. Everyone wins.' },
  { id: 'livee',  name: 'Live',   gender: 'F', flight: 'BA766',  dir: 'arriving', flex: 60, mode: 'train',  vibes: ['music'],             area: 'toyen',        spot: { lat: 59.9150, lon: 10.7760 }, recip: null, hue: 310, verify: 'instagram', visibleTo: 'women',
    line: 'Concert in London, ears still ringing. Train hum is fine.' },
  // ---- departing ----
  { id: 'noa',    name: 'Noa',    gender: 'M', flight: 'DY1309', dir: 'departing', flex: 45, mode: 'cab',    vibes: ['quiet'],            area: 'grunerlokka',  spot: { lat: 59.9236, lon: 10.7610 }, recip: 11,  hue: 110, verify: 'bankid', visibleTo: 'everyone',
    line: 'Red-eye to Copenhagen. Splitting a cab softens the blow.' },
  { id: 'maren',  name: 'Maren',  gender: 'F', flight: 'SK273',  dir: 'departing', flex: 60, mode: 'either', vibes: ['chatty', 'music'],  area: 'sofienberg',   spot: { lat: 59.9207, lon: 10.7680 }, recip: 19,  hue: 5, verify: 'instagram', visibleTo: 'everyone',
    line: 'London for the weekend. Pre-flight playlist curated.' },
  { id: 'leon',   name: 'Leon',   gender: 'M', flight: 'WF624',  dir: 'departing', flex: 30, mode: 'train',  vibes: ['business'],         area: 'sentrum',      spot: { lat: 59.9130, lon: 10.7470 }, recip: null, hue: 250, verify: 'linkedin', visibleTo: 'verified',
    line: 'Bergen meeting at dawn. Flytoget, obviously.' },
  { id: 'ida',    name: 'Ida',    gender: 'F', flight: 'DY1309', dir: 'departing', flex: 60, mode: 'either', vibes: ['quiet', 'music'],   area: 'grunerlokka',  spot: { lat: 59.9219, lon: 10.7565 }, recip: 24,  hue: 290, verify: 'bankid', visibleTo: 'verified',
    line: 'CPH wedding tomorrow. Calm ride out, please.' },
  { id: 'milan',  name: 'Milan',  gender: 'M', flight: 'SK273',  dir: 'departing', flex: 45, mode: 'cab',    vibes: ['chatty'],           area: 'toyen',        spot: { lat: 59.9142, lon: 10.7735 }, recip: null, hue: 170, verify: 'facebook', visibleTo: 'everyone',
    line: 'Tøyen to Heathrow via good conversation.' },
  { id: 'sara',   name: 'Sara',   gender: 'F', flight: 'WF624',  dir: 'departing', flex: 60, mode: 'train',  vibes: ['quiet'],            area: 'sthanshaugen', spot: { lat: 59.9275, lon: 10.7395 }, recip: null, hue: 80, verify: 'bankid', visibleTo: 'women',
    line: 'Last flight west tonight. Quiet company welcome.' },
];

/* Landing-page feed of recent (fictional) matches */
const RECENT_MATCHES = [
  { pair: 'Jonas + Emilie', route: 'OSL → Bislett',      saved: '372 kr', when: '21:12' },
  { pair: 'Sara + Mikkel',  route: 'Sagene → OSL',       saved: '374 kr', when: '20:48' },
  { pair: 'Aisha + Tuva',   route: 'OSL → Majorstuen',   saved: '369 kr', when: '20:31' },
  { pair: 'Olav + Petra',   route: 'OSL → Grünerløkka',  saved: '374 kr', when: '19:57' },
];

/* Scripted Signals replies, cycled per match */
const SIGNAL_REPLIES = [
  'Perfect — I’ll be at arrivals around then.',
  'Works for me. I have one checked bag, might be 5 min behind you.',
  'Great. I’m in seat 14C, will walk fast.',
  'Train works for me too if the taxi queue is hopeless.',
  'See you there. I’ll have a very obvious yellow suitcase.',
];

if (typeof module !== 'undefined') {
  module.exports = { AIRPORT, FARES, AREAS, FLIGHTS, TRAVELLERS, RECENT_MATCHES, SIGNAL_REPLIES };
}
