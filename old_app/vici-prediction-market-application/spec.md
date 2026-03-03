# Specification

## Summary

**Goal:** Implement owner-based admin role management with configurable admin access control.

**Planned changes:**

- Add single immutable owner Principal set at canister initialization
- Maintain a set of admin Principals in stable backend state
- Add backend functions for owner to add and remove admins
- Add query function to retrieve list of current admins
- Update all admin-only backend functions to verify caller is owner or admin
- Add Admin Management section to AdminPage displaying current admins
- Add form for owner to add new admins by Principal ID
- Add remove buttons for owner to revoke admin access
- Implement React Query hooks for admin list fetching and mutations

**User-visible outcome:** The owner can manage admin access through a dedicated Admin Management section, adding or removing admin Principals. All users can view the current list of admins. Admin-only features are restricted to authorized Principals.
