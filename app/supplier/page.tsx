"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { Package, Upload, Plus, Image as ImageIcon } from "lucide-react"
import { ProductService } from "@/lib/product-service"
import { CreateProductData } from "@/lib/types/product"
import { supabase } from "@/lib/supabase"

export default function ListProductPage() {
  const [formData, setFormData] = useState<CreateProductData>({
    title: "",
    description: "",
    price: 0,
    images: []
  })
  const [priceInput, setPriceInput] = useState("") // Separate state for price input
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const { toast } = useToast()

  // Test function to check Supabase storage configuration
  const testStorageConnection = async () => {
    try {
      console.log('Testing Supabase storage connection...')
      
      // Check if we can list buckets
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()
      console.log('Available buckets:', buckets)
      console.log('Buckets error:', bucketsError)
      
      // Check if product-images bucket exists
      const { data: files, error: filesError } = await supabase.storage
        .from('product-images')
        .list('', { limit: 1 })
      console.log('Files in product-images bucket:', files)
      console.log('Files error:', filesError)
      
      if (filesError) {
        toast({
          title: "Storage Configuration Issue",
          description: "Please check your Supabase storage setup. See console for details.",
          variant: "destructive",
        })
      } else {
        toast({
          title: "Storage Connection OK",
          description: "Supabase storage is properly configured.",
        })
      }
    } catch (error) {
      console.error('Storage test error:', error)
      toast({
        title: "Storage Test Failed",
        description: "Error testing storage connection. See console for details.",
        variant: "destructive",
      })
    }
  }



  // Alternative upload method
  const handleAlternativeUpload = () => {
    console.log('Alternative upload method triggered')
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = 'image/*'
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement
      if (target.files) {
        handleImageUpload({ target } as React.ChangeEvent<HTMLInputElement>)
      }
    }
    input.click()
  }

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      console.log('Files dropped:', files.length)
      // Process files directly without creating fake event
      processFiles(files)
    }
  }

  // Process files function
  const processFiles = async (files: File[]) => {
    setUploading(true)
    const uploadedUrls: string[] = []

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        console.log('Processing file:', file.name, 'Size:', file.size)
        
        // Validate file size (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
          toast({
            title: "File Too Large",
            description: `${file.name} is too large. Maximum size is 10MB.`,
            variant: "destructive",
          })
          continue
        }

        // Validate file type
        if (!file.type.startsWith('image/')) {
          toast({
            title: "Invalid File Type",
            description: `${file.name} is not an image file.`,
            variant: "destructive",
          })
          continue
        }

        const url = await ProductService.uploadImage(file)
        if (url) {
          uploadedUrls.push(url)
          console.log('Successfully uploaded:', file.name, 'URL:', url)
        } else {
          console.error('Failed to upload:', file.name)
          toast({
            title: "Upload Failed",
            description: `Failed to upload ${file.name}. Please try again.`,
            variant: "destructive",
          })
        }
      }

      if (uploadedUrls.length > 0) {
        setFormData(prev => ({
          ...prev,
          images: [...(prev.images || []), ...uploadedUrls]
        }))

        toast({
          title: "Images Uploaded Successfully!",
          description: `Successfully uploaded ${uploadedUrls.length} image(s)`,
        })
      }
    } catch (error) {
      console.error('Error uploading images:', error)
      toast({
        title: "Upload Failed",
        description: "Failed to upload images. Please try again.",
        variant: "destructive",
      })
    } finally {
      setUploading(false)
    }
  }

  const handleInputChange = (field: keyof CreateProductData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handlePriceChange = (value: string) => {
    setPriceInput(value) // Update the input display
    const numValue = parseFloat(value) || 0
    handleInputChange('price', numValue) // Update the form data
  }

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) {
      console.log('No files selected')
      return
    }

    console.log('Files selected:', files.length)
    const fileArray = Array.from(files)
    await processFiles(fileArray)
    
    // Reset the file input so the same file can be selected again
    event.target.value = ''
  }

  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images?.filter((_, i) => i !== index) || []
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title || !formData.description || formData.price <= 0) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields with valid values.",
        variant: "destructive",
      })
      return
    }

    setLoading(true)

    try {
      console.log('Creating product with data:', formData)
      
      // Get supplier name from localStorage for backwards compatibility
      const supplierName = localStorage.getItem('supplierName')
      console.log('Supplier name from localStorage:', supplierName)
      
      // Build URL with supplier name parameter for backwards compatibility
      let url = '/api/products/supplier'
      const params = new URLSearchParams()
      
      if (supplierName) {
        params.append('supplierName', supplierName)
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`
      }
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      })
      
      const data = await response.json()

      if (response.ok && data.product) {
        toast({
          title: "Product Created Successfully!",
          description: "Your product has been added to the marketplace.",
        })

        // Reset form
        setFormData({
          title: "",
          description: "",
          price: 0,
          images: []
        })
        setPriceInput("") // Reset price input display
      } else {
        throw new Error(data.error || "Failed to create product")
      }
    } catch (error) {
      console.error('Error creating product:', error)
      toast({
        title: "Creation Failed",
        description: "Failed to create product. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">List New Product</h1>
          <p className="text-gray-600 dark:text-gray-400">Submit your product for approval</p>
        </div>

      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Product Information
          </CardTitle>
          <CardDescription>
            Fill in the details below to submit your product for approval
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="title">Product Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="Enter product title"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="price">Price (₹) *</Label>
                <Input
                  id="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={priceInput}
                  onChange={(e) => handlePriceChange(e.target.value)}
                  placeholder="Enter price"
                  required
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Describe your product..."
                rows={4}
                required
              />
            </div>

            {/* Image Upload */}
            <div className="space-y-4">
              <Label>Product Images</Label>
              
              {/* Upload Area */}
              <div 
                className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <ImageIcon className="mx-auto h-12 w-12 text-gray-400" />
                <div className="mt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    disabled={uploading}
                    className="hover:bg-blue-50 dark:hover:bg-blue-900/20"
                    onClick={handleAlternativeUpload}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {uploading ? "Uploading..." : "Choose Images"}
                  </Button>
                  <input
                    id="image-upload"
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={uploading}
                    style={{ display: 'none' }}
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    Click to select images • PNG, JPG, GIF up to 10MB each
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    You can select multiple images at once • Drag & drop also supported
                  </p>
                </div>
              </div>

              {/* Image Preview */}
              {formData.images && formData.images.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Uploaded Images ({formData.images.length})</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {formData.images.map((url, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={url}
                          alt={`Product image ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                          title="Remove image"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="flex justify-end">
              <Button type="submit" disabled={loading} className="min-w-[120px]">
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Submitting...
                  </>
                ) : (
                  <>
                    <Package className="mr-2 h-4 w-4" />
                    Submit Product
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <div className="h-6 w-6 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">i</span>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Product Submission Process
              </h3>
              <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                Your product will be reviewed by our team. Once approved, it will be available 
                for sellers to add to their stores. You'll be notified of the approval status.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 