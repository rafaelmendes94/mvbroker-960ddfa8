ALTER EXTENSION pg_trgm SET SCHEMA extensions;
SET search_path TO public, extensions;
ALTER DATABASE postgres SET search_path TO public, extensions;