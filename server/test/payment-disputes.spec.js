const { PaymentsService } = require("../dist/src/payments/payments.service");

describe("payment dispute lifecycle", () => {
  it("records a lost dispute, marks chargeback, raises fraud risk, and audits atomically", async () => {
    const tx = {
        paymentDispute: { upsert: jest.fn().mockResolvedValue({}) },
        payment: { update: jest.fn().mockResolvedValue({}) },
        fraudAssessment: { create: jest.fn().mockResolvedValue({}) },
        userRestriction: { upsert: jest.fn().mockResolvedValue({}), updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
        auditLog: { create: jest.fn().mockResolvedValue({}) },
      },
      db = {
        payment: {
          findUnique: jest
            .fn()
            .mockResolvedValue({
              id: "payment",
              userId: "user",
              currency: "BDT",
            }),
        },
        $transaction: (callback) => callback(tx),
      },
      service = new PaymentsService(
        db,
        { get: () => undefined },
        {},
        {},
        { configured: false },
      ),
      dispute = {
        id: "dp_1",
        amount: 10000,
        currency: "bdt",
        reason: "fraudulent",
        status: "lost",
        evidence_details: { due_by: 1780000000 },
        metadata: {},
      };
    await service.handleStripeDispute(
      "payment",
      dispute,
      "charge.dispute.closed",
    );
    expect(tx.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "CHARGEBACK" }),
      }),
    );
    expect(tx.fraudAssessment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "RESTRICT_CALLING",
          score: 100,
        }),
      }),
    );
    expect(tx.auditLog.create).toHaveBeenCalled();
  });
});
