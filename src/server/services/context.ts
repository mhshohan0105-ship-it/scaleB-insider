// Identity passed from actions/pages into services. Services never read the
// session themselves, which keeps them testable.
export interface ServiceContext {
  agencyId: string;
  userId: string | null;
  ip?: string | null;
  userAgent?: string | null;
}
