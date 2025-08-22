import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const kaspiApi = {
  // Авторизация магазина Kaspi
  async authenticate(userId: string, email: string, password: string) {
    try {
      const response = await axios.post(`${API_URL}/api/kaspi/auth`, {
        user_id: userId,
        email,
        password,
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Ошибка авторизации');
    }
  },

  // Получение списка подключенных магазинов
  async getStores(userId: string) {
    try {
      const response = await axios.get(`${API_URL}/api/kaspi/stores`, {
        params: { user_id: userId },
      });
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.detail || 'Ошибка получения магазинов');
    }
  },  
};
