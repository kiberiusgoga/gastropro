# Storehouse Management System - REST API Specification

This document outlines the REST API endpoints for the Storehouse Management System. All endpoints (except login) require a valid JWT token in the `Authorization` header.

**Base URL:** `/api`

---

## 🔐 Authentication

### POST `/auth/login`
Authenticates a user and returns access and refresh tokens.

**Request Body:**
```json
{
  "email": "admin@storehouse.mk",
  "password": "password123"
}
```
**Validation Rules:**
- `email`: Required, valid email format.
- `password`: Required.

**Response (200 OK):**
```json
{
  "accessToken": "eyJhbGci...",
  "refreshToken": "eyJhbGci...",
  "user": {
    "id": "uuid",
    "name": "Admin",
    "email": "admin@storehouse.mk",
    "role": "Admin"
  }
}
```

### POST `/auth/refresh`
Generates a new access token using a valid refresh token.

**Request Body:**
```json
{
  "refreshToken": "eyJhbGci..."
}
```

**Response (200 OK):**
```json
{
  "accessToken": "eyJhbGci..."
}
```

### POST `/users` (Register/Create User)
Creates a new user account. Restricted to `Admin` role.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepassword",
  "role": "worker",
  "active": true
}
```
**Validation Rules:**
- `name`: Required, min 2 chars.
- `email`: Required, unique, valid email format.
- `password`: Optional (defaults to `password123`).
- `role`: Required, one of `Admin`, `Manager`, `Warehouse Worker`.

**Response (201 Created):**
```json
{
  "id": "uuid",
  "name": "John Doe",
  "email": "john@example.com",
  "role": "worker",
  "active": true,
  "createdAt": "timestamp"
}
```

---

## 📦 Products

### GET `/products`
Returns a list of all products.

**Response (200 OK):**
```json
[
  {
    "id": "uuid",
    "name": "Product Name",
    "barcode": "123456",
    "unit": "kg",
    "purchase_price": 10.5,
    "selling_price": 15.0,
    "current_stock": 100,
    "min_stock": 10,
    "active": true
  }
]
```

### POST `/products`
Creates a new product. Restricted to `Admin` or `Manager`.

**Request Body:**
```json
{
  "name": "New Product",
  "barcode": "531...",
  "unit": "pcs",
  "purchase_price": 5.0,
  "selling_price": 8.0,
  "category_id": "uuid",
  "min_stock": 5
}
```
**Validation Rules:**
- `name`: Required.
- `barcode`: Optional, unique if provided.
- `unit`: Required, one of `kg`, `l`, `pcs`, `box`.
- `purchase_price`: Required, numeric >= 0.
- `selling_price`: Required, numeric >= 0.

**Response (201 Created):**
`{ "id": "uuid", ... }`

### PUT `/products/:id`
Updates an existing product.

**Request Body:**
Same as POST, plus optional `active` boolean.

### DELETE `/products/:id`
Deletes a product if it has no transaction history.

**Response (200 OK):**
`{ "message": "Product deleted successfully" }`

---

## 📉 Inventory

### GET `/transactions`
Returns the audit trail of all stock movements.

**Response (200 OK):**
```json
[
  {
    "id": "uuid",
    "product_name": "Milk",
    "type": "receipt",
    "quantity": 50,
    "previous_stock": 10,
    "new_stock": 60,
    "user_name": "Admin",
    "date": "timestamp"
  }
]
```

### POST `/inventory/input`
Manually increases stock for a product.

**Request Body:**
```json
{
  "product_id": "uuid",
  "quantity": 10,
  "note": "Found extra stock"
}
```
**Validation Rules:**
- `product_id`: Required, must exist.
- `quantity`: Required, numeric > 0.

### POST `/inventory/output`
Manually decreases stock for a product.

**Request Body:**
Same as input.
**Validation Rules:**
- `quantity`: Cannot exceed `current_stock` (no negative stock allowed).

---

## 🧾 Invoices

### GET `/invoices`
Returns a list of all purchase invoices.

### POST `/invoices`
Creates a new invoice and automatically increases product stock.

**Request Body:**
```json
{
  "invoice_number": "INV-001",
  "supplier_name": "Supplier LLC",
  "date": "2023-10-27",
  "items": [
    {
      "product_id": "uuid",
      "quantity": 100,
      "price": 5.5
    }
  ]
}
```
**Validation Rules:**
- `invoice_number`: Required, unique.
- `items`: Required, non-empty array.

---

## 📊 Reports

### GET `/reports/sales`
Returns sales performance by product (based on invoice items).

**Response (200 OK):**
```json
[
  {
    "product_name": "Milk",
    "total_quantity": 500,
    "total_revenue": 32500.0
  }
]
```

### GET `/reports/inventory`
Returns current inventory status and valuation.

**Response (200 OK):**
```json
[
  {
    "name": "Milk",
    "current_stock": 120,
    "min_stock": 20,
    "category_name": "Beverages",
    "stock_value": 5400.0
  }
]
```
