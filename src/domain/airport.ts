import type { CityKey, IataCode } from './ids';
import type { IanaZone } from './time';

/**
 * A worldwide airport, from the OurAirports public-domain dataset.
 *
 * `zone` is not in the source data — it is derived from coordinates at build
 * time and the build fails without it, because every layover and same-night
 * computation depends on it.
 */
export interface Airport {
  iata: IataCode;
  name: string;
  city: string;
  cityKey: CityKey;
  country: string;
  /** ISO-3166-1 alpha-2, e.g. `NO`. */
  countryCode: string;
  lat: number;
  lon: number;
  zone: IanaZone;
  size: 'large' | 'medium';
}

/** A city that may span several airports — London is one city, five airports. */
export interface City {
  key: CityKey;
  name: string;
  country: string;
  countryCode: string;
  airports: IataCode[];
  zone: IanaZone;
  lat: number;
  lon: number;
}

/**
 * The lookup surface the matching engine is given.
 *
 * Deliberately an interface rather than a concrete import: the engine takes it
 * as a parameter, so a unit test can pass a six-airport stub instead of loading
 * three thousand records to check one layover rule.
 */
export interface AirportIndex {
  get(iata: IataCode): Airport | undefined;
  city(iata: IataCode): City | undefined;
  zone(iata: IataCode): IanaZone | undefined;
  /** Prefix/fuzzy search for the trip form's combobox. */
  search(query: string, limit?: number): Airport[];
  nearest(lat: number, lon: number, limit?: number): Airport[];
}
