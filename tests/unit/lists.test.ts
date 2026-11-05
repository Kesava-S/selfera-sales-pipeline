import { describe, it, expect } from 'vitest';
import {
  DEFAULT_LISTS,
  categoryNames,
  categoryFromSlug,
  categorySlug,
  platformFromSlug,
  matchCategory,
} from '@/lib/lists';

describe('business category & platform lookup logic (src/lib/lists.ts)', () => {
  const sampleLists = {
    services: ['Web Design', 'SEO', 'Mobile App'],
    platforms: [
      { name: 'WhatsApp', slug: 'whatsapp' },
      { name: 'Email', slug: 'email' },
      { name: 'Instagram', slug: 'instagram' },
    ],
    categories: [
      {
        name: 'Hotels & Accommodation',
        slug: 'hotels-accommodation',
        description: null,
        icon_name: 'Hotel',
        synonyms: ['hotel', 'motel', 'hospitality', 'resort'],
      },
      {
        name: 'Restaurants & Cafes',
        slug: 'restaurants-cafes',
        description: null,
        icon_name: 'Utensils',
        synonyms: ['restaurant', 'cafe', 'bistro', 'diner'],
      },
    ],
  };

  describe('categoryNames', () => {
    it('returns array of category names', () => {
      expect(categoryNames(sampleLists)).toEqual([
        'Hotels & Accommodation',
        'Restaurants & Cafes',
      ]);
    });
  });

  describe('categoryFromSlug & categorySlug', () => {
    it('resolves category name from slug or encoded slug', () => {
      expect(categoryFromSlug(sampleLists, 'hotels-accommodation')).toBe(
        'Hotels & Accommodation'
      );
      expect(categoryFromSlug(sampleLists, 'restaurants-cafes')).toBe(
        'Restaurants & Cafes'
      );
    });

    it('finds category via synonym fallback when slug is non-standard', () => {
      expect(categoryFromSlug(sampleLists, 'bistro')).toBe('Restaurants & Cafes');
      expect(categoryFromSlug(sampleLists, 'unknown-category')).toBeNull();
    });

    it('generates slug for category name', () => {
      expect(categorySlug(sampleLists, 'Hotels & Accommodation')).toBe(
        'hotels-accommodation'
      );
      expect(categorySlug(sampleLists, 'Custom Category')).toBe('custom-category');
    });
  });

  describe('platformFromSlug', () => {
    it('resolves platform name from slug case-insensitively', () => {
      expect(platformFromSlug(sampleLists, 'whatsapp')).toBe('WhatsApp');
      expect(platformFromSlug(sampleLists, 'EMAIL')).toBe('Email');
      expect(platformFromSlug(sampleLists, 'nonexistent')).toBeNull();
    });
  });

  describe('matchCategory', () => {
    it('matches category by exact name or synonyms', () => {
      expect(matchCategory(sampleLists, 'Hotel')).toBe('Hotels & Accommodation');
      expect(matchCategory(sampleLists, 'resort')).toBe('Hotels & Accommodation');
      expect(matchCategory(sampleLists, 'diner')).toBe('Restaurants & Cafes');
    });

    it('returns null for empty or non-matching inputs', () => {
      expect(matchCategory(sampleLists, '')).toBeNull();
      expect(matchCategory(sampleLists, 'Spaceship Manufacturer')).toBeNull();
    });
  });

  describe('DEFAULT_LISTS fallback', () => {
    it('provides valid defaults when database is unavailable', () => {
      expect(DEFAULT_LISTS.services.length).toBeGreaterThan(0);
      expect(DEFAULT_LISTS.platforms.length).toBeGreaterThan(0);
      expect(DEFAULT_LISTS.categories.length).toBeGreaterThan(0);
    });
  });
});

