# Supabase — Fusion Gadgets

This directory is the **single source of truth for the database schema and seed data**.
It is the real data foundation for all later phases. The storefront reads catalog
data from Supabase in later phases; Phase 1 establishes the schema, RLS, and seed
without connecting the UI yet.

## Layout

```
supabase/
├── migrations/
│   ├── 0001_schema.sql         # enums, tables, constraints, FKs, indexes, triggers
│   ├── 0002_rls_policies.sql   # RLS enable + ownership policies
│   └── 0003_orders_idempotency.sql # order idempotency key (Phase 5)
├── seed.sql                    # seed data (categories, brands, 34 products, offers, profiles, orders, circulation)
├── seed-auth.sql               # DEV ONLY — auth.users rows for the two test profiles (enables login)
├── apply-idempotency.sql       # Standalone idempotency migration for existing DBs
├── config.toml                 # supabase CLI config
└── README.md                   # this file
```

## Apply to a Supabase project

Using the Supabase CLI linked to your project:

```bash
supabase link --project-ref <your-project-ref>

# 1. Apply schema (creates all tables, enums, constraints, triggers)
supabase db push

# 2. Load seed data (catalog + test profiles + sample orders + circulation)
supabase db execute --file supabase/seed.sql
#    (or psql "$DATABASE_URL" -f supabase/seed.sql)

# 3. (DEV ONLY) enable login for the two test users:
supabase db execute --file supabase/seed-auth.sql
```

## Test login (dev only, after seed-auth.sql)

| Email                       | Password    | Onboarding  |
|-----------------------------|-------------|-------------|
| riya.sharma@example.com     | fusion123   | complete    |
| onboarding@example.com      | onboard123  | incomplete  |

## Seed data

`seed.sql` contains the real catalog seed data (8 categories, 15 brands, 34 products
with images/variants/specs/reviews, 4 offers, 2 profiles, 4 sample orders, circulation).
It was originally generated from the mock catalog but is now the authoritative seed file.

To re-apply fresh: run `supabase/wipe-and-seed.sql` in the Dashboard SQL Editor.

## Security model (enforced by RLS, not the frontend)

| Table                     | anon | authenticated (own) | authenticated (others) | service_role |
|---------------------------|------|---------------------|-------------------------|--------------|
| categories, brands        | read | read                | read                    | full         |
| products + child rows     | read | read                | read                    | full         |
| offers, offer_products    | read | read                | read                    | full         |
| profiles                  | —    | read/update own     | deny                    | full         |
| addresses                 | —    | full own            | deny                    | full         |
| cart_items                | —    | full own            | deny                    | full         |
| wishlist_items            | —    | full own            | deny                    | full         |
| orders, order_items, timeline | — | read own          | deny                    | full         |
| circulation_versions/entries | read published only | read published only | read published only | full |

- **No public write path exists for catalog/offers/products.** RLS has SELECT-only
  policies and no INSERT/UPDATE/DELETE policies, so anon+authenticated are denied
  by default. Only `service_role` (held by the Worker / ProcessingServer) can write.
- **Orders are user-read-only.** Creation is a Worker-protected operation (Phase 5).
- **Circulation:** only `status = 'published'` versions are readable; half-built
  versions are invisible to the storefront.
