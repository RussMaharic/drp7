const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function runMigration() {
  try {
    console.log('🚀 Starting migration for product margins and RTO rates...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '../migrations/add-product-margins-and-rto-rates.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration SQL loaded successfully');
    
    // Execute the migration
    const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL });
    
    if (error) {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    }
    
    console.log('✅ Migration completed successfully!');
    console.log('📋 Changes applied:');
    console.log('   - Added margin column to product_shopify_mappings table');
    console.log('   - Created seller_rto_rates table');
    console.log('   - Added indexes for performance');
    console.log('   - Added triggers for updated_at timestamps');
    
  } catch (error) {
    console.error('💥 Migration failed with error:', error);
    process.exit(1);
  }
}

// Run the migration
runMigration();

