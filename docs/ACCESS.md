# Roles, single sign-on and SCIM

This page documents AUTH-001. The installation owner keeps native email-link sign-in
and holds every door. Everything below is delegation, and a door that is not named for
a role stays with the owner.

## Roles

The owner grants a role to an account that already exists, with a reason, in Access.

| Role | Opens |
| --- | --- |
| Administrator | Program work, Access administration (never the administrator role itself) and approvals |
| Compliance manager | Program work and policy and tailoring approvals |
| Control owner | Evidence for the controls in scope |
| Contributor | Submitting evidence for the controls in scope, without downloading others' files |
| Risk approver | Reading risks and accepting residual risk |
| Employee | Their own tasks, matched to People |
| Auditor | Their own engagement only, through the auditor API |

A scope is the whole business, a team, one control or a restricted record area. A
control owner or contributor with the business scope reaches the controls they are
named on; a team grant reaches the controls the owner placed in that team. Nobody
approves what they drafted, assessed or prepared. Connections, trackers, collectors,
API tokens, archives, erasure and trust stay with the owner.

## Single sign-on

Bind these Worker secrets to offer a provider; a provider with any binding missing is
not offered. Set `OIDC_TRANSACTION_SECRET` to a random value of at least 32 characters.

- Google Workspace: `SSO_GOOGLE_CLIENT_ID` and `SSO_GOOGLE_CLIENT_SECRET`.
- Microsoft Entra ID: `SSO_MICROSOFT_TENANT`, `SSO_MICROSOFT_CLIENT_ID` and
  `SSO_MICROSOFT_CLIENT_SECRET`. Never the common tenant.
- Okta: `SSO_OKTA_ISSUER`, `SSO_OKTA_CLIENT_ID` and `SSO_OKTA_PRIVATE_KEY` (a private JWK
  with a key id; register its public half on the Okta app and choose the private key JWT
  client authentication, because Okta refuses the shared-secret method Base sends).

Register the installation's own address followed by `/auth/oidc/google/callback`, and the
same path with `microsoft` or `okta`, as the redirect address. The owner then turns provider sign-in on
in Sign-in settings. Entra and Okta name a person only through the subject map that
SCIM fills; Google trusts a verified Workspace address.

The owner can require a second factor. While it is required, a provider sign-in whose
ID token does not prove one is refused and audited. Google does not state its methods
in the token, so a Google sign-in is refused while a second factor is required.

## SCIM

The owner issues a SCIM token for one provider, with an expiry, in Access. It is shown
once and stored only as a digest. Point the provider's SCIM connector at
the installation's own address followed by `/scim/v2`, with that token. Provisioning creates an account, a
person in People, the provider subject and a contributor role. A provisioned person
signs in only through their provider. Deactivating or deleting the user ends their
sessions, their roles and their ability to sign in at once. An existing owner,
auditor or invited account is never taken over.

## Break-glass and revocation

While single sign-on is configured, the owner's email link is the break-glass door and
each use is recorded as break-glass in the audit trail. The owner can end all sessions
of a delegated person in Access, revoke a role, or deactivate the account; the next
request fails.
