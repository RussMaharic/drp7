'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface FormData {
  storeName: string;
  storeUrl: string;
  accessToken: string;
  adminApiKey: string;
  adminApiSecret: string;
}

export default function ConnectStore() {
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>({
    storeName: '',
    storeUrl: '',
    accessToken: '',
    adminApiKey: '',
    adminApiSecret: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Extract domain from full URL if provided
      let shopDomain = formData.storeUrl;
      if (shopDomain.includes('https://')) {
        shopDomain = new URL(shopDomain).hostname;
      }
      // Remove admin.shopify.com if present
      shopDomain = shopDomain.replace('admin.shopify.com', '').replace('/store/', '');
      // Add .myshopify.com if not present
      if (!shopDomain.includes('.myshopify.com')) {
        shopDomain = `${shopDomain}.myshopify.com`;
      }

      // Test the connection by fetching orders using access token first
      try {
        let response = await fetch(`/api/shopify-direct-orders?shop=${shopDomain}&accessToken=${formData.accessToken}&isConnectionTest=true`);
        let responseData = await response.json();
        
        // If access token fails, try admin API credentials
        if (!response.ok) {
          console.log('Access token failed, trying admin API credentials...', responseData);
          response = await fetch(`/api/shopify-direct-orders?shop=${shopDomain}&apiKey=${formData.adminApiKey}&apiSecret=${formData.adminApiSecret}&isConnectionTest=true`);
          responseData = await response.json();
        }

        if (!response.ok) {
          console.error('Store connection test failed:', responseData);
          throw new Error(responseData.error || 'Failed to connect to store');
        }
      } catch (err) {
        console.error('Error during connection test:', err);
        throw new Error('Failed to validate store credentials. Please check your access token or API credentials.');
      }

      // If connection test successful, save to database
      try {
        const saveResponse = await fetch('/api/stores/direct', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storeName: formData.storeName,
            storeUrl: shopDomain,
            accessToken: formData.accessToken,
            adminApiKey: formData.adminApiKey,
            adminApiSecret: formData.adminApiSecret
          })
        });

        const saveData = await saveResponse.json();
        
        if (!saveResponse.ok) {
          console.error('Failed to save store:', saveData);
          throw new Error(saveData.error || 'Failed to save store configuration');
        }

        console.log('Store saved successfully:', {
          storeName: formData.storeName,
          storeUrl: shopDomain,
          hasAccessToken: !!formData.accessToken,
          hasApiKey: !!formData.adminApiKey
        });
      } catch (err) {
        console.error('Error saving store:', err);
        throw new Error('Failed to save store. Please try again or contact support if the issue persists.');
      }

      // Clear localStorage and store minimal data for immediate use
      localStorage.removeItem('shopifyStore');
      localStorage.setItem('selectedShopifyStore', shopDomain);

      // If successful, redirect to stores page
      router.push('/dashboard/stores');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect store');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Connect your Shopify store
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="storeName" className="block text-sm font-medium text-gray-700">
                Store Name
              </label>
              <div className="mt-1">
                <input
                  id="storeName"
                  name="storeName"
                  type="text"
                  required
                  value={formData.storeName}
                  onChange={handleChange}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="My Store"
                />
              </div>
            </div>

            <div>
              <label htmlFor="storeUrl" className="block text-sm font-medium text-gray-700">
                Store URL
              </label>
              <div className="mt-1">
                <input
                  id="storeUrl"
                  name="storeUrl"
                  type="text"
                  required
                  value={formData.storeUrl}
                  onChange={handleChange}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="your-store.myshopify.com or full admin URL"
                />
              </div>
              <p className="mt-1 text-sm text-gray-500">
                You can enter your .myshopify.com domain or the full admin URL
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">Store Access Credentials</h3>
              
              <div>
                <label htmlFor="accessToken" className="block text-sm font-medium text-gray-700">
                  Access Token
                </label>
                <div className="mt-1">
                  <input
                    id="accessToken"
                    name="accessToken"
                    type="password"
                    value={formData.accessToken}
                    onChange={handleChange}
                    className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="shpat_xxxxx..."
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200">
                
                <div className="space-y-4">
                  <div>
                    <label htmlFor="adminApiKey" className="block text-sm font-medium text-gray-700">
                      Admin API Key
                    </label>
                    <div className="mt-1">
                      <input
                        id="adminApiKey"
                        name="adminApiKey"
                        type="text"
                        value={formData.adminApiKey}
                        onChange={handleChange}
                        className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="adminApiSecret" className="block text-sm font-medium text-gray-700">
                      Admin API Secret
                    </label>
                    <div className="mt-1">
                      <input
                        id="adminApiSecret"
                        name="adminApiSecret"
                        type="password"
                        value={formData.adminApiSecret}
                        onChange={handleChange}
                        className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading || (!formData.accessToken && (!formData.adminApiKey || !formData.adminApiSecret))}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
              >
                {loading ? 'Connecting...' : 'Connect Store'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}