-- Create wallet table for each store
CREATE TABLE IF NOT EXISTS store_wallets (
  id SERIAL PRIMARY KEY,
  store_url VARCHAR(255) NOT NULL UNIQUE,
  balance DECIMAL(10,2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create wallet transactions table for logging all wallet activities
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id SERIAL PRIMARY KEY,
  store_url VARCHAR(255) NOT NULL,
  order_id VARCHAR(255),
  order_number VARCHAR(255),
  transaction_type VARCHAR(50) NOT NULL, -- 'margin_earned', 'rto_penalty', 'withdrawal', 'refund'
  amount DECIMAL(10,2) NOT NULL,
  balance_before DECIMAL(10,2) NOT NULL,
  balance_after DECIMAL(10,2) NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(100) DEFAULT 'system'
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_store_wallets_store_url ON store_wallets(store_url);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_store_url ON wallet_transactions(store_url);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_order_id ON wallet_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON wallet_transactions(created_at);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_store_wallets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_store_wallets_updated_at
    BEFORE UPDATE ON store_wallets
    FOR EACH ROW
    EXECUTE FUNCTION update_store_wallets_updated_at();
