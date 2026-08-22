-- cart_items / wishlist_items: identity per (user_id, product_id)
--
-- Client upserts target ON CONFLICT (user_id, product_id); without a unique
-- constraint those upserts fail (42P10 -> HTTP 409) and guest-to-account
-- merges break at login. Also prevents duplicate rows from concurrent tabs.
-- Existing rows verified duplicate-free before applying.

ALTER TABLE public.cart_items
  DROP CONSTRAINT IF EXISTS cart_items_user_id_product_id_key;

ALTER TABLE public.cart_items
  ADD CONSTRAINT cart_items_user_id_product_id_key UNIQUE (user_id, product_id);

ALTER TABLE public.wishlist_items
  DROP CONSTRAINT IF EXISTS wishlist_items_user_id_product_id_key;

ALTER TABLE public.wishlist_items
  ADD CONSTRAINT wishlist_items_user_id_product_id_key UNIQUE (user_id, product_id);

NOTIFY pgrst, 'reload schema';
