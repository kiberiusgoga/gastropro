import { 
  collection, 
  writeBatch,
  doc
} from 'firebase/firestore';
import { db } from '../firebase';

export const onboardingService = {
  generateDemoData: async (restaurantId: string) => {
    try {
      const batch = writeBatch(db);

      // 1. Categories
      const categories = [
        { name: 'Пијалоци', sortOrder: 1, restaurantId },
        { name: 'Бургери', sortOrder: 2, restaurantId },
        { name: 'Пици', sortOrder: 3, restaurantId },
        { name: 'Салати', sortOrder: 4, restaurantId },
        { name: 'Десерти', sortOrder: 5, restaurantId },
        { name: 'Кафе', sortOrder: 6, restaurantId }
      ];
      
      const categoryRefs = categories.map(() => doc(collection(db, 'menu_categories')));
      categories.forEach((cat, i) => batch.set(categoryRefs[i], cat));
      
      // 2. Menu Items
      const menuItems = [
        { name: 'Еспресо', price: 80, menuCategoryId: categoryRefs[5].id, active: true, preparationStation: 'bar', restaurantId },
        { name: 'Капучино', price: 100, menuCategoryId: categoryRefs[5].id, active: true, preparationStation: 'bar', restaurantId },
        { name: 'Класик Бургер', price: 250, menuCategoryId: categoryRefs[1].id, active: true, preparationStation: 'grill', restaurantId },
        { name: 'Чизбургер', price: 280, menuCategoryId: categoryRefs[1].id, active: true, preparationStation: 'grill', restaurantId },
        { name: 'Маргарита Пица', price: 320, menuCategoryId: categoryRefs[2].id, active: true, preparationStation: 'kitchen', restaurantId },
        { name: 'Капричиоза', price: 380, menuCategoryId: categoryRefs[2].id, active: true, preparationStation: 'kitchen', restaurantId },
        { name: 'Шопска Салата', price: 180, menuCategoryId: categoryRefs[3].id, active: true, preparationStation: 'salad', restaurantId },
        { name: 'Цезар Салата', price: 220, menuCategoryId: categoryRefs[3].id, active: true, preparationStation: 'salad', restaurantId },
        { name: 'Чоколадна Торта', price: 150, menuCategoryId: categoryRefs[4].id, active: true, preparationStation: 'dessert', restaurantId },
        { name: 'Сладолед', price: 120, menuCategoryId: categoryRefs[4].id, active: true, preparationStation: 'dessert', restaurantId },
        { name: 'Скопско Пиво', price: 140, menuCategoryId: categoryRefs[0].id, active: true, preparationStation: 'bar', restaurantId },
        { name: 'Кока Кола', price: 100, menuCategoryId: categoryRefs[0].id, active: true, preparationStation: 'bar', restaurantId }
      ];
      
      menuItems.forEach((item) => {
        const ref = doc(collection(db, 'menu_items'));
        batch.set(ref, item);
      });
      
      // 3. Tables
      const tables = [
        { number: 1, capacity: 2, status: 'free', zone: 'Внатре', restaurantId },
        { number: 2, capacity: 4, status: 'free', zone: 'Внатре', restaurantId },
        { number: 3, capacity: 6, status: 'free', zone: 'Тераса', restaurantId },
        { number: 4, capacity: 4, status: 'free', zone: 'Тераса', restaurantId },
        { number: 5, capacity: 2, status: 'free', zone: 'Шанк', restaurantId }
      ];
      
      tables.forEach((table) => {
        const ref = doc(collection(db, 'tables'));
        batch.set(ref, table);
      });
      
      // 4. Employees
      const employees = [
        { name: 'Марко Келнер', email: `marko_${restaurantId.slice(0,4)}@test.mk`, role: 'Waiter', active: true, createdAt: new Date().toISOString(), restaurantId },
        { name: 'Игор Готвач', email: `igor_${restaurantId.slice(0,4)}@test.mk`, role: 'Chef', active: true, createdAt: new Date().toISOString(), restaurantId },
        { name: 'Стефан Доставувач', email: `stefan_${restaurantId.slice(0,4)}@test.mk`, role: 'Driver', active: true, createdAt: new Date().toISOString(), restaurantId }
      ];
      
      employees.forEach((emp) => {
        const ref = doc(collection(db, 'users'));
        batch.set(ref, emp);
      });
      
      // 5. Products (Inventory)
      const products = [
        { name: 'Месо за Бургер', barcode: '101', unit: 'kg', purchasePrice: 300, sellingPrice: 0, categoryId: 'meat', currentStock: 50, minStock: 10, active: true, restaurantId },
        { name: 'Брашно', barcode: '102', unit: 'kg', purchasePrice: 40, sellingPrice: 0, categoryId: 'dry', currentStock: 100, minStock: 20, active: true, restaurantId },
        { name: 'Кафе во зрно', barcode: '103', unit: 'kg', purchasePrice: 800, sellingPrice: 0, categoryId: 'coffee', currentStock: 10, minStock: 2, active: true, restaurantId },
        { name: 'Пиво 0.5л', barcode: '104', unit: 'pcs', purchasePrice: 60, sellingPrice: 140, categoryId: 'drinks', currentStock: 200, minStock: 50, active: true, restaurantId }
      ];
      
      products.forEach((prod) => {
        const ref = doc(collection(db, 'products'));
        batch.set(ref, prod);
      });

      // 6. Printers
      const printers = [
        { name: 'Главна Кујна', type: 'kitchen', connectionType: 'browser', active: true, station: 'kitchen', restaurantId },
        { name: 'Шанк', type: 'bar', connectionType: 'browser', active: true, station: 'bar', restaurantId },
        { name: 'Сметка', type: 'receipt', connectionType: 'browser', active: true, restaurantId }
      ];

      printers.forEach((printer) => {
        const ref = doc(collection(db, 'printers'));
        batch.set(ref, printer);
      });
      
      await batch.commit();
      return true;
    } catch (error) {
      console.error('Error generating demo data:', error);
      return false;
    }
  },

  saveManualData: async (restaurantId: string, data: {
    tables: Record<string, unknown>[],
    categories: Record<string, unknown>[],
    menuItems: Record<string, unknown>[],
    employees: Record<string, unknown>[],
    printers: Record<string, unknown>[]
  }) => {
    try {
      const batch = writeBatch(db);

      // 1. Categories
      const categoryRefs: { [key: string]: string } = {};
      data.categories.forEach((cat) => {
        const catName = cat.name as string;
        const ref = doc(collection(db, 'menu_categories'));
        batch.set(ref, { ...cat, restaurantId, active: true });
        categoryRefs[catName] = ref.id;
      });

      // 2. Menu Items
      data.menuItems.forEach((item) => {
        const itemCategoryName = item.menuCategoryId as string;
        const ref = doc(collection(db, 'menu_items'));
        batch.set(ref, {
          ...item,
          menuCategoryId: categoryRefs[itemCategoryName] || '',
          restaurantId,
          active: true,
          available: true,
          createdAt: new Date().toISOString()
        });
      });

      // 3. Tables
      data.tables.forEach((table) => {
        const ref = doc(collection(db, 'tables'));
        batch.set(ref, {
          ...table,
          status: 'free',
          restaurantId,
          active: true
        });
      });

      // 4. Employees
      data.employees.forEach((emp) => {
        const ref = doc(collection(db, 'users'));
        batch.set(ref, {
          ...emp,
          restaurantId,
          active: true,
          createdAt: new Date().toISOString()
        });
      });

      // 5. Printers
      data.printers.forEach((printer) => {
        const ref = doc(collection(db, 'printers'));
        batch.set(ref, {
          ...printer,
          connectionType: 'browser',
          active: true,
          restaurantId
        });
      });

      await batch.commit();
      return true;
    } catch (error) {
      console.error('Error saving manual data:', error);
      return false;
    }
  }
};
