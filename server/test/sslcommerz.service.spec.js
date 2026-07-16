const { BadRequestException } = require('@nestjs/common');
const { SslCommerzService } = require('../dist/src/payments/sslcommerz.service');

describe('SslCommerzService', () => {
  const values = { SSLCOMMERZ_STORE_ID: 'store', SSLCOMMERZ_STORE_PASSWORD: 'secret', PUBLIC_API_URL: 'https://api.example/api/v1', SSLCOMMERZ_LIVE: 'false' };
  const service = new SslCommerzService({ get: key => values[key] });
  afterEach(() => jest.restoreAllMocks());
  it('creates a server-side hosted session without exposing credentials', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ status: 'SUCCESS', sessionkey: 'session', GatewayPageURL: 'https://sandbox.sslcommerz.com/checkout' }) });
    await expect(service.createSession({ transactionId: 'SCZ-1', amount: 100, customerName: 'Member', phone: '01900000000' })).resolves.toEqual({ sessionKey: 'session', checkoutUrl: 'https://sandbox.sslcommerz.com/checkout' });
    const request = fetchMock.mock.calls[0];
    expect(request[0]).toContain('sandbox.sslcommerz.com');
    expect(String(request[1].body)).toContain('store_passwd=secret');
  });
  it('accepts only a completed validation response', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ status: 'INVALID_TRANSACTION', APIConnect: 'DONE' }) });
    await expect(service.validate('validation-id')).rejects.toBeInstanceOf(BadRequestException);
  });
  it('queries transactions by merchant transaction ID for reconciliation', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ status: 'VALID', tran_id: 'SCZ-1', amount: '100.00' }) });
    await expect(service.query('SCZ-1')).resolves.toEqual(expect.objectContaining({ status: 'VALID' }));
    expect(fetchMock.mock.calls[0][0]).toContain('merchantTransIDvalidationAPI.php');
    expect(fetchMock.mock.calls[0][0]).toContain('tran_id=SCZ-1');
  });
});
