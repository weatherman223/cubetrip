import countriesData from '$lib/data/countries.json';

export type Continent =
	| 'Africa'
	| 'Asia'
	| 'Europe'
	| 'North America'
	| 'Oceania'
	| 'South America';

export interface Country {
	iso2: string;
	name: string;
	continent: Continent;
}

export const CONTINENTS: readonly Continent[] = [
	'Africa',
	'Asia',
	'Europe',
	'North America',
	'Oceania',
	'South America'
];

export const COUNTRIES: readonly Country[] = countriesData as Country[];

export const COUNTRIES_BY_ISO2: ReadonlyMap<string, Country> = new Map(
	COUNTRIES.map((c) => [c.iso2, c])
);

export const COUNTRIES_BY_CONTINENT: ReadonlyMap<Continent, readonly Country[]> = (() => {
	const map = new Map<Continent, Country[]>();
	for (const cont of CONTINENTS) map.set(cont, []);
	for (const c of COUNTRIES) map.get(c.continent)!.push(c);
	return map;
})();
