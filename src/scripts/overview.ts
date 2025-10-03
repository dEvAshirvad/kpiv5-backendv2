import connectDB from '@/configs/db/mongodb';
import { EntryModel } from '@/modules/entry/entry.model';

async function getOverview() {
  try {
    await connectDB();
    const entries = await EntryModel.find({
      month: 9,
      status: { $ne: 'generated' }, // filter out generated entries
    })
      .sort({ createdAt: 1 })
      .lean();
    console.log(entries.length);
  } catch (error) {
    console.error(error);
  }
}

getOverview();
