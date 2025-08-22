import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// import SalesChart from "../components/sales/SalesChart";
// import SalesStats from "../components/sales/SalesStats";
// import DateRangePicker from "../components/sales/DateRangePicker";
import { mockSalesData } from "../data";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "../components/integration/useAuth";
import { useStoreContext } from "@/contexts/StoreContext";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Info, 
  Download, 
  FileSpreadsheet, 
  TrendingUp, 
  Calendar, 
  Filter,
  BarChart3,
  DollarSign,
  ShoppingCart,
  Package,
  RefreshCw,
  Eye,
  PieChart
} from "lucide-react";
import { useScreenSize } from "@/hooks/use-screen-size";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useStoreConnection } from "@/hooks/useStoreConnection";
import ConnectStoreButton from "../components/store/ConnectStoreButton";
import LoadingScreen from "@/components/ui/loading-screen";

const SalesPageStyled = () => {
  const { user, loading: authLoading } = useAuth();
  const { selectedStoreId, selectedStore, stores } = useStoreContext();
  const { isConnected, needsConnection, loading: storeLoading } = useStoreConnection();
  const { isMobile, isDesktop, isLargeDesktop, isExtraLargeDesktop } = useScreenSize();
  const [dateRange, setDateRange] = useState<{from?: Date; to?: Date}>({});
  const [timeFrame, setTimeFrame] = useState("daily");
  const [activeView, setActiveView] = useState("charts");

  const fetchSalesData = async () => {
    // If no authenticated user, return mock data (fallback)
    if (!user) {
      console.log('No user, returning mock sales data');
      return mockSalesData;
    }

    console.log('Fetching sales data for store:', selectedStoreId || 'all stores');
    
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (selectedStoreId && selectedStoreId !== 'all') {
        console.log('Filtering sales data for specific store:', selectedStoreId);
        return mockSalesData;
      } else {
        console.log('Fetching sales data for all user stores');
        return mockSalesData;
      }
    } catch (error) {
      console.error('Error in fetchSalesData:', error);
      return mockSalesData;
    }
  };

  const { 
    data: salesData = mockSalesData, 
    isLoading, 
    error,
    refetch 
  } = useQuery({
    queryKey: ['salesData', selectedStoreId, dateRange.from, dateRange.to, user?.id],
    queryFn: fetchSalesData,
    enabled: !authLoading && (!!user || true),
    staleTime: 5 * 60 * 1000,
    retry: 1
  });

  useEffect(() => {
    if (!authLoading && user) {
      console.log('Store changed, refetching sales data for:', selectedStoreId);
      refetch();
    }
  }, [selectedStoreId, refetch, authLoading, user]);

  // Show loading screen while authentication or stores are loading
  if (authLoading || storeLoading) {
    return <LoadingScreen text="Загрузка данных продаж..." />;
  }

  const handleExport = (format: "excel" | "csv") => {
    console.log(`Exporting data in ${format} format`);
    toast.success(`Данные экспортированы в ${format.toUpperCase()}`);
  };

  const getPageDescription = () => {
    if (dateRange.from && dateRange.to) {
      return `Аналитика продаж с ${dateRange.from.toLocaleDateString('ru')} по ${dateRange.to.toLocaleDateString('ru')}`;
    }
    return "Полная аналитика ваших продаж на Kaspi.kz";
  };

  // Вычисляем общие метрики
  const totalRevenue = salesData.reduce((sum, item) => sum + item.revenue, 0);
  const totalOrders = salesData.reduce((sum, item) => sum + item.orders, 0);
  const totalItemsSold = salesData.reduce((sum, item) => sum + item.items_sold, 0);
  const averageOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ru-KZ').format(price) + ' ₸';
  };

  // Компактное отображение для больших сумм
  const formatFullPrice = (price: number) => {
    return new Intl.NumberFormat('ru-KZ').format(price) + ' ₸';
  };

  // Функция для определения размера шрифта в зависимости от длины числа
  const getFontSizeClass = (price: number) => {
    const formatted = formatFullPrice(price);
    if (formatted.length > 15) {
      return "text-xs lg:text-sm";
    } else if (formatted.length > 12) {
      return "text-sm lg:text-base";
    } else if (formatted.length > 8) {
      return "text-base lg:text-lg";
    } else {
      return "text-lg lg:text-xl";
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6 animate-fade-in bg-background min-h-screen">
      {/* Заголовок */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Аналитика продаж</h1>
          <p className="text-muted-foreground text-lg">
            {getPageDescription()}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Обновление...' : 'Обновить'}
          </Button>
          
          {selectedStore && (
            <div className="text-sm text-muted-foreground">
              Магазин: <span className="font-medium">{selectedStore.name}</span>
            </div>
          )}
        </div>
      </div>

      {/* Информационное сообщение */}
      <Alert className="bg-primary/5 border-primary/20">
        <Info className="h-4 w-4 text-primary flex-shrink-0" />
        <AlertDescription className="text-primary text-xs md:text-sm">
          Аналитика обновляется каждые 30 минут. Последнее обновление: {new Date().toLocaleTimeString('ru')}
        </AlertDescription>
      </Alert>

      {/* Основные метрики */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Общая выручка */}
        <Card className="p-4">
          <div className="flex flex-col space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-gray-600 dark:text-gray-400">₸</span>
              <p className="font-medium text-gray-900 dark:text-white">Общая выручка</p>
            </div>
            <div className={`font-bold text-foreground ${getFontSizeClass(totalRevenue)}`}>
              {formatFullPrice(totalRevenue)}
            </div>
          </div>
        </Card>
        
        {/* Заказы */}
        <Card className="p-4">
          <div className="flex flex-col space-y-2">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              <p className="font-medium text-gray-900 dark:text-white">Заказов</p>
            </div>
            <div className="text-lg lg:text-xl font-bold text-foreground">
              {totalOrders}
            </div>
          </div>
        </Card>
        
        {/* Товары продано */}
        <Card className="p-4">
          <div className="flex flex-col space-y-2">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              <p className="font-medium text-gray-900 dark:text-white">Товаров продано</p>
            </div>
            <div className="text-lg lg:text-xl font-bold text-foreground">
              {totalItemsSold}
            </div>
          </div>
        </Card>
        
        {/* Средний чек */}
        <Card className="p-4">
          <div className="flex flex-col space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-gray-600 dark:text-gray-400">₸</span>
              <p className="font-medium text-gray-900 dark:text-white">Средний чек</p>
            </div>
            <div className={`font-bold text-foreground ${getFontSizeClass(averageOrderValue)}`}>
              {formatFullPrice(averageOrderValue)}
            </div>
          </div>
        </Card>
      </div>

      {/* Фильтры и экспорт */}
      <Card>
        <CardHeader>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-primary" />
              <CardTitle>Фильтры и настройки</CardTitle>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("csv")}
                className="flex items-center gap-2"
              >
                <FileSpreadsheet className="h-4 w-4" />
                CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("excel")}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Excel
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Период времени */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Период</label>
              <Select value={timeFrame} onValueChange={setTimeFrame}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">По дням</SelectItem>
                  <SelectItem value="weekly">По неделям</SelectItem>
                  <SelectItem value="monthly">По месяцам</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Магазин */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Магазин</label>
              <div className="text-sm">
                <Badge variant="secondary">
                  {selectedStore?.name || 'Все магазины'}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Табы для разных видов аналитики */}
      <Tabs value={activeView} onValueChange={setActiveView}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="charts" className="flex items-center gap-2">
            <PieChart className="h-4 w-4" />
            Графики
          </TabsTrigger>
          <TabsTrigger value="details" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Детали
          </TabsTrigger>
        </TabsList>



        <TabsContent value="charts" className="space-y-6">
          {/* График продаж */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Визуализация данных
              </CardTitle>
              <CardDescription>
                Графическое представление динамики продаж
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <TrendingUp className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Графики в разработке</h3>
                <p className="text-muted-foreground mb-4">
                  Здесь будут отображаться интерактивные графики продаж
                </p>
                <div className="text-sm text-muted-foreground">
                  • Линейные графики динамики<br/>
                  • Круговые диаграммы распределения<br/>
                  • Столбчатые графики сравнения
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details" className="space-y-6">
          {/* Детальная таблица */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Детальные данные
              </CardTitle>
              <CardDescription>
                Подробная информация по каждому дню
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium">Дата</th>
                      <th className="text-left p-3 font-medium">Заказы</th>
                      <th className="text-left p-3 font-medium">Выручка</th>
                      <th className="text-left p-3 font-medium">Товаров</th>
                      <th className="text-left p-3 font-medium">Средний чек</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesData.map((item, index) => (
                      <tr key={index} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="p-3 font-medium">
                          {new Date(item.date).toLocaleDateString('ru')}
                        </td>
                        <td className="p-3">
                          <Badge variant="secondary">{item.orders}</Badge>
                        </td>
                        <td className="p-3 font-medium text-foreground">
                          {formatPrice(item.revenue)}
                        </td>
                        <td className="p-3">{item.items_sold}</td>
                        <td className="p-3 text-foreground">
                          {formatPrice(Math.round(item.revenue / (item.orders || 1)))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>


    </div>
  );
};

export default SalesPageStyled;
