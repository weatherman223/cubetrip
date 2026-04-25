import { describe, it, expect } from 'vitest';
import {
	COUNTRIES,
	COUNTRIES_BY_ISO2,
	COUNTRIES_BY_CONTINENT,
	CONTINENTS,
	type Continent
} from './countries';

describe('countries dataset', () => {
	it('has a non-empty country list', () => {
		expect(COUNTRIES.length).toBeGreaterThan(100);
	});

	it('has known countries with expected continents', () => {
		expect(COUNTRIES_BY_ISO2.get('US')).toMatchObject({
			iso2: 'US',
			name: 'United States',
			continent: 'North America'
		});
		expect(COUNTRIES_BY_ISO2.get('GB')).toMatchObject({ continent: 'Europe' });
		expect(COUNTRIES_BY_ISO2.get('JP')).toMatchObject({ continent: 'Asia' });
		expect(COUNTRIES_BY_ISO2.get('DE')).toMatchObject({ continent: 'Europe' });
		expect(COUNTRIES_BY_ISO2.get('AU')).toMatchObject({ continent: 'Oceania' });
		expect(COUNTRIES_BY_ISO2.get('BR')).toMatchObject({ continent: 'South America' });
		expect(COUNTRIES_BY_ISO2.get('ZA')).toMatchObject({ continent: 'Africa' });
	});

	it('contains no duplicate ISO2 codes', () => {
		const seen = new Set<string>();
		for (const c of COUNTRIES) {
			expect(seen.has(c.iso2)).toBe(false);
			seen.add(c.iso2);
		}
	});

	it('every country falls under one of the six known continents', () => {
		const valid = new Set<Continent>(CONTINENTS);
		for (const c of COUNTRIES) {
			expect(valid.has(c.continent as Continent)).toBe(true);
		}
	});

	it('does not include WCA placeholder grouping entries (XM, XW)', () => {
		expect(COUNTRIES_BY_ISO2.has('XM')).toBe(false);
		expect(COUNTRIES_BY_ISO2.has('XW')).toBe(false);
	});

	it('every continent has at least one country', () => {
		for (const cont of CONTINENTS) {
			const list = COUNTRIES_BY_CONTINENT.get(cont) ?? [];
			expect(list.length).toBeGreaterThan(0);
		}
	});

	it('continent groupings sum to the full country list', () => {
		const total = CONTINENTS.reduce(
			(sum, cont) => sum + (COUNTRIES_BY_CONTINENT.get(cont)?.length ?? 0),
			0
		);
		expect(total).toBe(COUNTRIES.length);
	});
});
