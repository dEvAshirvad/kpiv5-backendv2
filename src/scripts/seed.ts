import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import env from '../configs/env';

// Define the schemas for seeding
const userSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    emailVerified: Boolean,
    role: String,
    department: String,
    departmentRole: String,
  },
  {
    timestamps: true,
    collection: 'user',
  }
);

const accountSchema = new mongoose.Schema(
  {
    accountId: String,
    providerId: String,
    userId: mongoose.Schema.Types.ObjectId,
    password: String,
  },
  {
    timestamps: true,
    collection: 'account',
  }
);

const UserModel = mongoose.model('User', userSchema);
const AccountModel = mongoose.model('Account', accountSchema);

async function seedDatabase() {
  try {
    // Connect to MongoDB
    const mongoUri =
      env.MONGO_URI ||
      `mongodb://${env.MONGO_INITDB_ROOT_USERNAME}:${env.MONGO_INITDB_ROOT_PASSWORD}@${env.MONGO_HOST}:${env.MONGO_PORT}/${env.MONGO_INITDB_ROOT_DATABASE}`;
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Clear existing data
    await UserModel.deleteMany({});
    await AccountModel.deleteMany({});
    console.log('Cleared existing seed data');

    // Use the exact password hash from the original data
    const hashedPassword =
      '$2b$12$hlTHiN0JEUoDHsEDDid5huW1NMVxutYl3p/JlwXj7zlhEfzpYfQ6S';

    // Create user
    const user = new UserModel({
      _id: new mongoose.Types.ObjectId('68a20b5e5cf53b0769f8534a'),
      name: 'Collector Raipur',
      email: 'collector@raipur.com',
      emailVerified: false,
      role: 'admin',
      department: 'collector-office',
      departmentRole: 'collector',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await user.save();
    console.log('User seeded successfully');

    // Create account
    const account = new AccountModel({
      _id: new mongoose.Types.ObjectId('68a20b5e5cf53b0769f8534b'),
      accountId: '68a20b5e5cf53b0769f8534a',
      providerId: 'credential',
      userId: new mongoose.Types.ObjectId('68a20b5e5cf53b0769f8534a'),
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await account.save();
    console.log('Account seeded successfully');

    console.log('Database seeding completed successfully!');
    console.log('\nSeeded Data:');
    console.log('User:', {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      departmentRole: user.departmentRole,
    });
    console.log('Account:', {
      _id: account._id,
      accountId: account.accountId,
      providerId: account.providerId,
      userId: account.userId,
    });
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the seed function
seedDatabase();
