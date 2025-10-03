import axios from 'axios';
import { EntryModel } from '../modules/entry/entry.model';
import { EntryService } from '../modules/entry/entry.services';
import connectDB from '../configs/db/mongodb';
import logger from '../configs/logger';

// WhatsApp API configuration
const WHATSAPP_API_URL = 'https://backend.api-wa.co/campaign/entit/api/v2';
const API_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4NmY3NDI5MmY3OTA4MGMwYmRhMDhiMCIsIm5hbWUiOiLgpJzgpL_gpLLgpL4g4KSq4KWN4KSw4KS24KS-4KS44KSoIOCksOCkvuCkr-CkquClgeCksCIsImFwcE5hbWUiOiJBaVNlbnN5IiwiY2xpZW50SWQiOiI2N2JkNmMyM2Y3YmU3ZDBlZmQxZGY0MGMiLCJhY3RpdmVQbGFuIjoiTk9ORSIsImlhdCI6MTc1MjEzNDY5N30.EKqsb4BX6SdxkmYADnp_5Vqqo2PDll9vGOavtFMTGOE';

interface WhatsAppAPIPayload {
  apiKey: string;
  campaignName: string;
  destination: string;
  userName: string;
  templateParams: string[];
  source: string;
  media: any;
  buttons: any[];
  carouselCards: any[];
  location: any;
  attributes: any;
  paramsFallbackValue: any;
}

// Function to format phone number to 91XXXXXXXXXX format
function formatPhoneNumber(phone: string): string | null {
  if (!phone) return null;

  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // If it's already 12 digits starting with 91, return as is
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits;
  }

  // If it's 10 digits, add 91 prefix
  if (digits.length === 10) {
    return `91${digits}`;
  }

  // If it's 11 digits and starts with 0, replace 0 with 91
  if (digits.length === 11 && digits.startsWith('0')) {
    return `91${digits.substring(1)}`;
  }

  // If it's 13 digits and starts with +91, remove + and return
  if (phone.startsWith('+91') && digits.length === 12) {
    return digits;
  }

  // If it's already in correct format, return as is
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits;
  }

  return null;
}

// Function to create KPI summary string
function createKPISummary(values: any[]): string {
  if (!values || values.length === 0) return 'No KPI data available';

  return values.map((kpi) => `${kpi.key} : ${kpi.score}`).join(' | ');
}

// Function to create top performers summary
function createTopPerformersSummary(departmentRanking: any[]): string {
  if (!departmentRanking || departmentRanking.length === 0)
    return 'No ranking data available';

  return departmentRanking
    .map((entry) => `Rank ${entry.rank} : ${entry.employee.name}`)
    .join(' | ');
}

// Function to determine performance category and create appropriate API call
function createWhatsAppAPICall(entryData: any): WhatsAppAPIPayload | null {
  const { employee, rankings, values, departmentRanking } = entryData;

  // Format phone number
  const formattedPhone = formatPhoneNumber(employee.contact?.phone);
  if (!formattedPhone) {
    logger.warn(`No valid phone number for employee: ${employee.name}`);
    return null;
  }

  // Calculate performance percentage
  const totalInDepartment = rankings.totalInDepartment;
  const userRank = rankings.departmentRank;
  const percentageRank = (userRank / totalInDepartment) * 100;

  // Create KPI summary
  const kpiSummary = createKPISummary(values);

  // Create top performers summary
  const topPerformers = createTopPerformersSummary(departmentRanking);

  // Determine performance category
  let campaignName: string;
  let templateParams: string[];

  if (percentageRank <= 5) {
    // Top 5% performers
    campaignName = 'Top_Perfomer_API';
    templateParams = [
      employee.name,
      entryData.percentageScore.toString(),
      userRank.toString(),
      kpiSummary,
    ];
  } else if (percentageRank >= 95) {
    // Bottom 5% performers
    campaignName = 'Bottom_Performer';
    templateParams = [
      employee.name,
      entryData.percentageScore.toString(),
      userRank.toString(),
      kpiSummary,
      topPerformers,
    ];
  } else {
    // Medium performers
    campaignName = 'Medium_Perfomer_API';
    templateParams = [
      employee.name,
      entryData.percentageScore.toString(),
      userRank.toString(),
      kpiSummary,
      topPerformers,
    ];
  }

  return {
    apiKey: API_KEY,
    campaignName,
    destination: formattedPhone,
    userName: 'जिला प्रशासन रायपुर',
    templateParams,
    source: 'new-landing-page form',
    media: {},
    buttons: [],
    carouselCards: [],
    location: {},
    attributes: {},
    paramsFallbackValue: {
      FirstName: 'user',
    },
  };
}

// Function to send WhatsApp API request
async function sendWhatsAppMessage(payload: WhatsAppAPIPayload): Promise<any> {
  try {
    const response = await axios.post(WHATSAPP_API_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return response.data;
  } catch (error) {
    logger.error('Error sending WhatsApp message:', error);
    throw error;
  }
}

// Main test function
async function testWhatsAppAPI(dryRun: boolean = false) {
  try {
    // Connect to database
    await connectDB();
    logger.info('Connected to database');

    // Get entries with status "generated" created after specific date
    const entries = await EntryModel.find({
      month: 9,
      status: { $ne: 'generated' }, // filter out generated entries
    })
      .sort({ createdAt: 1 })
      .lean();

    logger.info(`Found ${entries.length} entries with status "generated"`);

    const results = {
      totalEntries: entries.length,
      processedEntries: 0,
      skippedEntries: 0,
      successfulCalls: 0,
      failedCalls: 0,
      skippedDetails: [] as any[],
      successfulDetails: [] as any[],
      failedDetails: [] as any[],
    };

    // Process each entry
    for (const [index, entry] of entries.entries()) {
      try {
        logger.info(`Processing entry: ${entry._id}`);

        // Get single user report
        const reportResponse = await axios.get(
          `http://localhost:3001/api/v1/entries/single-user-report/${entry._id}`
        );

        const entryData = reportResponse.data;

        // Check if employee has phone number
        const phone = entryData.employee?.contact?.phone;
        if (!phone) {
          results.skippedEntries++;
          results.skippedDetails.push({
            entryId: entry._id,
            employeeName: entryData.employee?.name,
            reason: 'No phone number available',
          });
          logger.warn(
            `Skipping entry ${entry._id} - no phone number for ${entryData.employee?.name}`
          );
          continue;
        }

        // Format phone number
        const formattedPhone = formatPhoneNumber(phone);
        if (!formattedPhone) {
          results.skippedEntries++;
          results.skippedDetails.push({
            entryId: entry._id,
            employeeName: entryData.employee?.name,
            phone,
            reason: 'Invalid phone number format',
          });
          logger.warn(
            `Skipping entry ${entry._id} - invalid phone format: ${phone}`
          );
          continue;
        }

        // Create WhatsApp API payload
        const whatsappPayload = createWhatsAppAPICall(entryData);
        if (!whatsappPayload) {
          results.skippedEntries++;
          results.skippedDetails.push({
            entryId: entry._id,
            employeeName: entryData.employee?.name,
            phone: formattedPhone,
            reason: 'Failed to create WhatsApp payload',
          });
          logger.warn(
            `Skipping entry ${entry._id} - failed to create WhatsApp payload`
          );
          continue;
        }

        // Log the WhatsApp message details
        logger.info(
          `\n=== WHATSAPP MESSAGE FOR ${entryData.employee?.name} ===`
        );
        logger.info(`Phone: ${formattedPhone}`);
        logger.info(`Campaign: ${whatsappPayload.campaignName}`);
        logger.info(`Template Params:`);
        whatsappPayload.templateParams.forEach((param, index) => {
          logger.info(`  ${index + 1}. ${param}`);
        });
        logger.info(
          `Full Payload: ${JSON.stringify(whatsappPayload, null, 2)}`
        );
        logger.info(`=== END WHATSAPP MESSAGE ${index + 1} ===\n`);

        // Send WhatsApp message (if not dry run)
        let whatsappResponse;
        if (dryRun) {
          logger.info('🔍 DRY RUN MODE - Message not actually sent');
          whatsappResponse = {
            status: 'dry_run',
            message: 'Message would be sent in real mode',
          };
        } else {
          whatsappResponse = await sendWhatsAppMessage(whatsappPayload);
        }

        // Update entry status to 'generated' after successful WhatsApp message sending
        if (!dryRun) {
          try {
            await EntryService.updateEntryStatus(
              entry._id.toString(),
              'generated'
            );
            logger.info(`Updated entry ${entry._id} status to 'generated'`);
          } catch (statusUpdateError) {
            logger.error(
              `Failed to update entry ${entry._id} status:`,
              statusUpdateError
            );
            // Continue processing even if status update fails
          }
        }

        results.processedEntries++;
        results.successfulCalls++;
        results.successfulDetails.push({
          entryId: entry._id,
          employeeName: entryData.employee?.name,
          phone: formattedPhone,
          campaignName: whatsappPayload.campaignName,
          templateParams: whatsappPayload.templateParams,
          response: whatsappResponse,
        });

        logger.info(
          `Successfully sent WhatsApp message to ${entryData.employee?.name} (${formattedPhone})`
        );

        // Add delay between requests to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        results.processedEntries++;
        results.failedCalls++;
        results.failedDetails.push({
          entryId: entry._id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        logger.error(`Failed to process entry ${entry._id}:`, error);
      }
    }

    // Generate final report
    logger.info('=== WHATSAPP API TEST REPORT ===');
    logger.info(`Total Entries Found: ${results.totalEntries}`);
    logger.info(`Processed Entries: ${results.processedEntries}`);
    logger.info(`Skipped Entries: ${results.skippedEntries}`);
    logger.info(`Successful API Calls: ${results.successfulCalls}`);
    logger.info(`Failed API Calls: ${results.failedCalls}`);

    if (results.skippedDetails.length > 0) {
      logger.info('\n=== SKIPPED ENTRIES ===');
      results.skippedDetails.forEach((detail) => {
        logger.info(`Entry ID: ${detail.entryId}`);
        logger.info(`Employee: ${detail.employeeName}`);
        logger.info(`Phone: ${detail.phone || 'N/A'}`);
        logger.info(`Reason: ${detail.reason}`);
        logger.info('---');
      });
    }

    if (results.successfulDetails.length > 0) {
      logger.info('\n=== SUCCESSFUL API CALLS ===');
      results.successfulDetails.forEach((detail) => {
        logger.info(`Entry ID: ${detail.entryId}`);
        logger.info(`Employee: ${detail.employeeName}`);
        logger.info(`Phone: ${detail.phone}`);
        logger.info(`Campaign: ${detail.campaignName}`);
        logger.info(
          `Template Params: ${JSON.stringify(detail.templateParams)}`
        );
        logger.info('---');
      });
    }

    if (results.failedDetails.length > 0) {
      logger.info('\n=== FAILED API CALLS ===');
      results.failedDetails.forEach((detail) => {
        logger.info(`Entry ID: ${detail.entryId}`);
        logger.info(`Error: ${detail.error}`);
        logger.info('---');
      });
    }

    logger.info('=== TEST COMPLETED ===');
  } catch (error) {
    logger.error('Test failed:', error);
  } finally {
    process.exit(0);
  }
}

// Run the test
// Set dryRun to true to see messages without sending them
const dryRun = process.argv.includes('--dry-run');
testWhatsAppAPI(dryRun);
