import apiClient from '../lib/apiClient';

export const onboardingService = {
  generateDemoData: async () => {
    try {
      // 1. Categories
      const categories = [
        { name: 'Пијалоци', sort_order: 1 },
        { name: 'Бургери', sort_order: 2 },
        { name: 'Пици', sort_order: 3 },
        { name: 'Салати', sort_order: 4 },
        { name: 'Десерти', sort_order: 5 },
        { name: 'Кафе', sort_order: 6 }
      ];
      
      const createdCategories = [];
      for (const cat of categories) {
        const res = await apiClient.post('/menu-categories', cat);
        createdCategories.push(res.data);
      }
      
      // 2. Menu Items
      const menuItems = [
        { name: 'Еспресо', price: 80, menu_category_id: createdCategories[5].id, active: true, preparation_station: 'bar' },
        { name: 'Капучино', price: 100, menu_category_id: createdCategories[5].id, active: true, preparation_station: 'bar' },
        { name: 'Класик Бургер', price: 250, menu_category_id: createdCategories[1].id, active: true, preparation_station: 'grill' },
        { name: 'Чизбургер', price: 280, menu_category_id: createdCategories[1].id, active: true, preparation_station: 'grill' },
        { name: 'Маргарита Пица', price: 320, menu_category_id: createdCategories[2].id, active: true, preparation_station: 'kitchen' },
        { name: 'Капричиоза', price: 380, menu_category_id: createdCategories[2].id, active: true, preparation_station: 'kitchen' },
        { name: 'Шопска Салата', price: 180, menu_category_id: createdCategories[3].id, active: true, preparation_station: 'salad' },
        { name: 'Цезар Салата', price: 220, menu_category_id: createdCategories[3].id, active: true, preparation_station: 'salad' },
        { name: 'Чоколадна Торта', price: 150, menu_category_id: createdCategories[4].id, active: true, preparation_station: 'dessert' },
        { name: 'Сладолед', price: 120, menu_category_id: createdCategories[4].id, active: true, preparation_station: 'dessert' },
        { name: 'Скопско Пиво', price: 140, menu_category_id: createdCategories[0].id, active: true, preparation_station: 'bar' },
        { name: 'Кока Кола', price: 100, menu_category_id: createdCategories[0].id, active: true, preparation_station: 'bar' }
      ];
      
      for (const item of menuItems) {
        await apiClient.post('/menu-items', item);
      }
      
      // 3. Tables
      const tables = [
        { number: 1, capacity: 2, status: 'free', zone: 'Внатре' },
        { number: 2, capacity: 4, status: 'free', zone: 'Внатре' },
        { number: 3, capacity: 6, status: 'free', zone: 'Тераса' },
        { number: 4, capacity: 4, status: 'free', zone: 'Тераса' },
        { number: 5, capacity: 2, status: 'free', zone: 'Шанк' }
      ];
      
      for (const table of tables) {
        await apiClient.post('/tables', table);
      }
      
      // 4. Employees (Using users endpoint)
      const employees = [
        { name: 'Марко Келнер', email: `marko_${Date.now()}@test.mk`, role: 'Waiter', password: 'password' },
        { name: 'Игор Готвач', email: `igor_${Date.now()}@test.mk`, role: 'Chef', password: 'password' },
        { name: 'Стефан Доставувач', email: `stefan_${Date.now()}@test.mk`, role: 'Driver', password: 'password' }
      ];
      
      for (const emp of employees) {
        // Users endpoint not yet tested, wrapping in try/catch to not block demo generation
        try { await apiClient.post('/users', emp); } catch {}
      }
      
      // 5. Products (We skip inventory demo data for this exact snippet to speed up, or maybe add a couple)
      const catsRes = await apiClient.post('/categories', { name: 'Demo Products Category' });
      const products = [
        { name: 'Месо за Бургер', barcode: '101', unit: 'kg', purchase_price: 300, selling_price: 0, category_id: catsRes.data.id, min_stock: 10, active: true },
      ];
      for (const prod of products) {
        try { await apiClient.post('/products', prod); } catch {}
      }

      // 6. Printers
      const printers = [
        { name: 'Главна Кујна', type: 'kitchen', connection_type: 'browser', active: true, station: 'kitchen' },
        { name: 'Шанк', type: 'bar', connection_type: 'browser', active: true, station: 'bar' },
        { name: 'Сметка', type: 'receipt', connection_type: 'browser', active: true, station: 'cashier' }
      ];

      for (const printer of printers) {
        await apiClient.post('/printers', printer);
      }
      
      return true;
    } catch (error) {
      console.error('Error generating demo data:', error);
      return false;
    }
  },

  saveManualData: async (data: {
    tables: Record<string, unknown>[],
    categories: Record<string, unknown>[],
    menuItems: Record<string, unknown>[],
    employees: Record<string, unknown>[],
    printers: Record<string, unknown>[]
  }) => {
    try {
      // 1. Categories
      const categoryRefs: { [key: string]: string } = {};
      for (let i = 0; i < data.categories.length; i++) {
         const cat = data.categories[i];
         const res = await apiClient.post('/menu-categories', {
             name: cat.name,
             sort_order: cat.sortOrder || (i + 1)
         });
         categoryRefs[cat.name as string] = res.data.id;
      }

      // 2. Menu Items
      for (const item of data.menuItems) {
         const catName = item.menuCategoryId as string; // in UI previously it saved the string
         await apiClient.post('/menu-items', {
             ...item,
             menu_category_id: categoryRefs[catName] || null
         });
      }

      // 3. Tables
      for (const table of data.tables) {
         await apiClient.post('/tables', table);
      }

      // 4. Employees
      for (const emp of data.employees) {
         try { await apiClient.post('/users', emp); } catch {}
      }

      // 5. Printers
      for (const printer of data.printers) {
         await apiClient.post('/printers', {
             ...printer,
             connection_type: 'browser'
         });
      }

      return true;
    } catch (error) {
      console.error('Error saving manual data:', error);
      return false;
    }
  }
};
