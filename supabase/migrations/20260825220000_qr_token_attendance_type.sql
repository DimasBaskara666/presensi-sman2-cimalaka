-- One projected QR is intentionally able to drive either check-in or
-- check-out. PostgreSQL decides which operation is valid from today's row.
-- Enum values must be committed before a later migration can safely use them.

alter type public.qr_token_type add value if not exists 'attendance';

