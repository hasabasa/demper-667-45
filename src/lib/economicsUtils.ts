
export const calculateCommission = (
  category: string,
  paymentType: string,
  goldCommissions: {category: string, commission: string | number}[],
  redKreditCommissions: {category: string, commission: string | number}[],
  installmentCommissions: {category: string, commission: string | number}[]
): number => {
  // Проверка входных параметров
  if (!category || !paymentType) {
    return 12; // Default commission
  }
  
  let commission = 12; // Default commission

  switch (paymentType) {
    case "Gold":
      const goldItem = goldCommissions.find(item => 
        item?.category?.toLowerCase() === category?.toLowerCase()
      );
      if (goldItem) {
        if (typeof goldItem.commission === 'string' && goldItem.commission.includes('-')) {
          // Range like "12-15%", take average
          const [min, max] = goldItem.commission
            .replace('%', '')
            .split('-')
            .map(Number);
          commission = (min + max) / 2;
        } else {
          commission = Number(goldItem.commission.toString().replace('%', ''));
        }
      }
      break;
    
    case "Red":
    case "Kredit":
      const redKreditItem = redKreditCommissions.find(item => 
        item?.category?.toLowerCase() === category?.toLowerCase()
      );
      if (redKreditItem) {
        commission = Number(
          paymentType === "Red"
            ? redKreditItem.commission.toString().split('/')[0].replace('%', '')
            : redKreditItem.commission.toString().split('/')[1].replace('%', '')
        );
      }
      break;
    
    case "Installment":
      commission = 15; // Fixed 15% for installment
      break;
  }

  return commission;
};

export const calculateDeliveryCost = (
  sellingPrice: number,
  weight: number,
  deliveryScope: string
): number => {
  // If order amount is less than 5000 tenge, delivery is free
  if (sellingPrice < 5000) {
    return 0;
  }

  let deliveryCost = 0;

  if (weight <= 5) {
    deliveryCost = deliveryScope === "По городу" ? 799 : 1299;
  } else if (weight <= 15) {
    deliveryCost = deliveryScope === "По городу" ? 999 : 1699;
  } else if (weight <= 50) {
    deliveryCost = deliveryScope === "По городу" ? 2299 : 3599;
  } else {
    deliveryCost = deliveryScope === "По городу" ? 3999 : 6499;
  }

  return deliveryCost;
};
