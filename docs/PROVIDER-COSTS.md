# Provider costs before activation

Evidence costs USD 0 and is MIT licensed. Its authors sell no license, seat,
framework or connector entitlement. External providers bill your own account;
their free-plan limits do not limit Evidence's local capabilities.

Before entering provider credentials, switching on external delivery, or running
`rer deploy`, review the provider's current USD plan or calculator. Include
existing usage in that account, the intended seat count, API permissions and
collection cadence. Taxes, region, contract terms, discounts and overage can
change the final bill. Figures below were checked on 19 October 2026 and are
examples, not a quote for your organization.

## Hosting and email

Local operation uses the machine you own, local D1/R2 and the development
outbox, with USD 0 charged by Cloudflare or an email provider. Keep development
mail selected until you choose an external sender. No model-provider account is
needed for local operation or the shipped prepare-only agent workflow.

Before hosted deployment, review [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/),
[D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) and
[R2 pricing](https://developers.cloudflare.com/r2/pricing/). Workers Paid starts
at USD 5/month per account; usage beyond included allowances is extra. The
subscription is shared across that account. Set your intended requests, CPU,
database reads/writes and exhibit storage in the provider estimate before
running deployment. Evidence does not know your other applications' usage.

Before configuring `MAIL_PROVIDER`, `MAIL_FROM` and the selected provider's
private credential, compare these provider charges:

| Provider | USD example and billing basis |
| --- | --- |
| [Resend](https://resend.com/pricing) | Free within its allowance; Pro USD 20/month for 50,000 transactional emails, plus overage. Review daily limits. |
| [Twilio SendGrid](https://www.twilio.com/en-us/products/email-api/pricing) | Essentials starts at USD 19.95/month; check the selected volume tier and account quote. |
| [Cloudflare Email Service](https://developers.cloudflare.com/email-service/platform/pricing/) | Sending to arbitrary recipients requires Workers Paid. Includes 3,000 outbound emails/month; then USD 0.35 per 1,000. At 10,000 emails, overage is USD 2.45/month plus the Workers subscription and other usage. Verified destinations have separate free treatment. |

A provider credential enables use of that account's billable services. Review
its USD estimate before saving credentials; store credentials privately through
the existing setup/deployment mechanism. Never place them in source control.

## Application connections

Connections, ticket destinations, follow-ups and training show the named
provider's USD basis next to their connection forms. Reconnection screens repeat
the relevant disclosure. Existing subscriptions still apply; connecting an
existing account does not buy a new subscription from Evidence.

- GitHub, Jira, Linear, Asana and Slack offer USD 0 plans with their own limits;
  their paid plan examples are shown beside the connection form.
- Google Workspace and Okta charge by seats and term. JumpCloud, Microsoft
  Entra and Teams entitlements depend on your package; consult the linked
  provider page and your USD contract quote for the APIs or Workflows required.
- AWS, Google Cloud and Azure charges depend on services, region, accounts and
  API usage. IAM/STS on AWS and Resource Manager/Cloud Asset on Google Cloud
  have no additional charge, but other service reads and existing workloads can
  be billable. Estimate hourly collection across every selected account/project.
- KnowBe4 SAT Foundation's published example for 101–250 seats is USD 1.97 per
  seat/month on a three-year term: 250 seats are USD 492.50/month equivalent.
  Confirm the contract includes the Reporting API used by this connection.
- A Vector address may be self-hosted or operated by another organization.
  Obtain that operator's USD hosting/service quote; Evidence sets no Vector
  service price.

An account-specific quote is required where a provider has no universal flat
price. Do not treat “variable USD” as zero. Use the named provider's current
quote and your planned usage before enabling its connection. No extra Evidence
payment or activation key is required.
