# Google and Apple sign-in setup

SocialConnect accepts provider **identity tokens only**. It never trusts a client-supplied provider user ID. The API verifies signature, issuer, audience, expiry and verified email; Apple tokens must also contain the expected one-time nonce. Provider identities are uniquely linked in `AuthIdentity` and the raw nonce is never stored.

## Google

1. Create Android, iOS and Web OAuth clients in one Google Cloud project.
2. Put every accepted backend audience in `GOOGLE_CLIENT_IDS` as a comma-separated list.
3. Set the public Web client ID in `app/src/config/authProviders.ts`.
4. Configure Android signing certificate fingerprints and the iOS URL scheme in the provider console/native project before release.

Google requires sending the ID token—not a plain Google user ID—to the backend. The backend checks Google’s rotating signature keys, accepted audience, issuer, expiry and `email_verified` claim using the official Google authentication library. See [Google’s backend authentication guide](https://developers.google.com/identity/sign-in/android/backend-auth).

## Apple

1. Enable **Sign in with Apple** for the production App ID and provisioning profile.
2. Set `APPLE_CLIENT_ID` to the bundle identifier/client ID used as the token audience.
3. Keep the provided `SocialConnect.entitlements` capability enabled in the signed iOS target.
4. Configure Apple relay-email domains and account-transfer handling before changing developer teams.

Apple requires verification of the JWS signature with Apple’s rotating public keys, issuer `https://appleid.apple.com`, audience, expiry and nonce. SocialConnect performs each check using Apple’s JWKS endpoint. See [Apple’s token verification requirements](https://developer.apple.com/documentation/signinwithapple/verifying-a-user) and [public-key documentation](https://developer.apple.com/documentation/signinwithapplerestapi/fetch-apple%27s-public-key-for-verifying-token-signature).

## Account creation and linking

An already-linked provider identity signs into its existing account. Otherwise, a provider-verified email can link to the existing account with that email. A new account additionally requires username, display name, date of birth, 18+ validation and terms acceptance. Provider secrets and Apple private keys belong in the deployment secret manager and must never be shipped in the mobile bundle.
