export interface ShopifyStoreConfig {
  id?: string;
  storeUrl: string;
  storeName: string;
  apiKey: string;
  apiSecret: string;
  pullOrdersFrom: Date;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ShopifyOrder {
  id: string;
  orderNumber: string;
  email: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  totalPrice: string;
  currencyCode: string;
  financialStatus: string;
  fulfillmentStatus: string | null;
  customerEmail: string;
  customerName?: string;
  lineItems: ShopifyLineItem[];
}

export interface ShopifyLineItem {
  id: string;
  title: string;
  quantity: number;
  price: string;
  sku: string | null;
  variantId: string | null;
  productId: string | null;
}