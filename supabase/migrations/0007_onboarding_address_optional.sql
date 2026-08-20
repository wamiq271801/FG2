-- Add address_optional state to onboarding_state_enum.
--
-- Onboarding now has three persisted states:
--   incomplete      — profile info (name + phone) not yet collected (Step 1 pending)
--   address_optional — Step 1 complete; Step 2 (address) pending or skippable
--   complete        — all required onboarding done; full app access
--
-- Existing rows with onboarding_state='incomplete' remain valid — they resume Step 1.
-- Existing rows with onboarding_state='complete' are unaffected.

ALTER TYPE onboarding_state_enum ADD VALUE IF NOT EXISTS 'address_optional' AFTER 'incomplete';
