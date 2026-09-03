CREATE TYPE currency_enum AS ENUM ('INR');
CREATE TYPE product_visual_key_enum AS ENUM (
  'headphones', 'earbuds', 'speaker', 'keyboard', 'mouse', 'watch',
  'camera', 'lens', 'drone', 'charger', 'cable', 'stand', 'lamp',
  'backpack', 'controller', 'mic', 'monitor', 'tracker'
);
CREATE TYPE order_status_enum AS ENUM (
  'processing', 'confirmed', 'shipped', 'out-for-delivery',
  'delivered', 'cancelled', 'returned'
);
CREATE TYPE payment_method_enum AS ENUM ('cod', 'card', 'upi');
CREATE TYPE payment_status_enum AS ENUM ('pending', 'paid', 'failed', 'refunded');
CREATE TYPE offer_status_enum AS ENUM ('draft', 'scheduled', 'active', 'expired');
CREATE TYPE onboarding_state_enum AS ENUM ('incomplete', 'address_optional', 'complete');
CREATE TYPE rate_limit_dimension_enum AS ENUM ('ip', 'email', 'user');
CREATE TYPE review_status_enum AS ENUM ('pending', 'approved', 'rejected');
