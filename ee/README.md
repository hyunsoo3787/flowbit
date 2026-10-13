# Flowbit Enterprise Edition (`ee/`)

This directory will contain the enterprise features of Flowbit, starting in
[phase 6](../docs/ROADMAP.md#phase-6-enterprise): SSO (OIDC/SAML), SCIM,
audit logs and organization-wide policies.

- **License:** everything in `ee/` is under the
  [Flowbit Enterprise Edition License](LICENSE), not the AGPL. You may use it
  for development and testing; production use requires a license key.
- **Boundary:** code outside `ee/` must never import from `ee/`. `ee/` plugs
  into the core through extension points
  ([ARCHITECTURE.md, "Open-core boundary"](../docs/ARCHITECTURE.md#open-core-boundary)).
  An ESLint rule enforces this.
- Without `ee/` the core is fully functional.

The directory is intentionally empty for now.
