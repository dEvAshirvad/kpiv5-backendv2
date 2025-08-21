# Database Seed Scripts

This directory contains database seeding scripts for populating the database with initial data.

## Available Scripts

### User and Account Seeding

**File:** `seed.ts`

**Command:** `pnpm run seed`

**Description:** Seeds the database with a default admin user and account.

## Seeded Data

### User Collection

```json
{
  "_id": "68a20b5e5cf53b0769f8534a",
  "name": "Collector Raipur",
  "email": "collector@raipur.com",
  "emailVerified": false,
  "role": "admin",
  "department": "collector-office",
  "departmentRole": "collector",
  "createdAt": "2025-08-17T17:03:26.268Z",
  "updatedAt": "2025-08-17T17:03:26.268Z"
}
```

### Account Collection

```json
{
  "_id": "68a20b5e5cf53b0769f8534b",
  "accountId": "68a20b5e5cf53b0769f8534a",
  "providerId": "credential",
  "userId": "68a20b5e5cf53b0769f8534a",
  "password": "$2b$12$hlTHiN0JEUoDHsEDDid5huW1NMVxutYl3p/JlwXj7zlhEfzpYfQ6S",
  "createdAt": "2025-08-17T17:03:26.286Z",
  "updatedAt": "2025-08-17T17:03:26.286Z"
}
```

## Login Credentials

- **Email:** `collector@raipur.com`
- **Password:** `password123`

## Usage

1. **Run the seed script:**

   ```bash
   pnpm run seed
   ```

2. **Verify the data was created:**
   ```bash
   # Check MongoDB collections
   mongo
   use your_database_name
   db.user.find()
   db.account.find()
   ```

## Features

- ✅ **Automatic password hashing** using bcrypt
- ✅ **Clears existing seed data** before seeding
- ✅ **Proper MongoDB ObjectId handling**
- ✅ **Timestamp preservation** from original data
- ✅ **Error handling** with proper exit codes
- ✅ **Detailed logging** of the seeding process

## Environment Variables

The seed script uses the same environment variables as the main application:

- `MONGO_URI` - MongoDB connection string
- `MONGO_HOST` - MongoDB host (default: localhost)
- `MONGO_PORT` - MongoDB port (default: 27017)
- `MONGO_INITDB_ROOT_USERNAME` - MongoDB username (default: root)
- `MONGO_INITDB_ROOT_PASSWORD` - MongoDB password (default: root)
- `MONGO_INITDB_ROOT_DATABASE` - MongoDB database (default: admin)

## Adding New Seed Data

To add new seed data:

1. Create a new script file in this directory
2. Follow the same pattern as `seed.ts`
3. Add a new script command to `package.json`
4. Update this README with documentation

## Example: Adding Department Seed Data

```typescript
// src/scripts/seed-departments.ts
import mongoose from 'mongoose';
import env from '../configs/env';

const departmentSchema = new mongoose.Schema(
  {
    name: String,
    slug: String,
    description: String,
  },
  {
    timestamps: true,
    collection: 'departments',
  }
);

const DepartmentModel = mongoose.model('Department', departmentSchema);

async function seedDepartments() {
  try {
    await mongoose.connect(env.MONGO_URI);

    const departments = [
      {
        name: 'IT Department',
        slug: 'it',
        description: 'Information Technology',
      },
      { name: 'HR Department', slug: 'hr', description: 'Human Resources' },
    ];

    await DepartmentModel.insertMany(departments);
    console.log('Departments seeded successfully');
  } catch (error) {
    console.error('Error seeding departments:', error);
  } finally {
    await mongoose.disconnect();
  }
}

seedDepartments();
```

Then add to `package.json`:

```json
{
  "scripts": {
    "seed:departments": "ts-node -r tsconfig-paths/register src/scripts/seed-departments.ts"
  }
}
```
