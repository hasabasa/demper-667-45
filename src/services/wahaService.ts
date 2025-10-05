// services/wahaService.ts
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

class WAHAService {
  private config: WAHAConfig;

  constructor(config: WAHAConfig) {
    this.config = config;
  }

  async checkSessionStatus(): Promise<WAHAStatus> {
    try {
      const response = await fetch(`${this.config.apiEndpoint}/api/sessions/${this.config.sessionId}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'CONNECTED') {
          return {
            status: 'connected',
            message: 'WhatsApp подключен',
            sessionInfo: {
              name: data.name || 'WhatsApp',
              phone: data.phone,
              platform: data.platform || 'web'
            }
          };
        } else if (data.status === 'STARTING') {
          return {
            status: 'connecting',
            message: 'Подключение к WhatsApp...'
          };
        } else {
          return {
            status: 'disconnected',
            message: 'WhatsApp не подключен'
          };
        }
      } else {
        return {
          status: 'disconnected',
          message: 'Сессия не найдена'
        };
      }
    } catch (error) {
      return {
        status: 'error',
        message: 'Ошибка подключения к WAHA серверу'
      };
    }
  }

  async createSession(): Promise<any> {
    const response = await fetch(`${this.config.apiEndpoint}/api/sessions/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
        body: JSON.stringify({
          name: this.config.sessionId,
          config: {
            webhooks: [
              {
                url: 'http://localhost:3000/webhook',
                events: ['message', 'session.status']
              }
            ]
          }
        })
    });

    if (!response.ok) {
      throw new Error('Ошибка создания сессии');
    }

    return await response.json();
  }

  async getQRCode(): Promise<string | null> {
    try {
      const response = await fetch(`${this.config.apiEndpoint}/api/sessions/${this.config.sessionId}/qr`);
      
      if (response.ok) {
        const data = await response.json();
        return data.qr || null;
      }
      return null;
    } catch (error) {
      console.error('Ошибка получения QR кода:', error);
      return null;
    }
  }

  async sendMessage(phone: string, message: string): Promise<any> {
    const response = await fetch(`${this.config.apiEndpoint}/api/sendText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session: this.config.sessionId,
        to: phone,
        text: message
      })
    });

    if (!response.ok) {
      throw new Error('Ошибка отправки сообщения');
    }

    return await response.json();
  }

  async getTemplates(): Promise<WhatsAppTemplate[]> {
    try {
      const response = await fetch(`${this.config.apiEndpoint}/api/templates`);
      
      if (response.ok) {
        const data = await response.json();
        return data.templates || [];
      }
      return [];
    } catch (error) {
      console.error('Ошибка получения шаблонов:', error);
      return [];
    }
  }

  async createTemplate(template: Omit<WhatsAppTemplate, 'id'>): Promise<WhatsAppTemplate> {
    const response = await fetch(`${this.config.apiEndpoint}/api/templates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(template)
    });

    if (!response.ok) {
      throw new Error('Ошибка создания шаблона');
    }

    return await response.json();
  }

  async updateTemplate(id: string, template: Partial<WhatsAppTemplate>): Promise<WhatsAppTemplate> {
    const response = await fetch(`${this.config.apiEndpoint}/api/templates/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(template)
    });

    if (!response.ok) {
      throw new Error('Ошибка обновления шаблона');
    }

    return await response.json();
  }

  async deleteTemplate(id: string): Promise<boolean> {
    const response = await fetch(`${this.config.apiEndpoint}/api/templates/${id}`, {
      method: 'DELETE'
    });

    return response.ok;
  }

  async getStats(): Promise<WAHAStats | null> {
    try {
      const response = await fetch(`${this.config.apiEndpoint}/api/stats`);
      
      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.error('Ошибка получения статистики:', error);
      return null;
    }
  }

  async sendTemplateMessage(phone: string, templateId: string, variables: Record<string, string>): Promise<any> {
    const response = await fetch(`${this.config.apiEndpoint}/api/sendTemplate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session: this.config.sessionId,
        to: phone,
        template: templateId,
        variables
      })
    });

    if (!response.ok) {
      throw new Error('Ошибка отправки шаблона');
    }

    return await response.json();
  }

  // Метод для отправки сообщения с подстановкой переменных
  processTemplate(template: WhatsAppTemplate, variables: Record<string, string>): string {
    let content = template.content;
    
    template.variables.forEach(variable => {
      const placeholder = `{${variable}}`;
      const value = variables[variable] || '';
      content = content.replace(new RegExp(placeholder, 'g'), value);
    });
    
    return content;
  }

  // Метод для извлечения переменных из шаблона
  extractVariables(content: string): string[] {
    const matches = content.match(/\{([^}]+)\}/g);
    return matches ? matches.map(match => match.slice(1, -1)) : [];
  }
}

export default WAHAService;
export type { WAHAConfig, WAHAStatus, WhatsAppTemplate, WAHAStats };
