import { asTagId, type TagId } from './ids';

/**
 * The interest vocabulary.
 *
 * Free text matches by string equality, which means two people who care about
 * the same thing routinely miss each other because one typed "energy trading"
 * and the other "power markets". A vocabulary fixes that at the cost of a list
 * to maintain; the list is kept small enough to scan on a phone, and free text
 * survives beside it (`IntentProfile.topics`) for anything it does not cover.
 *
 * Near-duplicates are joined by hand with `near`, not by embeddings: the
 * cluster the seed data actually contains — energy, energy markets, energy
 * finance, infrastructure finance — stays four distinct ids that score close.
 */
export type TagGroup = 'industry' | 'craft' | 'topic' | 'activity' | 'culture' | 'life';

export interface Tag {
  id: TagId;
  label: string;
  group: TagGroup;
  /** Adjacent ids. Declared once; adjacency is read in both directions. */
  near?: TagId[];
  /** Free-text spellings that resolve here. Matched after id and label. */
  aliases?: string[];
}

const t = asTagId;

const def = (
  id: string,
  label: string,
  group: TagGroup,
  extra: { near?: string[]; aliases?: string[] } = {},
): Tag => ({
  id: t(id),
  label,
  group,
  ...(extra.near ? { near: extra.near.map(t) } : {}),
  ...(extra.aliases ? { aliases: extra.aliases } : {}),
});

export const TAGS: readonly Tag[] = [
  // ── Industry ────────────────────────────────────────────────────────────
  def('energy', 'Energy', 'industry', { near: ['energy-markets', 'energy-finance', 'climate-tech', 'infrastructure'] }),
  def('energy-markets', 'Energy markets', 'industry', { near: ['energy', 'energy-finance', 'markets'], aliases: ['energy trading', 'power markets', 'power trading'] }),
  def('energy-finance', 'Energy finance', 'industry', { near: ['energy', 'energy-markets', 'infrastructure-finance', 'finance'] }),
  def('infrastructure-finance', 'Infrastructure finance', 'industry', { near: ['energy-finance', 'infrastructure', 'finance', 'real-estate'] }),
  def('finance', 'Finance', 'industry', { near: ['energy-finance', 'infrastructure-finance', 'fintech', 'markets', 'venture'] }),
  def('fintech', 'Fintech', 'industry', { near: ['finance', 'payments', 'software'] }),
  def('payments', 'Payments', 'industry', { near: ['fintech', 'software'] }),
  def('climate-tech', 'Climate tech', 'industry', { near: ['energy', 'climate', 'startups'] }),
  def('software', 'Software', 'industry', { near: ['ai', 'startups', 'fintech', 'engineering'] }),
  def('ai', 'AI', 'industry', { near: ['software', 'data', 'research'], aliases: ['machine learning', 'ml'] }),
  def('product-design', 'Product design', 'industry', { near: ['design-craft', 'software', 'typography'], aliases: ['design', 'ux', 'ui'] }),
  def('architecture', 'Architecture', 'industry', { near: ['construction', 'cities', 'real-estate', 'design-craft'] }),
  def('construction', 'Construction', 'industry', { near: ['architecture', 'infrastructure', 'real-estate'] }),
  def('real-estate', 'Real estate', 'industry', { near: ['construction', 'architecture', 'infrastructure-finance'], aliases: ['property'] }),
  def('public-health', 'Public health', 'industry', { near: ['medicine', 'biotech', 'science'] }),
  def('medicine', 'Medicine', 'industry', { near: ['public-health', 'biotech'], aliases: ['healthcare', 'health'] }),
  def('biotech', 'Biotech', 'industry', { near: ['medicine', 'public-health', 'science'] }),
  def('law', 'Law', 'industry', { near: ['regulation'], aliases: ['legal'] }),
  def('logistics', 'Logistics', 'industry', { near: ['shipping', 'supply-chains', 'operations'] }),
  def('shipping', 'Shipping', 'industry', { near: ['logistics', 'supply-chains', 'marine-science', 'sailing'], aliases: ['maritime'] }),
  def('journalism', 'Journalism', 'industry', { near: ['media', 'writing', 'editing'] }),
  def('media', 'Media', 'industry', { near: ['journalism', 'film', 'writing'] }),
  def('education', 'Education', 'industry', { near: ['teaching', 'research'] }),
  def('marine-science', 'Marine science', 'industry', { near: ['science', 'shipping', 'climate', 'diving'], aliases: ['oceans', 'ocean', 'oceanography'] }),
  def('consulting', 'Consulting', 'industry', { near: ['markets', 'economics', 'operations'], aliases: ['strategy', 'strategy consulting', 'management consulting'] }),
  def('manufacturing', 'Manufacturing', 'industry', { near: ['operations', 'engineering', 'supply-chains'] }),
  def('venture', 'Venture', 'industry', { near: ['startups', 'finance'], aliases: ['vc', 'venture capital', 'investing'] }),
  def('startups', 'Startups', 'industry', { near: ['venture', 'software', 'climate-tech', 'product-management'] }),

  // ── Craft ───────────────────────────────────────────────────────────────
  def('engineering', 'Engineering', 'craft', { near: ['software', 'reliability', 'manufacturing'] }),
  def('data', 'Data', 'craft', { near: ['ai', 'research', 'markets'], aliases: ['analytics', 'data science'] }),
  def('research', 'Research', 'craft', { near: ['science', 'data', 'education'] }),
  def('writing', 'Writing', 'craft', { near: ['journalism', 'editing', 'books', 'poetry'] }),
  def('editing', 'Editing', 'craft', { near: ['writing', 'journalism', 'film'] }),
  def('design-craft', 'Design', 'craft', { near: ['product-design', 'typography', 'illustration', 'architecture'] }),
  def('typography', 'Typography', 'craft', { near: ['design-craft', 'product-design', 'books'] }),
  def('illustration', 'Illustration', 'craft', { near: ['design-craft', 'art'] }),
  def('photography', 'Photography', 'craft', { near: ['film', 'art', 'travel'] }),
  def('film', 'Film', 'craft', { near: ['photography', 'media', 'film-culture'], aliases: ['video'] }),
  def('sound-engineering', 'Sound', 'craft', { near: ['music', 'live-music', 'engineering'], aliases: ['audio', 'audio engineering'] }),
  def('teaching', 'Teaching', 'craft', { near: ['education', 'research'] }),
  def('sales', 'Sales', 'craft', { near: ['operations', 'startups'] }),
  def('operations', 'Operations', 'craft', { near: ['logistics', 'supply-chains', 'manufacturing', 'sales'] }),
  def('recruiting', 'Recruiting', 'craft', { near: ['operations', 'startups'], aliases: ['hiring'] }),
  def('product-management', 'Product', 'craft', { near: ['product-design', 'software', 'startups'], aliases: ['product management', 'pm'] }),

  // ── Topics ──────────────────────────────────────────────────────────────
  def('cities', 'Cities', 'topic', { near: ['architecture', 'infrastructure', 'maps', 'transport'], aliases: ['urbanism', 'urban'] }),
  def('infrastructure', 'Infrastructure', 'topic', { near: ['infrastructure-finance', 'construction', 'cities', 'energy', 'transport'] }),
  def('transport', 'Transport', 'topic', { near: ['cities', 'infrastructure', 'logistics'], aliases: ['transit', 'mobility', 'rail'] }),
  def('climate', 'Climate', 'topic', { near: ['climate-tech', 'energy', 'marine-science', 'science'] }),
  def('markets', 'Markets', 'topic', { near: ['energy-markets', 'finance', 'economics', 'consulting'] }),
  def('economics', 'Economics', 'topic', { near: ['markets', 'finance', 'geopolitics'] }),
  def('geopolitics', 'Geopolitics', 'topic', { near: ['economics', 'history', 'maps'], aliases: ['politics'] }),
  def('history', 'History', 'topic', { near: ['geopolitics', 'books', 'museums'] }),
  def('philosophy', 'Philosophy', 'topic', { near: ['books', 'history', 'science'] }),
  def('science', 'Science', 'topic', { near: ['research', 'biotech', 'marine-science', 'climate'] }),
  def('regulation', 'Regulation', 'topic', { near: ['law', 'energy-markets', 'geopolitics'], aliases: ['policy', 'permitting'] }),
  def('supply-chains', 'Supply chains', 'topic', { near: ['logistics', 'shipping', 'operations', 'manufacturing'] }),
  def('reliability', 'Reliability', 'topic', { near: ['engineering', 'software', 'infrastructure'], aliases: ['resilience', 'uptime'] }),
  def('maps', 'Maps', 'topic', { near: ['cities', 'geopolitics', 'travel'], aliases: ['cartography', 'gis'] }),
  def('languages', 'Languages', 'topic', { near: ['travel', 'books', 'teaching'] }),

  // ── Activities ──────────────────────────────────────────────────────────
  def('running', 'Running', 'activity', { near: ['cycling', 'gym', 'fitness'] }),
  def('cycling', 'Cycling', 'activity', { near: ['running', 'fitness', 'hiking'] }),
  def('climbing', 'Climbing', 'activity', { near: ['hiking', 'skiing', 'fitness'], aliases: ['bouldering'] }),
  def('hiking', 'Hiking', 'activity', { near: ['climbing', 'cycling', 'skiing', 'travel'], aliases: ['walking', 'trekking'] }),
  def('swimming', 'Swimming', 'activity', { near: ['diving', 'fitness', 'sailing'] }),
  def('football', 'Football', 'activity', { near: ['tennis', 'fitness'], aliases: ['soccer'] }),
  def('tennis', 'Tennis', 'activity', { near: ['football', 'golf', 'fitness'], aliases: ['padel'] }),
  def('yoga', 'Yoga', 'activity', { near: ['fitness', 'swimming'], aliases: ['pilates'] }),
  def('sailing', 'Sailing', 'activity', { near: ['swimming', 'diving', 'shipping'] }),
  def('skiing', 'Skiing', 'activity', { near: ['climbing', 'hiking'], aliases: ['snowboarding', 'ski'] }),
  def('diving', 'Diving', 'activity', { near: ['swimming', 'sailing', 'marine-science'], aliases: ['scuba', 'freediving'] }),
  def('golf', 'Golf', 'activity', { near: ['tennis'] }),
  def('gym', 'Gym', 'activity', { near: ['running', 'fitness'], aliases: ['weights', 'lifting'] }),
  def('motorsport', 'Motorsport', 'activity', { near: ['engineering'], aliases: ['f1', 'formula 1', 'racing'] }),

  // ── Culture ─────────────────────────────────────────────────────────────
  def('music', 'Music', 'culture', { near: ['live-music', 'jazz', 'classical', 'opera', 'sound-engineering'] }),
  def('opera', 'Opera', 'culture', { near: ['classical', 'music', 'theatre'] }),
  def('jazz', 'Jazz', 'culture', { near: ['music', 'live-music'] }),
  def('classical', 'Classical music', 'culture', { near: ['opera', 'music'] }),
  def('live-music', 'Live music', 'culture', { near: ['music', 'jazz'], aliases: ['gigs', 'concerts'] }),
  def('books', 'Books', 'culture', { near: ['writing', 'poetry', 'history', 'philosophy'], aliases: ['reading', 'novels', 'literature'] }),
  def('poetry', 'Poetry', 'culture', { near: ['books', 'writing'] }),
  def('theatre', 'Theatre', 'culture', { near: ['opera', 'film-culture'], aliases: ['theater'] }),
  def('film-culture', 'Cinema', 'culture', { near: ['film', 'theatre'], aliases: ['films', 'movies'] }),
  def('art', 'Art', 'culture', { near: ['museums', 'illustration', 'photography'] }),
  def('museums', 'Museums', 'culture', { near: ['art', 'history'] }),
  def('food', 'Food', 'culture', { near: ['cooking', 'wine', 'coffee'], aliases: ['restaurants', 'eating', 'hawker'] }),
  def('cooking', 'Cooking', 'culture', { near: ['food', 'wine'], aliases: ['baking'] }),
  def('coffee', 'Coffee', 'culture', { near: ['food', 'tea'] }),
  def('tea', 'Tea', 'culture', { near: ['coffee'] }),
  def('wine', 'Wine', 'culture', { near: ['food', 'cooking', 'whisky'] }),
  def('whisky', 'Whisky', 'culture', { near: ['wine', 'beer'], aliases: ['whiskey', 'spirits'] }),
  def('beer', 'Beer', 'culture', { near: ['whisky', 'food'], aliases: ['craft beer'] }),

  // ── Life ────────────────────────────────────────────────────────────────
  def('travel', 'Travel', 'life', { near: ['hiking', 'photography', 'maps', 'languages'] }),
  def('parenting', 'Parenting', 'life', { aliases: ['kids', 'children', 'family'] }),
  def('volunteering', 'Volunteering', 'life', { near: ['education'] }),
  def('fitness', 'Fitness', 'life', { near: ['running', 'cycling', 'gym', 'yoga'] }),
  def('gaming', 'Gaming', 'life', { near: ['software'], aliases: ['games', 'video games', 'chess', 'board games'] }),
  def('pets', 'Pets', 'life', { aliases: ['dogs', 'cats'] }),
  def('faith', 'Faith', 'life', { near: ['philosophy'], aliases: ['religion'] }),
];

export const TAG_BY_ID: ReadonlyMap<string, Tag> = new Map(TAGS.map((x) => [x.id, x]));

const key = (s: string) => s.trim().toLowerCase().replace(/[\s_]+/g, '-');

const LOOKUP: ReadonlyMap<string, TagId> = (() => {
  const m = new Map<string, TagId>();
  // Ids and labels first, aliases second, so an alias can never shadow a label.
  for (const tag of TAGS) {
    m.set(key(tag.id), tag.id);
    m.set(key(tag.label), tag.id);
  }
  for (const tag of TAGS) for (const a of tag.aliases ?? []) if (!m.has(key(a))) m.set(key(a), tag.id);
  return m;
})();

/** Free text → a tag, when one fits. Case-, space- and alias-insensitive. */
export function normaliseTag(free: string): TagId | undefined {
  return LOOKUP.get(key(free));
}

const EXACT = 1;
const NEAR = 0.5;
const SAME_GROUP = 0.15;

function pairScore(a: TagId, b: TagId): number {
  if (a === b) return EXACT;
  const ta = TAG_BY_ID.get(a);
  const tb = TAG_BY_ID.get(b);
  if (!ta || !tb) return 0;
  if (ta.near?.includes(b) || tb.near?.includes(a)) return NEAR;
  return ta.group === tb.group ? SAME_GROUP : 0;
}

/** Mean, over one list, of the best match found in the other. */
function oneWay(from: readonly TagId[], into: readonly TagId[]): number {
  let sum = 0;
  for (const x of from) {
    let best = 0;
    for (const y of into) {
      const s = pairScore(x, y);
      if (s > best) best = s;
      if (best === EXACT) break;
    }
    sum += best;
  }
  return sum / from.length;
}

/**
 * Weighted affinity between two tag lists, 0–1.
 *
 * Symmetric by construction — the mean of both one-way scores — because the
 * matching engine scores every pair twice with the roles swapped, and an
 * asymmetric affinity would make "how well do we fit" depend on who is
 * looking. It is also diluted by unrelated tags on either side, unlike a
 * containment ratio, so a long list of everything does not out-score a short
 * list of the right things.
 */
export function tagAffinity(a: readonly TagId[], b: readonly TagId[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const v = (oneWay(a, b) + oneWay(b, a)) / 2;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
