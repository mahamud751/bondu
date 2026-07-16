const { NotificationDispatcher } = require('../dist/src/notifications/notification-dispatcher.service');

const notification = {
  id: 'notification',
  userId: 'user',
  type: 'SUSPICIOUS_LOGIN',
  title: 'New sign-in',
  body: 'A new device signed in.',
  data: {},
};

function setup({ preference = {}, emailFailure = false } = {}) {
  const db = {
    notificationPreference: { findUnique: jest.fn().mockResolvedValue({ mutedTypes: [], ...preference }) },
    user: { findUnique: jest.fn().mockResolvedValue({ email: 'member@example.com', phone: '01700000000' }) },
    notificationDelivery: { create: jest.fn().mockResolvedValue({}) },
    notification: { update: jest.fn().mockResolvedValue({}) },
    pushToken: { findMany: jest.fn(), updateMany: jest.fn() },
  };
  const config = { get: jest.fn().mockReturnValue(undefined) };
  const realtime = { user: jest.fn() };
  const email = {
    configured: jest.fn().mockReturnValue(true),
    send: emailFailure ? jest.fn().mockRejectedValue(new Error('provider down')) : jest.fn().mockResolvedValue({ providerId: 'mail-1' }),
  };
  const sms = { sendTransactional: jest.fn().mockResolvedValue({ providerId: 'sms-1' }) };
  return { dispatcher: new NotificationDispatcher(db, config, realtime, email, sms), db, realtime, email, sms };
}

describe('NotificationDispatcher channels', () => {
  it('delivers enabled email and critical security SMS with audit records', async () => {
    const { dispatcher, db, realtime, email, sms } = setup();
    await dispatcher.dispatch(notification);
    expect(realtime.user).toHaveBeenCalledWith('user', 'notification:new', notification);
    expect(email.send).toHaveBeenCalled();
    expect(sms.sendTransactional).toHaveBeenCalled();
    expect(db.notificationDelivery.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ channel: 'EMAIL', status: 'DELIVERED' }) }));
    expect(db.notificationDelivery.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ channel: 'SMS', status: 'DELIVERED' }) }));
  });

  it('suppresses nonessential email during overnight quiet hours but keeps security SMS', async () => {
    const { dispatcher, email, sms } = setup({ preference: { quietStart: '00:00', quietEnd: '23:59' } });
    jest.spyOn(dispatcher, 'inQuietHours').mockReturnValue(true);
    await dispatcher.dispatch(notification);
    expect(email.send).not.toHaveBeenCalled();
    expect(sms.sendTransactional).toHaveBeenCalled();
  });

  it('records a failed optional channel without preventing final dispatch', async () => {
    const { dispatcher, db } = setup({ emailFailure: true });
    await dispatcher.dispatch(notification);
    expect(db.notificationDelivery.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ channel: 'EMAIL', status: 'FAILED', error: 'provider down' }) }));
    expect(db.notification.update).toHaveBeenCalledWith(expect.objectContaining({ data: { dispatchedAt: expect.any(Date) } }));
  });
});
