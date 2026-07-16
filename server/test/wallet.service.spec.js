const { ConflictException } = require('@nestjs/common');
const { WalletService } = require('../dist/src/wallet/wallet.service');

const wallet = (overrides = {}) => ({ id: 'wallet-1', userId: 'user-1', purchased: 100, promotional: 0, reserved: 0, pendingEarning: 0, availableEarning: 0, held: 0, ...overrides });
function transaction(initial = wallet()) {
  const tx = {
    wallet: {
      findUniqueOrThrow: jest.fn().mockResolvedValue(initial),
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...initial, purchased: initial.purchased + (data.purchased?.increment ?? 0) - (data.purchased?.decrement ?? 0), promotional: initial.promotional + (data.promotional?.increment ?? 0) - (data.promotional?.decrement ?? 0), reserved: initial.reserved + (data.reserved?.increment ?? 0) - (data.reserved?.decrement ?? 0), pendingEarning: initial.pendingEarning + (data.pendingEarning?.increment ?? 0) - (data.pendingEarning?.decrement ?? 0), availableEarning: initial.availableEarning + (data.availableEarning?.increment ?? 0) - (data.availableEarning?.decrement ?? 0), held: initial.held + (data.held?.increment ?? 0) - (data.held?.decrement ?? 0) })),
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
  test('uses promotional points only after purchased points', async () => {
    const tx = transaction(wallet({ purchased: 5, promotional: 20 }));
    await service.debitPurchased(tx, { userId: 'user-1', type: 'GIFT_PURCHASE', direction: 'DEBIT', amount: 12, referenceType: 'GIFT', referenceId: 'gift-1', description: 'Gift', idempotencyKey: 'gift-1' });
    expect(tx.wallet.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ purchased: { decrement: 5 }, promotional: { decrement: 7 } }) }));
  });
  test('records a ledger entry when earnings are held for withdrawal', async () => {
    const tx = transaction(wallet({ availableEarning: 800 }));
    await service.holdWithdrawal(tx, 'user-1', 500, 'withdrawal-1');
    expect(tx.wallet.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ availableEarning: { decrement: 500 }, held: { increment: 500 } }) }));
    expect(tx.walletLedger.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ idempotencyKey: 'withdrawal:withdrawal-1:hold' }) }));
  });
  test('rejects withdrawal holds above available earnings', async () => {
    await expect(service.holdWithdrawal(transaction(wallet({ availableEarning: 499 })), 'user-1', 500, 'withdrawal-1')).rejects.toBeInstanceOf(ConflictException);
  });
  test('separates completed payout and withdrawal fee ledger entries',async()=>{
    const tx=transaction(wallet({held:600}));await service.completeWithdrawal(tx,'user-1',600,'withdrawal-fee',25);
    expect(tx.walletLedger.create).toHaveBeenNthCalledWith(1,expect.objectContaining({data:expect.objectContaining({type:'WITHDRAWAL',amount:575})}));
    expect(tx.walletLedger.create).toHaveBeenNthCalledWith(2,expect.objectContaining({data:expect.objectContaining({type:'WITHDRAWAL_FEE',amount:25})}));
  });
  test('moves a matured earning from pending to available with a ledger entry', async () => {
    const tx = transaction(wallet({ pendingEarning: 120, availableEarning: 30 }));
    await service.makeEarningAvailable(tx, 'user-1', 120, 'earning-1');
    expect(tx.wallet.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ pendingEarning: { decrement: 120 }, availableEarning: { increment: 120 } }) }));
    expect(tx.walletLedger.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ balanceBefore: 30, balanceAfter: 150, idempotencyKey: 'earning:earning-1:available' }) }));
  });
  test('credits promotional rewards without changing purchased points', async () => {
    const tx = transaction(wallet({ purchased: 100, promotional: 20 }));
    await service.creditPromotional(tx, { userId: 'user-1', type: 'PROMOTIONAL_BONUS', direction: 'CREDIT', amount: 50, referenceType: 'REFERRAL', referenceId: 'ref-1', description: 'Referral reward', idempotencyKey: 'ref-1:user-1' });
    expect(tx.wallet.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ promotional: { increment: 50 } }) }));
    expect(tx.walletLedger.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ balanceBefore: 20, balanceAfter: 70 }) }));
  });
  test.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])('rejects unsafe wallet amount %s before touching storage', async amount => {
    const tx = transaction();
    await expect(service.creditPurchased(tx, { userId: 'user-1', amount })).rejects.toBeInstanceOf(ConflictException);
    expect(tx.wallet.findUniqueOrThrow).not.toHaveBeenCalled();
  });
  test('rejects negative settlement charges', async () => {
    const tx = transaction();
    await expect(service.settleReservation(tx, 'user-1', 10, -1, 'call-1')).rejects.toBeInstanceOf(ConflictException);
    expect(tx.wallet.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});
