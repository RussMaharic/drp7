'use client';

import { useState, useEffect } from 'react';

export default function TestOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Replace these with your actual values
      const shop = 'your-store.myshopify.com';
      const accessToken = 'your-access-token';

      const response = await fetch(
        `/api/shopify-direct-orders?shop=${shop}&accessToken=${accessToken}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch orders');
      }

      const data = await response.json();
      setOrders(data.orders);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Shopify Orders Test</h1>
      
      <button 
        onClick={fetchOrders}
        className="bg-blue-500 text-white px-4 py-2 rounded mb-4"
        disabled={loading}
      >
        {loading ? 'Loading...' : 'Fetch Orders'}
      </button>

      {error && (
        <div className="text-red-500 mb-4">
          Error: {error}
        </div>
      )}

      {orders.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border">
            <thead>
              <tr>
                <th className="border p-2">Order #</th>
                <th className="border p-2">Customer</th>
                <th className="border p-2">Status</th>
                <th className="border p-2">Amount</th>
                <th className="border p-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="border p-2">{order.name}</td>
                  <td className="border p-2">{order.customerName}</td>
                  <td className="border p-2">{order.status}</td>
                  <td className="border p-2">
                    {order.currency} {order.amount}
                  </td>
                  <td className="border p-2">
                    {new Date(order.date).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}