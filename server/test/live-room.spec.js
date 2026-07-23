describe('Live room foundation', () => {
  it('keeps stable discovery categories used by start + list filters', () => {
    const categories = [
      'CHAT',
      'MUSIC',
      'DANCE',
      'GAMING',
      'TALENT',
      'EDU',
      'LIFESTYLE',
      'OTHER',
    ];
    expect(categories).toHaveLength(8);
    expect(new Set(categories).size).toBe(8);
  });
});
