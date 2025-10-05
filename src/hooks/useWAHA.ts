// hooks/useWAHA.ts
import { useState, useEffect, useCallback } from 'react';
import WAHA_CONFIG from '@/config/waha';

interface WAHAConfig {
  apiEndpoint: string;
  sessionId: string;
}

interface WAHAStatus {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  message: string;
  qrCode?: string;
  sessionInfo?: {
    name: string;
    phone?: string;
    platform: string;
  };
}

interface WhatsAppTemplate {
  id: string;
  name: string;
  content: string;
  variables: string[];
  isActive: boolean;
}

interface WAHAStats {
  messagesSent: number;
  messagesReceived: number;
  lastActivity: string;
}

export function useWAHA() {
  const [config, setConfig] = useState<WAHAConfig>({
    apiEndpoint: WAHA_CONFIG.API_ENDPOINT,
    sessionId: WAHA_CONFIG.SESSION_ID
  });
  
  const [status, setStatus] = useState<WAHAStatus>({
    status: 'disconnected',
    message: 'Не подключено'
  });
  
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [stats, setStats] = useState<WAHAStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Проверка статуса сессии
  const checkSessionStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${config.apiEndpoint}/api/sessions/${config.sessionId}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'CONNECTED') {
          setStatus({
            status: 'connected',
            message: 'WhatsApp подключен',
            sessionInfo: {
              name: data.name || 'WhatsApp',
              phone: data.phone,
              platform: data.platform || 'web'
            }
          });
        } else if (data.status === 'STARTING') {
          setStatus({
            status: 'connecting',
            message: 'Подключение к WhatsApp...'
          });
        } else {
          setStatus({
            status: 'disconnected',
            message: 'WhatsApp не подключен'
          });
        }
      } else {
        setStatus({
          status: 'disconnected',
          message: 'Сессия не найдена'
        });
      }
    } catch (error) {
      setStatus({
        status: 'error',
        message: 'Ошибка подключения к WAHA серверу'
      });
    } finally {
      setIsLoading(false);
    }
  }, [config]);

  // Создание новой сессии
  const createSession = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${config.apiEndpoint}/api/sessions/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: config.sessionId,
          config: {
            webhooks: [
              {
                url: WAHA_CONFIG.WEBHOOK_URL,
                events: ['message', 'session.status']
              }
            ]
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        setStatus({
          status: 'connecting',
          message: 'Сессия создана, ожидание подключения...'
        });
        return data;
      } else {
        throw new Error('Ошибка создания сессии');
      }
    } catch (error) {
      setStatus({
        status: 'error',
        message: 'Ошибка создания сессии'
      });
    } finally {
      setIsLoading(false);
    }
  }, [config]);

  // Получение QR кода
  const getQRCode = useCallback(async () => {
    try {
      const response = await fetch(`${config.apiEndpoint}/api/sessions/${config.sessionId}/qr`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.qr) {
          setStatus(prev => ({
            ...prev,
            qrCode: data.qr,
            message: 'Отсканируйте QR-код в WhatsApp'
          }));
        }
      }
    } catch (error) {
      console.error('Ошибка получения QR кода:', error);
    }
  }, [config]);

  // Отправка тестового сообщения
  const sendTestMessage = useCallback(async (phone: string, message: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`${config.apiEndpoint}/api/sendText`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session: config.sessionId,
          to: phone,
          text: message
        })
      });

      if (response.ok) {
        return await response.json();
      } else {
        throw new Error('Ошибка отправки сообщения');
      }
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [config]);

  // Получение шаблонов сообщений
  const getTemplates = useCallback(async () => {
    try {
      const response = await fetch(`${config.apiEndpoint}/api/templates`);
      
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error('Ошибка получения шаблонов:', error);
    }
  }, [config]);

  // Создание нового шаблона
  const createTemplate = useCallback(async (template: Omit<WhatsAppTemplate, 'id'>) => {
    try {
      setIsLoading(true);
      const response = await fetch(`${config.apiEndpoint}/api/templates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(template)
      });

      if (response.ok) {
        await getTemplates(); // Обновляем список шаблонов
        return await response.json();
      } else {
        throw new Error('Ошибка создания шаблона');
      }
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [config, getTemplates]);

  // Обновление шаблона
  const updateTemplate = useCallback(async (id: string, template: Partial<WhatsAppTemplate>) => {
    try {
      setIsLoading(true);
      const response = await fetch(`${config.apiEndpoint}/api/templates/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(template)
      });

      if (response.ok) {
        await getTemplates(); // Обновляем список шаблонов
        return await response.json();
      } else {
        throw new Error('Ошибка обновления шаблона');
      }
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [config, getTemplates]);

  // Удаление шаблона
  const deleteTemplate = useCallback(async (id: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`${config.apiEndpoint}/api/templates/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await getTemplates(); // Обновляем список шаблонов
        return true;
      } else {
        throw new Error('Ошибка удаления шаблона');
      }
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [config, getTemplates]);

  // Получение статистики
  const getStats = useCallback(async () => {
    try {
      const response = await fetch(`${config.apiEndpoint}/api/stats`);
      
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Ошибка получения статистики:', error);
    }
  }, [config]);

  // Автоматическая проверка статуса
  useEffect(() => {
    checkSessionStatus();
    getTemplates();
    getStats();

    const interval = setInterval(() => {
      checkSessionStatus();
      getStats();
    }, 10000); // Проверяем каждые 10 секунд

    return () => clearInterval(interval);
  }, [checkSessionStatus, getTemplates, getStats]);

  return {
    config,
    setConfig,
    status,
    templates,
    stats,
    isLoading,
    checkSessionStatus,
    createSession,
    getQRCode,
    sendTestMessage,
    getTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    getStats
  };
}
