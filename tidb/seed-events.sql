-- ============================================================
-- Fusion Gadgets — TiDB test seed events for Phase 7 verification.
-- Run this against the TiDB Cloud fusion_tracking database.
-- Generates 50 realistic tracking events across multiple products.
-- ============================================================

-- Insert 50 test events (25 product_view, 10 product_click, 8 add_to_cart, 7 wishlist_add)
-- Using INSERT IGNORE so re-running is safe (dedup via event_id unique key)

INSERT IGNORE INTO raw_events (event_id, event_type, occurred_at, received_at, product_slug, category_slug, session_id, surface, qty) VALUES
-- Product views (25)
('test-001','product_view', NOW() - INTERVAL 1 HOUR, NOW(), 'halo-one-wireless', 'audio', 'sess-001', 'product', NULL),
('test-002','product_view', NOW() - INTERVAL 55 MINUTE, NOW(), 'echo-pro-anc-earbuds', 'audio', 'sess-002', 'product', NULL),
('test-003','product_view', NOW() - INTERVAL 50 MINUTE, NOW(), 'pulse-2-smartwatch', 'wearables', 'sess-003', 'product', NULL),
('test-004','product_view', NOW() - INTERVAL 45 MINUTE, NOW(), 'spark-65w-gan-charger', 'power', 'sess-004', 'product', NULL),
('test-005','product_view', NOW() - INTERVAL 40 MINUTE, NOW(), 'halo-one-wireless', 'audio', 'sess-005', 'product', NULL),
('test-006','product_view', NOW() - INTERVAL 35 MINUTE, NOW(), 'type-75-mechanical', 'keyboards', 'sess-006', 'product', NULL),
('test-007','product_view', NOW() - INTERVAL 30 MINUTE, NOW(), 'lumen-x100-compact', 'cameras', 'sess-007', 'product', NULL),
('test-008','product_view', NOW() - INTERVAL 25 MINUTE, NOW(), 'halo-one-wireless', 'audio', 'sess-008', 'product', NULL),
('test-009','product_view', NOW() - INTERVAL 20 MINUTE, NOW(), 'compass-tech-backpack', 'gaming-carry', 'sess-009', 'product', NULL),
('test-010','product_view', NOW() - INTERVAL 18 MINUTE, NOW(), 'echo-lite-earbuds', 'audio', 'sess-010', 'product', NULL),
('test-011','product_view', NOW() - INTERVAL 16 MINUTE, NOW(), 'vista-27-4k-monitor', 'computing', 'sess-011', 'product', NULL),
('test-012','product_view', NOW() - INTERVAL 14 MINUTE, NOW(), 'halo-one-wireless', 'audio', 'sess-012', 'product', NULL),
('test-013','product_view', NOW() - INTERVAL 12 MINUTE, NOW(), 'drift-wireless-controller', 'gaming-carry', 'sess-013', 'product', NULL),
('test-014','product_view', NOW() - INTERVAL 10 MINUTE, NOW(), 'aura-led-desk-lamp', 'desks', 'sess-014', 'product', NULL),
('test-015','product_view', NOW() - INTERVAL 8 MINUTE, NOW(), 'halo-one-wireless', 'audio', 'sess-015', 'product', NULL),
('test-016','product_view', NOW() - INTERVAL 7 MINUTE, NOW(), 'echo-pro-anc-earbuds', 'audio', 'sess-016', 'product', NULL),
('test-017','product_view', NOW() - INTERVAL 6 MINUTE, NOW(), 'pulse-2-smartwatch', 'wearables', 'sess-017', 'product', NULL),
('test-018','product_view', NOW() - INTERVAL 5 MINUTE, NOW(), 'spark-65w-gan-charger', 'power', 'sess-018', 'product', NULL),
('test-019','product_view', NOW() - INTERVAL 4 MINUTE, NOW(), 'halo-one-wireless', 'audio', 'sess-019', 'product', NULL),
('test-020','product_view', NOW() - INTERVAL 3 MINUTE, NOW(), 'type-75-mechanical', 'keyboards', 'sess-020', 'product', NULL),
('test-021','product_view', NOW() - INTERVAL 2 MINUTE, NOW(), 'lumen-x100-compact', 'cameras', 'sess-021', 'product', NULL),
('test-022','product_view', NOW() - INTERVAL 90 SECOND, NOW(), 'halo-one-wireless', 'audio', 'sess-022', 'product', NULL),
('test-023','product_view', NOW() - INTERVAL 60 SECOND, NOW(), 'compass-tech-backpack', 'gaming-carry', 'sess-023', 'product', NULL),
('test-024','product_view', NOW() - INTERVAL 30 SECOND, NOW(), 'echo-lite-earbuds', 'audio', 'sess-024', 'product', NULL),
('test-025','product_view', NOW() - INTERVAL 15 SECOND, NOW(), 'halo-one-wireless', 'audio', 'sess-025', 'product', NULL),
-- Product clicks (10)
('test-026','product_click', NOW() - INTERVAL 50 MINUTE, NOW(), 'halo-one-wireless', 'audio', 'sess-001', 'home', NULL),
('test-027','product_click', NOW() - INTERVAL 45 MINUTE, NOW(), 'echo-pro-anc-earbuds', 'audio', 'sess-002', 'home', NULL),
('test-028','product_click', NOW() - INTERVAL 40 MINUTE, NOW(), 'pulse-2-smartwatch', 'wearables', 'sess-003', 'home', NULL),
('test-029','product_click', NOW() - INTERVAL 35 MINUTE, NOW(), 'spark-65w-gan-charger', 'power', 'sess-004', 'shop', NULL),
('test-030','product_click', NOW() - INTERVAL 30 MINUTE, NOW(), 'halo-one-wireless', 'audio', 'sess-005', 'shop', NULL),
('test-031','product_click', NOW() - INTERVAL 25 MINUTE, NOW(), 'type-75-mechanical', 'keyboards', 'sess-006', 'shop', NULL),
('test-032','product_click', NOW() - INTERVAL 20 MINUTE, NOW(), 'lumen-x100-compact', 'cameras', 'sess-007', 'shop', NULL),
('test-033','product_click', NOW() - INTERVAL 15 MINUTE, NOW(), 'halo-one-wireless', 'audio', 'sess-008', 'shop', NULL),
('test-034','product_click', NOW() - INTERVAL 10 MINUTE, NOW(), 'compass-tech-backpack', 'gaming-carry', 'sess-009', 'category', NULL),
('test-035','product_click', NOW() - INTERVAL 5 MINUTE, NOW(), 'echo-lite-earbuds', 'audio', 'sess-010', 'category', NULL),
-- Add to cart (8)
('test-036','add_to_cart', NOW() - INTERVAL 45 MINUTE, NOW(), 'halo-one-wireless', 'audio', 'sess-001', 'product', 1),
('test-037','add_to_cart', NOW() - INTERVAL 40 MINUTE, NOW(), 'echo-pro-anc-earbuds', 'audio', 'sess-002', 'product', 1),
('test-038','add_to_cart', NOW() - INTERVAL 35 MINUTE, NOW(), 'spark-65w-gan-charger', 'power', 'sess-004', 'product', 2),
('test-039','add_to_cart', NOW() - INTERVAL 25 MINUTE, NOW(), 'halo-one-wireless', 'audio', 'sess-005', 'product', 1),
('test-040','add_to_cart', NOW() - INTERVAL 20 MINUTE, NOW(), 'type-75-mechanical', 'keyboards', 'sess-006', 'product', 1),
('test-041','add_to_cart', NOW() - INTERVAL 12 MINUTE, NOW(), 'halo-one-wireless', 'audio', 'sess-012', 'product', 1),
('test-042','add_to_cart', NOW() - INTERVAL 8 MINUTE, NOW(), 'compass-tech-backpack', 'gaming-carry', 'sess-009', 'product', 1),
('test-043','add_to_cart', NOW() - INTERVAL 3 MINUTE, NOW(), 'halo-one-wireless', 'audio', 'sess-019', 'product', 1),
-- Wishlist adds (7)
('test-044','wishlist_add', NOW() - INTERVAL 40 MINUTE, NOW(), 'halo-one-wireless', 'audio', 'sess-001', NULL, NULL),
('test-045','wishlist_add', NOW() - INTERVAL 35 MINUTE, NOW(), 'pulse-2-smartwatch', 'wearables', 'sess-003', NULL, NULL),
('test-046','wishlist_add', NOW() - INTERVAL 25 MINUTE, NOW(), 'lumen-x100-compact', 'cameras', 'sess-007', NULL, NULL),
('test-047','wishlist_add', NOW() - INTERVAL 18 MINUTE, NOW(), 'halo-one-wireless', 'audio', 'sess-008', NULL, NULL),
('test-048','wishlist_add', NOW() - INTERVAL 10 MINUTE, NOW(), 'drift-wireless-controller', 'gaming-carry', 'sess-013', NULL, NULL),
('test-049','wishlist_add', NOW() - INTERVAL 5 MINUTE, NOW(), 'halo-one-wireless', 'audio', 'sess-015', NULL, NULL),
('test-050','wishlist_add', NOW() - INTERVAL 1 MINUTE, NOW(), 'echo-pro-anc-earbuds', 'audio', 'sess-016', NULL, NULL);

-- Verify
SELECT COUNT(*) AS total_events FROM raw_events;
SELECT event_type, COUNT(*) AS count FROM raw_events GROUP BY event_type ORDER BY count DESC;
SELECT product_slug, COUNT(*) AS views FROM raw_events WHERE event_type = 'product_view' GROUP BY product_slug ORDER BY views DESC LIMIT 10;
