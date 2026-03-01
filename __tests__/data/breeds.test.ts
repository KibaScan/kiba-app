import { DOG_BREEDS, CAT_BREEDS, BREED_SIZE_MAP } from '../../src/data/breeds';

describe('DOG_BREEDS', () => {
  test('contains known modifier breeds', () => {
    expect(DOG_BREEDS).toContain('Miniature Schnauzer');
    expect(DOG_BREEDS).toContain('German Shepherd');
    expect(DOG_BREEDS).toContain('Labrador Retriever');
    expect(DOG_BREEDS).toContain('Cavalier King Charles Spaniel');
    expect(DOG_BREEDS).toContain('Dalmatian');
  });

  test('"Mixed Breed" and "Unknown / Other" are pinned at the end', () => {
    const len = DOG_BREEDS.length;
    expect(DOG_BREEDS[len - 2]).toBe('Mixed Breed');
    expect(DOG_BREEDS[len - 1]).toBe('Unknown / Other');
  });

  test('body entries are alphabetically sorted', () => {
    const body = DOG_BREEDS.slice(0, -2);
    const sorted = [...body].sort((a, b) => a.localeCompare(b));
    expect(body).toEqual(sorted);
  });

  test('no duplicates', () => {
    expect(new Set(DOG_BREEDS).size).toBe(DOG_BREEDS.length);
  });
});

describe('CAT_BREEDS', () => {
  test('contains known modifier breeds', () => {
    expect(CAT_BREEDS).toContain('Burmese');
    expect(CAT_BREEDS).toContain('Persian');
    expect(CAT_BREEDS).toContain('Maine Coon');
    expect(CAT_BREEDS).toContain('Siamese');
    expect(CAT_BREEDS).toContain('Sphynx');
  });

  test('"Mixed Breed" and "Unknown / Other" are pinned at the end', () => {
    const len = CAT_BREEDS.length;
    expect(CAT_BREEDS[len - 2]).toBe('Mixed Breed');
    expect(CAT_BREEDS[len - 1]).toBe('Unknown / Other');
  });

  test('body entries are alphabetically sorted', () => {
    const body = CAT_BREEDS.slice(0, -2);
    const sorted = [...body].sort((a, b) => a.localeCompare(b));
    expect(body).toEqual(sorted);
  });

  test('no duplicates', () => {
    expect(new Set(CAT_BREEDS).size).toBe(CAT_BREEDS.length);
  });
});

describe('BREED_SIZE_MAP', () => {
  test('known small breeds map correctly', () => {
    expect(BREED_SIZE_MAP['Chihuahua']).toBe('small');
    expect(BREED_SIZE_MAP['French Bulldog']).toBe('small');
    expect(BREED_SIZE_MAP['Pug']).toBe('small');
  });

  test('known large breeds map correctly', () => {
    expect(BREED_SIZE_MAP['German Shepherd']).toBe('large');
    expect(BREED_SIZE_MAP['Labrador Retriever']).toBe('large');
  });

  test('known giant breeds map correctly', () => {
    expect(BREED_SIZE_MAP['Great Dane']).toBe('giant');
    expect(BREED_SIZE_MAP['Newfoundland']).toBe('giant');
  });

  test('every dog breed with a size mapping is in DOG_BREEDS', () => {
    for (const breed of Object.keys(BREED_SIZE_MAP)) {
      expect(DOG_BREEDS).toContain(breed);
    }
  });

  test('no cat breeds in BREED_SIZE_MAP', () => {
    for (const breed of CAT_BREEDS) {
      if (breed === 'Mixed Breed' || breed === 'Unknown / Other') continue;
      expect(BREED_SIZE_MAP[breed]).toBeUndefined();
    }
  });
});
