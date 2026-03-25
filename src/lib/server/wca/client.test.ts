import { describe, it, expect } from 'vitest';
import { parseLinkHeader } from './client';

describe('parseLinkHeader', () => {
	it('returns empty object for null', () => {
		expect(parseLinkHeader(null)).toEqual({});
	});

	it('returns empty object for empty string', () => {
		expect(parseLinkHeader('')).toEqual({});
	});

	it('parses single rel="next"', () => {
		const header = '<https://www.worldcubeassociation.org/api/v0/competitions?page=2>; rel="next"';
		expect(parseLinkHeader(header)).toEqual({
			next: 'https://www.worldcubeassociation.org/api/v0/competitions?page=2'
		});
	});

	it('parses multiple rels', () => {
		const header =
			'<https://example.com?page=3>; rel="next", <https://example.com?page=1>; rel="prev"';
		expect(parseLinkHeader(header)).toEqual({
			next: 'https://example.com?page=3',
			prev: 'https://example.com?page=1'
		});
	});

	it('returns empty for malformed (no angle brackets)', () => {
		expect(parseLinkHeader('https://example.com?page=2; rel="next"')).toEqual({});
	});

	it('returns empty for malformed (no rel)', () => {
		expect(parseLinkHeader('<https://example.com?page=2>')).toEqual({});
	});

	it('handles extra whitespace', () => {
		const header = '<https://example.com?page=2>;   rel="next"';
		expect(parseLinkHeader(header)).toEqual({
			next: 'https://example.com?page=2'
		});
	});
});
