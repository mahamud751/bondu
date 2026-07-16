# SSLCommerz hosted payment integration

SocialConnect creates SSLCommerz sessions only from the API. Store credentials never enter the mobile application. The mobile app opens the returned hosted checkout URL and receives the result through the registered `socialconnect://payment` URL scheme.

## Production configuration

Set `PUBLIC_API_URL`, `MOBILE_PAYMENT_RETURN_URL`, `SSLCOMMERZ_STORE_ID`, `SSLCOMMERZ_STORE_PASSWORD`, and `SSLCOMMERZ_LIVE=true`. Configure the merchant IPN listener to:

`https://your-api.example/api/v1/payments/sslcommerz/ipn`

The callback must be publicly reachable over TLS. Use sandbox credentials and keep `SSLCOMMERZ_LIVE=false` until live acceptance is complete.

## Trust and settlement

An IPN is never sufficient by itself. Successful notices are checked through SSLCommerz's Order Validation API; transaction ID, exact BDT amount, currency, API status, and risk level must match the local order. Failed/cancelled notices are confirmed through the merchant transaction query API. Valid high-risk payments are held for Finance review rather than credited.

Every notice is stored with a gateway-scoped unique event ID. Wallet credit and referral qualification run in the existing serializable, idempotent financial transaction. The scheduled reconciliation job queries recent gateway orders and can recover a verified payment when an IPN was missed.

The integration follows the official [SSLCommerz integration and validation flow](https://developer.sslcommerz.com/docs.html).
