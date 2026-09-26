import type { IataCode } from '@domain/index';
import { airportIndex } from './airports/index';

/**
 * Which currency a car's estimate defaults to.
 *
 * The airport's country, because that is where the meter runs. The host can
 * change it, and the list is short on purpose: every entry has two minor
 * digits, which `fareEach` relies on when it rounds a share up to a whole unit.
 * A currency without them (the yen) would need that rounding rethought before
 * it goes on this list.
 */
export const FARE_CURRENCIES = ['EUR', 'GBP', 'USD', 'SGD', 'NOK', 'DKK', 'SEK', 'CHF', 'AED', 'HKD', 'AUD', 'CAD', 'INR'] as const;
export type FareCurrency = (typeof FARE_CURRENCIES)[number];

const EURO_AREA = new Set([
  'AT', 'BE', 'HR', 'CY', 'EE', 'FI', 'FR', 'DE', 'GR', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PT', 'SK', 'SI', 'ES',
]);

const BY_COUNTRY: Record<string, FareCurrency> = {
  GB: 'GBP',
  US: 'USD',
  SG: 'SGD',
  NO: 'NOK',
  DK: 'DKK',
  SE: 'SEK',
  CH: 'CHF',
  AE: 'AED',
  HK: 'HKD',
  AU: 'AUD',
  CA: 'CAD',
  IN: 'INR',
};

export function currencyForAirport(iata: IataCode | string): FareCurrency {
  const cc = airportIndex.get(iata as IataCode)?.countryCode?.toUpperCase() ?? '';
  if (EURO_AREA.has(cc)) return 'EUR';
  return BY_COUNTRY[cc] ?? 'EUR';
}
