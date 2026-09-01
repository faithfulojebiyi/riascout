-- Derives movement for one collection by diffing it against the immediately
-- preceding complete run from the same source. Append-only.
--
-- The derivation lives in market.derive_movements (prisma/ddl/035-functions.sql)
-- so the ETL stage, this entry point and the tests cannot drift apart.
--
-- Deliberately NOT in prisma/sql/: TypedSQL introspects a live database at
-- generate time, so a file there that calls a function makes `prisma:generate`
-- fail on any database the migrations have not been applied to yet.

select market.derive_movements($1::text) as movements_created;
