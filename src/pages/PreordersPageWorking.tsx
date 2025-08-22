import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus, Clock, CheckSquare, Package } from "lucide-react";
import PreorderForm from "@/components/preorders/PreorderForm";

interface PreorderItem {
  id: string;
  article: string;
  name: string;
  brand: string;
  price: number;
  warehouses: number[];
  deliveryDays: number;
  status: "processing" | "added";
  createdAt: Date;
}

// Mock данные
const mockPreorders: PreorderItem[] = [
  {
    id: "1",
    article: "PHONE123",
    name: "iPhone 15 Pro Max 256GB",
    brand: "Apple",
    price: 749000,
    warehouses: [1, 3],
    deliveryDays: 7,
    status: "processing",
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
  },
  {
    id: "2",
    article: "LAPTOP456",
    name: "MacBook Air M2",
    brand: "Apple",
    price: 899000,
    warehouses: [2],
    deliveryDays: 14,
    status: "added",
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000)
  },
  {
    id: "3",
    article: "WATCH789",
    name: "Apple Watch Series 9",
    brand: "Apple",
    price: 299000,
    warehouses: [1, 2, 3],
    deliveryDays: 5,
    status: "added",
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  }
];

const PreordersPageWorking = () => {
  const [preorders, setPreorders] = useState<PreorderItem[]>(mockPreorders);
  const [showForm, setShowForm] = useState(false);

  const handleAddPreorder = (products: any[]) => {
    const newPreorders = products.map((product, index) => ({
      id: `${Date.now()}-${index}`,
      article: product.article,
      name: product.name,
      brand: product.brand,
      price: product.price,
      warehouses: product.warehouses || [1],
      deliveryDays: product.deliveryDays || 7,
      status: "processing" as const,
      createdAt: new Date()
    }));
    
    setPreorders(prev => [...newPreorders, ...prev]);
    setShowForm(false);
  };

  // Статистика
  const totalPreorders = preorders.length;
  const processingCount = preorders.filter(p => p.status === "processing").length;
  const addedCount = preorders.filter(p => p.status === "added").length;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ru-KZ').format(price) + ' ₸';
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case "added": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200";
      case "processing": return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-200";
    }
  };

  const getStatusText = (status: string) => {
    switch(status) {
      case "added": return "Добавлено";
      case "processing": return "В обработке";
      default: return status;
    }
  };





  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4 md:space-y-6">
      <PreorderForm 
        isOpen={showForm} 
        onClose={() => setShowForm(false)} 
        onSubmit={handleAddPreorder}
      />

      {/* Заголовок */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 md:h-8 md:w-8 text-gray-800 dark:text-gray-200" />
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
              Предзаказы
            </h1>
            <p className="text-sm md:text-base text-gray-800 dark:text-gray-200">
              Управление предзаказами товаров
            </p>
          </div>
        </div>
        <Button 
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 w-full sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Добавить предзаказ</span>
          <span className="sm:hidden">Добавить</span>
        </Button>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="p-3 md:p-4">
          <div className="flex flex-col space-y-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 md:h-5 md:w-5 text-blue-500" />
              <p className="text-xs md:text-sm font-medium text-gray-900 dark:text-gray-100">Всего</p>
            </div>
            <div className="text-lg md:text-2xl font-bold">
              {totalPreorders}
            </div>
          </div>
        </Card>

        <Card className="p-3 md:p-4">
          <div className="flex flex-col space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 md:h-5 md:w-5 text-orange-500" />
              <p className="text-xs md:text-sm font-medium text-gray-900 dark:text-gray-100">В обработке</p>
            </div>
            <div className="text-lg md:text-2xl font-bold text-orange-600">
              {processingCount}
            </div>
          </div>
        </Card>

        <Card className="p-3 md:p-4">
          <div className="flex flex-col space-y-2">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4 md:h-5 md:w-5 text-green-500" />
              <p className="text-xs md:text-sm font-medium text-gray-900 dark:text-gray-100">Выполнено</p>
            </div>
            <div className="text-lg md:text-2xl font-bold text-green-600">
              {addedCount}
            </div>
          </div>
        </Card>
      </div>



      {/* Список предзаказов */}
      <Card>
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-lg md:text-xl">Список предзаказов</CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0">
          <div className="space-y-4">
            {preorders.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Нет предзаказов
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Добавьте первый предзаказ товара
                </p>
              </div>
            ) : (
              preorders.map((preorder) => (
                <div key={preorder.id} className="border rounded-lg p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                      <Package className="h-6 w-6 text-gray-700 dark:text-gray-300" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-medium text-gray-900 dark:text-white">{preorder.name}</h3>
                        <Badge variant="outline">{preorder.brand}</Badge>
                        <Badge className={getStatusColor(preorder.status)}>
                          {getStatusText(preorder.status)}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-900 dark:text-gray-100">
                        SKU: {preorder.article} • Цена: {formatPrice(preorder.price)} • Срок: {preorder.deliveryDays} дней • Склады: {preorder.warehouses.join(', ')}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PreordersPageWorking;
