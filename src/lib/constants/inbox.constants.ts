// localStorage keys for the inbox read-state. Kept here, in a side-effect-free
// module, so `identity-storage.services` can clear them on an identity change
// without importing `inbox.store` — that module starts a long-lived toast
// subscription at import, which we don't want on the signed-out/marketing cold
// path. `inbox.store` reads/writes these; the reconcile only deletes them.
export const INBOX_STORAGE_KEY = 'vici.inbox.v1';
export const INBOX_SETTLED_READ_STORAGE_KEY = 'vici.inbox.resolves.read.v1';
