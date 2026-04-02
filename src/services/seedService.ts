import apiClient from '../lib/apiClient';

export const seedService = {
  seedAll: async () => {
    try {
      console.log('Starting seed process...');
      
      // 1. Menu Categories
      const categories = [
        { name: 'Пијалоци', sort_order: 1, active: true },
        { name: 'Бургери', sort_order: 2, active: true },
        { name: 'Пици', sort_order: 3, active: true },
        { name: 'Салати', sort_order: 4, active: true },
        { name: 'Десерти', sort_order: 5, active: true },
        { name: 'Кафе', sort_order: 6, active: true }
      ];
      
      const categoryIds: string[] = [];
      for (const cat of categories) {
        const res = await apiClient.post('/menu-categories', cat);
        categoryIds.push(res.data.id);
      }
      
      // 2. Menu Items
      const menuItems = [
        { name: 'Еспресо', price: 80, menu_category_id: categoryIds[5], active: true, preparation_station: 'bar' },
        { name: 'Капучино', price: 100, menu_category_id: categoryIds[5], active: true, preparation_station: 'bar' },
        { name: 'Класик Бургер', price: 250, menu_category_id: categoryIds[1], active: true, preparation_station: 'grill' },
        { name: 'Чизбургер', price: 280, menu_category_id: categoryIds[1], active: true, preparation_station: 'grill' },
        { name: 'Маргарита Пица', price: 320, menu_category_id: categoryIds[2], active: true, preparation_station: 'kitchen' },
        { name: 'Капричиоза', price: 380, menu_category_id: categoryIds[2], active: true, preparation_station: 'kitchen' },
        { name: 'Шопска Салата', price: 180, menu_category_id: categoryIds[3], active: true, preparation_station: 'salad' },
        { name: 'Цезар Салата', price: 220, menu_category_id: categoryIds[3], active: true, preparation_station: 'salad' },
        { name: 'Чоколадна Торта', price: 150, menu_category_id: categoryIds[4], active: true, preparation_station: 'dessert' },
        { name: 'Сладолед', price: 120, menu_category_id: categoryIds[4], active: true, preparation_station: 'dessert' },
        { name: 'Скопско Пиво', price: 140, menu_category_id: categoryIds[0], active: true, preparation_station: 'bar' },
        { name: 'Кока Кола', price: 100, menu_category_id: categoryIds[0], active: true, preparation_station: 'bar' }
      ];
      
      for (const item of menuItems) {
        await apiClient.post('/menu-items', item);
      }
      
      // 3. Tables
      const tables = [
        { number: '1', capacity: 2, status: 'free', zone: 'Внатре' },
        { number: '2', capacity: 4, status: 'free', zone: 'Внатре' },
        { number: '3', capacity: 6, status: 'free', zone: 'Тераса' },
        { number: '4', capacity: 4, status: 'free', zone: 'Тераса' },
        { number: '5', capacity: 2, status: 'free', zone: 'Шанк' }
      ];
      
      for (const table of tables) {
        await apiClient.post('/tables', table);
      }
      
      console.log('Seed process completed successfully!');
      return true;
    } catch (error) {
      console.error('Error seeding data:', error);
      return false;
    }
  }
};
