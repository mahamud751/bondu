# Optional Persona identity verification

Vendor KYC always supports encrypted manual review. When Persona is configured, an applicant can additionally open a server-created hosted inquiry. The API key and template ID stay on the server; the mobile app receives only Persona's one-time hosted link.

Set `PERSONA_API_KEY`, `PERSONA_TEMPLATE_ID`, and `PERSONA_WEBHOOK_SECRET` together. Configure Persona to send inquiry lifecycle events to:

`https://your-api.example/api/v1/vendors/identity/webhooks/persona`

Webhook signatures are calculated from the raw body as `HMAC-SHA256(secret, timestamp + "." + body)`, support secret rotation signatures, use constant-time comparison, and reject timestamps outside five minutes. Events are stored and deduplicated before updating the linked inquiry. Approved inquiries become `VERIFIED`; completed inquiries remain available for manual decisioning; declined or failed inquiries never approve a vendor automatically.

This follows Persona's official [inquiry creation](https://docs.withpersona.com/api-reference/inquiries/create-an-inquiry) and [webhook signature](https://docs.withpersona.com/quickstart-webhooks) contracts.
