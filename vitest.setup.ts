// Load .env so tests that import `@/lib/db` (which requires DATABASE_URL at module init)
// can resolve their imports. Tests themselves don't actually hit the DB; we just need
// the module-level guard not to throw.
import "dotenv/config"
