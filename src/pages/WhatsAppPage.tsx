
import WhatsAppAutoConnect from '@/components/whatsapp/WhatsAppAutoConnect';
// Убираем мобильный хук
// import { useMobileOptimizedSimple as useMobileOptimized } from "@/hooks/useMobileOptimizedSimple";
import { cn } from "@/lib/utils";

function WhatsAppPage() {
  // const mobile = useMobileOptimized();
  
  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4 md:space-y-6">
      <WhatsAppAutoConnect />
    </div>
  );
}

export default WhatsAppPage;
