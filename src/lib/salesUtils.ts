
import { SalesData } from "@/types";
import { format, isAfter, isBefore, parseISO, startOfMonth, startOfWeek, startOfDay } from "date-fns";
import { ru } from "date-fns/locale";

// Format date for chart display
export const formatDateForChart = (dateString: string, timeFrame: string) => {
  const date = new Date(dateString);
  
  switch (timeFrame) {
    case "daily":
      return format(date, "d MMM", { locale: ru });
    case "weekly":
      return `${format(date, "d MMM", { locale: ru })}`;
    case "monthly":
      return format(date, "MMM yyyy", { locale: ru });
    default:
      return dateString;
  }
};

// Filter sales data by date range
export const filterDataByDateRange = (data: SalesData[], dateRange: { from?: Date; to?: Date }) => {
  if (!dateRange.from && !dateRange.to) return data;
  
  return data.filter(item => {
    const itemDate = new Date(item.date);
    
    if (dateRange.from && dateRange.to) {
      return isAfter(itemDate, dateRange.from) && isBefore(itemDate, dateRange.to);
    } else if (dateRange.from) {
      return isAfter(itemDate, dateRange.from);
    } else if (dateRange.to) {
      return isBefore(itemDate, dateRange.to);
    }
    
    return true;
  });
};

// Aggregate data by time frame (daily, weekly, monthly)
export const aggregateDataByTimeFrame = (data: SalesData[], timeFrame: string) => {
  if (!data.length) return [];
  
  const aggregated: Record<string, { date: string; count: number; amount: number }> = {};
  
  data.forEach(item => {
    const date = new Date(item.date);
    let key: string;
    
    switch (timeFrame) {
      case "weekly":
        key = format(startOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd");
        break;
      case "monthly":
        key = format(startOfMonth(date), "yyyy-MM");
        break;
      case "daily":
      default:
        key = format(startOfDay(date), "yyyy-MM-dd");
        break;
    }
    
    if (!aggregated[key]) {
      aggregated[key] = {
        date: key,
        count: 0,
        amount: 0
      };
    }
    
    aggregated[key].count += item.count;
    aggregated[key].amount += item.amount;
  });
  
  return Object.values(aggregated).sort((a, b) => a.date.localeCompare(b.date));
};

// Calculate total sales amount
export const calculateTotalSales = (data: SalesData[]) => {
  return data.reduce((sum, item) => sum + item.amount, 0);
};

// Calculate average order value
export const calculateAverageOrderValue = (data: SalesData[]) => {
  const totalAmount = data.reduce((sum, item) => sum + item.amount, 0);
  const totalCount = data.reduce((sum, item) => sum + item.count, 0);
  
  return totalCount > 0 ? Math.round(totalAmount / totalCount) : 0;
};

// Calculate total orders count
export const calculateTotalOrders = (data: SalesData[]) => {
  return data.reduce((sum, item) => sum + item.count, 0);
};

// --- Новые утилиты для работы с API и парсингом данных ---

// Функция для синхронизации товаров с API Kaspi
export const syncProductsFromKaspi = async (merchantId: string, apiKey: string) => {
  // Здесь будет логика запроса к API Kaspi через бэкенд на Supabase Edge Functions
  try {
    const response = await fetch(`https://your-supabase-url.supabase.co/functions/v1/kaspi-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ merchantId })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error syncing products:", error);
    throw error;
  }
};

// Функция для получения конкурентов товара
export const fetchCompetitors = async (productId: number, apiKey: string) => {
  // Здесь будет логика запроса к API для получения конкурентов через бэкенд
  try {
    const response = await fetch(`https://your-supabase-url.supabase.co/functions/v1/fetch-competitors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ productId })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error fetching competitors:", error);
    throw error;
  }
};

// Функция для обновления цены товара
export const updateProductPrice = async (productId: number, newPrice: number, apiKey: string) => {
  try {
    const response = await fetch(`https://your-supabase-url.supabase.co/functions/v1/update-price`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ productId, newPrice })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error updating product price:", error);
    throw error;
  }
};

// Функция для поиска ниш с помощью анализа популярных товаров
export const searchNiches = async (category: string, apiKey: string) => {
  try {
    const response = await fetch(`https://your-supabase-url.supabase.co/functions/v1/search-niches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ category })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error searching niches:", error);
    throw error;
  }
};

// Функция для расчета оптимальной цены с учетом стратегии бота
export const calculateOptimalPrice = (
  competitors: { price: number }[], 
  settings: { 
    strategy: string; 
    minProfit: number;
    maxProfit: number;
    step: number;
  },
  productCost: number
) => {
  if (competitors.length === 0) {
    // Если конкурентов нет, возвращаем максимально возможную прибыль
    return productCost + settings.maxProfit;
  }
  
  // Находим минимальную цену конкурента
  const minCompetitorPrice = Math.min(...competitors.map(c => c.price));
  
  let optimalPrice = 0;
  
  switch (settings.strategy) {
    case 'become-first':
      // Стать первым - установить цену на 1 шаг ниже минимального конкурента
      optimalPrice = minCompetitorPrice - settings.step;
      break;
    case 'equal-price':
      // Равная цена с минимальным конкурентом
      optimalPrice = minCompetitorPrice;
      break;
    default:
      optimalPrice = minCompetitorPrice - settings.step;
  }
  
  // Проверка минимальной прибыли
  const minAllowedPrice = productCost + settings.minProfit;
  if (optimalPrice < minAllowedPrice) {
    optimalPrice = minAllowedPrice;
  }
  
  // Проверка максимальной прибыли
  const maxAllowedPrice = productCost + settings.maxProfit;
  if (optimalPrice > maxAllowedPrice) {
    optimalPrice = maxAllowedPrice;
  }
  
  return Math.round(optimalPrice);
};

// Функция для запуска бота ценообразования для списка товаров
export const runPriceBot = async (productIds: number[], apiKey: string) => {
  try {
    const response = await fetch(`https://your-supabase-url.supabase.co/functions/v1/run-price-bot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ productIds })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error running price bot:", error);
    throw error;
  }
};
