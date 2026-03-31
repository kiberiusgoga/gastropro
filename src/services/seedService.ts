import { 
  collection, 
  addDoc
} from 'firebase/firestore';
import { db } from '../firebase';

export const seedService = {
  seedAll: async () => {
    try {
      console.log('Starting seed process...');
      
      // 1. Categories
      const categories = [
        { name: 'Пијалоци', sortOrder: 1 },
        { name: 'Бургери', sortOrder: 2 },
        { name: 'Пици', sortOrder: 3 },
        { name: 'Салати', sortOrder: 4 },
        { name: 'Десерти', sortOrder: 5 },
        { name: 'Кафе', sortOrder: 6 }
      ];
      
      const categoryIds: string[] = [];
      for (const cat of categories) {
        const docRef = await addDoc(collection(db, 'menu_categories'), cat);
        categoryIds.push(docRef.id);
      }
      
      // 2. Menu Items
      const menuItems = [
        { name: 'Еспресо', price: 80, menuCategoryId: categoryIds[5], active: true, preparationStation: 'bar' },
        { name: 'Капучино', price: 100, menuCategoryId: categoryIds[5], active: true, preparationStation: 'bar' },
        { name: 'Класик Бургер', price: 250, menuCategoryId: categoryIds[1], active: true, preparationStation: 'grill' },
        { name: 'Чизбургер', price: 280, menuCategoryId: categoryIds[1], active: true, preparationStation: 'grill' },
        { name: 'Маргарита Пица', price: 320, menuCategoryId: categoryIds[2], active: true, preparationStation: 'kitchen' },
        { name: 'Капричиоза', price: 380, menuCategoryId: categoryIds[2], active: true, preparationStation: 'kitchen' },
        { name: 'Шопска Салата', price: 180, menuCategoryId: categoryIds[3], active: true, preparationStation: 'salad' },
        { name: 'Цезар Салата', price: 220, menuCategoryId: categoryIds[3], active: true, preparationStation: 'salad' },
        { name: 'Чоколадна Торта', price: 150, menuCategoryId: categoryIds[4], active: true, preparationStation: 'dessert' },
        { name: 'Сладолед', price: 120, menuCategoryId: categoryIds[4], active: true, preparationStation: 'dessert' },
        { name: 'Скопско Пиво', price: 140, menuCategoryId: categoryIds[0], active: true, preparationStation: 'bar' },
        { name: 'Кока Кола', price: 100, menuCategoryId: categoryIds[0], active: true, preparationStation: 'bar' }
      ];
      
      for (const item of menuItems) {
        await addDoc(collection(db, 'menu_items'), item);
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
        await addDoc(collection(db, 'tables'), table);
      }
      
      // 4. Employees
      const employees = [
        { name: 'Марко Келнер', email: 'marko@test.mk', role: 'Waiter', active: true, createdAt: new Date().toISOString() },
        { name: 'Ана Менаџер', email: 'ana@test.mk', role: 'Manager', active: true, createdAt: new Date().toISOString() },
        { name: 'Игор Готвач', email: 'igor@test.mk', role: 'Chef', active: true, createdAt: new Date().toISOString() },
        { name: 'Стефан Доставувач', email: 'stefan@test.mk', role: 'Driver', active: true, createdAt: new Date().toISOString() }
      ];
      
      for (const emp of employees) {
        await addDoc(collection(db, 'employees'), emp);
      }
      
      // 5. Products (Inventory)
      const products = [
        { name: 'Месо за Бургер', barcode: '101', unit: 'kg', purchasePrice: 300, sellingPrice: 0, categoryId: 'meat', currentStock: 50, minStock: 10, active: true },
        { name: 'Брашно', barcode: '102', unit: 'kg', purchasePrice: 40, sellingPrice: 0, categoryId: 'dry', currentStock: 100, minStock: 20, active: true },
        { name: 'Кафе во зрно', barcode: '103', unit: 'kg', purchasePrice: 800, sellingPrice: 0, categoryId: 'coffee', currentStock: 10, minStock: 2, active: true },
        { name: 'Пиво 0.5л', barcode: '104', unit: 'pcs', purchasePrice: 60, sellingPrice: 140, categoryId: 'drinks', currentStock: 200, minStock: 50, active: true }
      ];
      
      for (const prod of products) {
        await addDoc(collection(db, 'products'), prod);
      }
      
      console.log('Seed process completed successfully!');
      return true;
    } catch (error) {
      console.error('Error seeding data:', error);
      return false;
    }
  }
};
