const { ConflictException } = require('@nestjs/common');
const { WalletService } = require('../dist/src/wallet/wallet.service');

const wallet = (overrides = {}) => ({ id: 'wallet-1', userId: 'user-1', purchased: 100, reserved: 0, pendingEarning: 0, ...overrides });
function transaction(initial = wallet()) {
  const tx = {
    wallet: {
      findUniqueOrThrow: jest.fn().mockResolvedValue(initial),
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...initial, purchased: initial.purchased + (data.purchased?.increment ?? 0) - (data.purchased?.decrement ?? 0), reserved: initial.reserved + (data.reserved?.increment ?? 0) - (data.reserved?.decrement ?? 0) })),
    },
    walletLedger: { create: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)) },
  };
  return tx;
}

describe('WalletService', () => {
  const service = new WalletService({});
  test('rejects a debit that would spend reserved points', async () => {
    const tx = transaction(wallet({ purchased: 100, reserved: 80 }));
    await expect(service.debitPurchased(tx, { userId: 'user-1', amount: 21 })).rejects.toBeInstanceOf(ConflictException);
    expect(tx.wallet.update).not.toHaveBeenCalled();
  });
  test('settles a reservation and releases unused points', async () => {
    const tx = transaction(wallet({ purchased: 100, reserved: 60 }));
    await service.settleReservation(tx, 'user-1', 60, 25, 'call-1');
    expect(tx.wallet.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ reserved: { decrement: 60 }, purchased: { decrement: 25 } }) }));
    expect(tx.walletLedger.create).toHaveBeenCalledTimes(2);
  });
  test('rejects charges larger than their reservation', async () => {
    await expect(service.settleReservation(transaction(), 'user-1', 10, 11, 'call-1')).rejects.toBeInstanceOf(ConflictException);
  });
});
