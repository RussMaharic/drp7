-- Add margins for existing confirmed orders to order_margins table
INSERT INTO order_margins (shopify_order_id, order_number, store_url, margin_amount, product_details) VALUES
('1004', '1004', 'teast32123.myshopify.com', 1000.00, '{"note": "Manually added for existing order", "original_margin": 1000}'),
('1005', '1005', 'teast32123.myshopify.com', 115.00, '{"note": "Manually added for existing order", "original_margin": 115}'),
('1006', '1006', 'teast32123.myshopify.com', 8.00, '{"note": "Manually added for existing order", "original_margin": 8}'),
('1007', '1007', 'teast32123.myshopify.com', 0.00, '{"note": "Manually added for existing order - needs correct margin", "original_margin": 0}'),
('1008', '1008', 'teast32123.myshopify.com', 0.00, '{"note": "Manually added for existing order - needs correct margin", "original_margin": 0}')
ON CONFLICT (shopify_order_id, store_url) 
DO UPDATE SET 
    margin_amount = EXCLUDED.margin_amount,
    product_details = EXCLUDED.product_details;
