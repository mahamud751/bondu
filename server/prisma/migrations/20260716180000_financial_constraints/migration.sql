ALTER TABLE "Wallet"
  ADD CONSTRAINT "Wallet_purchased_nonnegative" CHECK ("purchased" >= 0),
  ADD CONSTRAINT "Wallet_promotional_nonnegative" CHECK ("promotional" >= 0),
  ADD CONSTRAINT "Wallet_reserved_nonnegative" CHECK ("reserved" >= 0),
  ADD CONSTRAINT "Wallet_pending_earning_nonnegative" CHECK ("pendingEarning" >= 0),
  ADD CONSTRAINT "Wallet_available_earning_nonnegative" CHECK ("availableEarning" >= 0),
  ADD CONSTRAINT "Wallet_held_nonnegative" CHECK ("held" >= 0),
  ADD CONSTRAINT "Wallet_reservation_covered" CHECK ("reserved" <= "purchased" + "promotional");

ALTER TABLE "WalletLedger" ADD CONSTRAINT "WalletLedger_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "PlatformLedger" ADD CONSTRAINT "PlatformLedger_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "Withdrawal" ADD CONSTRAINT "Withdrawal_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "Earning" ADD CONSTRAINT "Earning_amounts_valid" CHECK ("grossAmount" >= 0 AND "vendorAmount" >= 0 AND "platformAmount" >= 0 AND "vendorAmount" + "platformAmount" = "grossAmount");
