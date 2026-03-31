import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  mk: {
    translation: {
      "dashboard": "Контролна Табла",
      "warehouse": "Магацин",
      "manager": "Менаџер",
      "products": "Производи",
      "categories": "Категории",
      "invoices": "Фактури",
      "inventory": "Залиха",
      "transactions": "Трансакции",
      "bundles": "Нормативи",
      "inventory_check": "Попис",
      "employees": "Вработени",
      "reports": "Извештаи",
      "settings": "Подесувања",
      "logout": "Одјави се",
      "login": "Најава",
      "register": "Регистрација",
      "name": "Име",
      "email": "Е-пошта",
      "role": "Улога",
      "status": "Статус",
      "actions": "Акции",
      "add": "Додади",
      "edit": "Измени",
      "delete": "Избриши",
      "save": "Зачувај",
      "cancel": "Откажи",
      "barcode": "Баркод",
      "unit": "Единица",
      "purchase_price": "Набавна цена",
      "selling_price": "Продажна цена",
      "current_stock": "Тековна залиха",
      "min_stock": "Мин. залиха",
      "supplier": "Добавувач",
      "invoice_number": "Број на фактура",
      "date": "Датум",
      "total": "Вкупно",
      "quantity": "Количина",
      "price": "Цена",
      "note": "Забелешка",
      "type": "Тип",
      "receipt": "Прием",
      "input": "Внес",
      "output": "Расход",
      "storno": "Сторно",
      "low_stock_alert": "Ниска залиха!",
      "revenue": "Приход",
      "expenses": "Трошоци",
      "top_products": "Најпродавани производи",
      "stock_alerts": "Аларми за залиха",
      "audit_trail": "Дневник на промени",
      "welcome": "Добредојдовте",
      "no_data": "Нема податоци",
      "loading": "Се вчитува...",
      "error": "Грешка",
      "success": "Успешно",
      "confirm_delete": "Дали сте сигурни дека сакате да го избришете ова?",
      "search": "Пребарај...",
      "filter": "Филтрирај",
      "all": "Сите",
      "completed": "Завршено",
      "draft": "Нацрт"
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'mk',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
