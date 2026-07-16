const { ConfigService } = require('@nestjs/config');
const { PayoutCryptoService } = require('../dist/src/security/payout-crypto.service');

describe('PayoutCryptoService', () => {
  const key = Buffer.alloc(32, 7).toString('base64');
  const service = new PayoutCryptoService(new ConfigService({ PAYOUT_ENCRYPTION_KEY: key, PAYOUT_ENCRYPTION_KEY_ID: 'test' }));

  it('round-trips payout details without storing plaintext', () => {
    const encrypted = service.encrypt('01712345678');
    expect(encrypted).not.toContain('01712345678');
    expect(encrypted.startsWith('test.')).toBe(true);
    expect(service.decrypt(encrypted)).toBe('01712345678');
  });

  it('rejects authenticated ciphertext tampering', () => {
    const encrypted = service.encrypt('01712345678');
    const parts = encrypted.split('.'), ciphertext = Buffer.from(parts[3], 'base64url');
    ciphertext[0] ^= 1;
    parts[3] = ciphertext.toString('base64url');
    expect(() => service.decrypt(parts.join('.'))).toThrow('Payout details could not be decrypted');
  });

  it('only exposes the final four digits in masks', () => {
    expect(service.mask('5678')).toBe('•••••••5678');
  });
});
