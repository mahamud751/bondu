const { ConflictException } = require('@nestjs/common');
const { PaymentsService } = require('../dist/src/payments/payments.service');

const payment = { id: 'payment', gateway: 'SSLCOMMERZ', transactionId: 'SCZ-1', currency: 'BDT', amount: 100, status: 'SUBMITTED' };
const database = () => ({
  payment: { findUnique: jest.fn().mockResolvedValue(payment), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  paymentWebhook: { findUnique: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'webhook' }), update: jest.fn().mockResolvedValue({}) },
});

describe('PaymentsService SSLCommerz IPN', () => {
  it('confirms a failed notification against the gateway before rejecting locally', async () => {
    const db = database(), ssl = { configured: true, query: jest.fn().mockResolvedValue({ tran_id: 'SCZ-1', status: 'FAILED' }) };
    const service = new PaymentsService(db, { get: () => undefined }, {}, {}, ssl);
    await expect(service.sslCommerzIpn({ tran_id: 'SCZ-1', status: 'FAILED' })).resolves.toEqual({ received: true, duplicate: false });
    expect(ssl.query).toHaveBeenCalledWith('SCZ-1');
    expect(db.payment.updateMany).toHaveBeenCalled();
  });
  it('does not mutate payment status when the gateway disagrees', async () => {
    const db = database(), ssl = { configured: true, query: jest.fn().mockResolvedValue({ tran_id: 'SCZ-1', status: 'VALID' }) };
    const service = new PaymentsService(db, { get: () => undefined }, {}, {}, ssl);
    await expect(service.sslCommerzIpn({ tran_id: 'SCZ-1', status: 'FAILED' })).rejects.toBeInstanceOf(ConflictException);
    expect(db.payment.updateMany).not.toHaveBeenCalled();
    expect(db.paymentWebhook.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ error: expect.any(String) }) }));
  });
});
