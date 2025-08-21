import env from '@/configs/env';
import mongoose from 'mongoose';
import { MongoClient } from 'mongodb';

const DB_URL = env.MONGO_URI!;

const client = new MongoClient(DB_URL);
export const db = client.db();

export default function connectDB() {
  return new Promise((resolve, reject) => {
    mongoose.set('strictQuery', false);
    mongoose
      .connect(DB_URL)
      .then(() => {
        resolve('Successfully connected to database');
      })
      .catch((error) => {
        reject(error);
      });
  });
}
