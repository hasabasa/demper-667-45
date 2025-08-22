import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Plus, Clock, CheckSquare } from "lucide-react";
import PreorderForm from "@/components/preorders/PreorderForm";
import PreorderList, { PreorderItem } from "@/components/preorders/PreorderList";
import { useStoreConnection } from "@/hooks/useStoreConnection";

import { cn } from "@/lib/utils";

// Mock data for demonstration
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
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
  },
  {
    id: "2",
    article: "LAPTOP456",
    name: "MacBook Air M2",
    brand: "Apple",
    price: 899000,
    warehouses: [2],
    deliveryDays: 14,
    status: "processing",
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
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
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 1 week ago
  }
];

const PreordersPage = () => {
  const { loading } = useStoreConnection();
  
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
      status: "added" as const,
      createdAt: new Date()
    }));
    
    setPreorders(prev => [...newPreorders, ...prev]);
    setShowForm(false);
  };

  const handleDeletePreorder = (id: string) => {
    setPreorders(prev => prev.filter(item => item.id !== id));
  };



  // Statistics
  const totalPreorders = preorders.length;
  const processingCount = preorders.filter(p => p.status === "processing").length;
  const addedCount = preorders.filter(p => p.status === "added").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Загрузка данных магазинов...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4 md:space-y-6">
      <PreorderForm 
        isOpen={showForm} 
        onClose={() => setShowForm(false)} 
        onSubmit={handleAddPreorder}
      />

      {/* Заголовок */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 text-center sm:text-left">
          <FileText className="h-6 w-6 md:h-8 md:w-8 text-gray-600 dark:text-gray-400 mx-auto sm:mx-0" />
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
              Заявки на товары
            </h1>
            <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">
              Добавление новых товаров в каталог
            </p>
          </div>
        </div>
        <Button 
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 w-full sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Добавить товар</span>
          <span className="sm:hidden">Добавить</span>
        </Button>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="p-3 md:p-4">
          <div className="flex flex-col space-y-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 md:h-5 md:w-5 text-blue-500" />
              <p className="text-xs md:text-sm font-medium text-gray-900 dark:text-white">Всего</p>
            </div>
            <div className="text-lg md:text-2xl font-bold text-foreground">
              {totalPreorders}
            </div>
          </div>
        </Card>



        <Card className="p-3 md:p-4">
          <div className="flex flex-col space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 md:h-5 md:w-5 text-orange-500" />
              <p className="text-xs md:text-sm font-medium text-gray-900 dark:text-white">В обработке</p>
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
              <p className="text-xs md:text-sm font-medium text-gray-900 dark:text-white">Добавлено</p>
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
          <CardTitle className="text-lg md:text-xl">Список заявок</CardTitle>
          <CardDescription className="text-sm md:text-base">
            Управление статусами заявок на товары
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0">
          <PreorderList 
            items={preorders}
            onResubmit={handleDeletePreorder}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default PreordersPage;
