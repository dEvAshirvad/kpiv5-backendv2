// Change to project root directory to find .env file
import path from 'path';

// Go up from src/scripts to project root (2 levels up)
// __dirname is available in CommonJS (which this project uses)
const projectRoot = path.resolve(__dirname, '../../');
process.chdir(projectRoot);

import connectDB from '@/configs/db/mongodb';
import { Entry, EntryModel } from '@/modules/entry/entry.model';
import {
  KPITemplate,
  KPITemplateModel,
} from '@/modules/template/template.model';
import { Employee, EmployeeModal } from '@/modules/employee/employee.model';
import axios from 'axios';
import logger from '@/configs/logger';
import fs from 'fs';

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

// Utility function to delay execution
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Log file path
const LOG_FILE = 'overview.txt';

// Function to log to both console and file
function logToFile(message: string) {
  // Log to console
  console.log(message);
  // Append to file
  fs.appendFileSync(LOG_FILE, message + '\n');
}

// Function to log errors to both console and file
function errorToFile(message: string) {
  // Log to console
  console.error(message);
  // Append to file
  fs.appendFileSync(LOG_FILE, '[ERROR] ' + message + '\n');
}

// Initialize log file at the start
function initLogFile() {
  const timestamp = new Date().toISOString();
  fs.writeFileSync(
    LOG_FILE,
    `=== Overview Script Log - Started at ${timestamp} ===\n\n`
  );
}
function initLoggFile() {
  const timestamp = new Date().toISOString();
  fs.writeFileSync(
    LOG_FILE,
    `=== Overview Script Log - Started at ${timestamp} ===\n\n`
  );
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

async function createWhatsAppAPICall({
  campaignName,
  contact,
  employeeName,
  percentageScore,
  userRank,
  kpiSummary,
  topPerformers,
  entryId,
}: {
  campaignName: string;
  contact: string;
  employeeName: string;
  percentageScore: string;
  userRank: string;
  kpiSummary: string;
  topPerformers: string;
  entryId: string;
}) {
  try {
    let templateParams: string[] = [];

    if (campaignName === 'Top_Perfomer_API') {
      templateParams = [employeeName, percentageScore, userRank, kpiSummary];
    } else if (campaignName === 'Bottom_Performer') {
      templateParams = [
        employeeName,
        percentageScore,
        userRank,
        kpiSummary,
        topPerformers,
      ];
    } else if (campaignName === 'Medium_Perfomer_API') {
      templateParams = [
        employeeName,
        percentageScore.toString(),
        userRank.toString(),
        kpiSummary,
        topPerformers,
      ];
    }

    logToFile(`template : ${templateParams.join(', ')}`);

    const formattedPhone = formatPhoneNumber(contact);
    if (!formattedPhone) {
      throw new Error(`Invalid phone number format: ${contact}`);
    }

    const payload = {
      apiKey: API_KEY,
      campaignName,
      destination: formatPhoneNumber(contact) || '918249916506',
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

    const response = await sendWhatsAppMessage(payload);
    logToFile(
      `WhatsApp API call for campaign: ${campaignName} created successfully: ${response.message || response.success || 'Success'}`
    );
    logToFile(`Submitted Message ID: ${response.submitted_message_id}`);

    const updatedEntry = await EntryModel.findByIdAndUpdate(
      entryId,
      {
        status: 'generated',
      },
      { new: true }
    );
    logToFile(`Updated entry status to: ${updatedEntry?.status}`);

    return response;
  } catch (error) {
    logger.error(
      `Error creating WhatsApp API call for ${employeeName} (${contact}):`,
      error
    );
    throw error;
  }
}

async function getOverview() {
  try {
    // Initialize log file
    initLogFile();

    await connectDB();
    const entries = await EntryModel.find({
      month: 10,
      status: { $ne: 'generated' }, // filter out generated entries
    })
      .sort({ createdAt: 1 })
      .lean();
    logToFile(`Total entries: ${entries.length}`);

    // Create a overview analysis of the entries deparetment and role wise

    const listOfTemplates = [
      ...new Set(entries.map((entry) => entry.templateId)),
    ];

    const templates = await KPITemplateModel.find({
      _id: { $in: listOfTemplates },
    });

    for (const template of listOfTemplates) {
      const refTemplate = templates.find((t) => t._id.toString() === template);
      if (!refTemplate) {
        throw new Error(`Template not found: ${template}`);
      }
      const entriesForTemplate = entries.filter(
        (entry) => entry.templateId === template
      );
      const totalMaxScore = refTemplate.template.reduce(
        (total, kpi) => total + kpi.maxMarks,
        0
      );
      logToFile(`--------------------------------`);
      logToFile(
        `Template: ${refTemplate.name} (${refTemplate.departmentSlug}) ${totalMaxScore}`
      );
      logToFile(`Entries: ${entriesForTemplate.length}`);
      // Ranking the entries for the template
      logToFile(`Ranking the entries for the template`);
      // Sort the entries for the template by score descending

      entriesForTemplate.sort((a, b) => (b.score || 0) - (a.score || 0));
      const employeeMap = await EmployeeModal.find({
        _id: { $in: entriesForTemplate.map((entry) => entry.employeeId) },
      });
      const rankingOfEntries = entriesForTemplate.map((entry, index) => {
        const employee = employeeMap.find(
          (e) => e._id.toString() === entry.employeeId
        );
        logToFile(
          `Rank ${index + 1}: ${employee?.name} - ${entry.score?.toFixed(2)} / ${totalMaxScore.toFixed(2)} - ${employee?.contact?.phone}`
        );
      });
      logToFile(`--------------------------------`);
      // Determine top and bottom count based on total entries
      let topCount: number;
      let bottomCount: number;

      if (entriesForTemplate.length === 1) {
        // Only 1 entry: only top performer
        topCount = 1;
        bottomCount = 0;
        logToFile(`Top performer (only 1 entry)`);
      } else if (entriesForTemplate.length < 5) {
        // Less than 5 entries: top 1 and bottom 1
        topCount = 1;
        bottomCount = 1;
        logToFile(`Top 1 and Bottom 1 (less than 5 entries)`);
      } else if (entriesForTemplate.length < 10) {
        // Less than 10 entries: top 2 and bottom 2
        topCount = 2;
        bottomCount = 2;
        logToFile(`Top 2 and Bottom 2 (less than 10 entries)`);
      } else {
        // 10 or more entries: use 5% or minimum 5
        topCount = Math.max(5, Math.floor(entriesForTemplate.length * 0.05));
        bottomCount = Math.max(5, Math.floor(entriesForTemplate.length * 0.05));
        logToFile(
          `Top ${topCount} and Bottom ${bottomCount} (5% of entries or minimum 5)`
        );
      }
      logToFile(
        `Processing: Top ${topCount}, Bottom ${bottomCount} out of ${entriesForTemplate.length} total entries`
      );
      logToFile(`--------------------------------`);
      // Process top performers sequentially
      const top5PercentEntries = entriesForTemplate.slice(0, topCount);
      logToFile(
        `Selected ${top5PercentEntries.length} top performer(s) to process`
      );
      const top5PercentOfEntries = [];
      for (let index = 0; index < top5PercentEntries.length; index++) {
        const entry = top5PercentEntries[index];
        try {
          const employee = employeeMap.find(
            (e) => e._id.toString() === entry.employeeId
          );
          logToFile(
            `Rank ${index + 1}: ${employee?.name} - ${entry.score?.toFixed(2)} / ${totalMaxScore.toFixed(2)} - ${employee?.contact?.phone}`
          );
          const response = await createWhatsAppAPICall({
            campaignName: 'Top_Perfomer_API',
            contact: employee?.contact?.phone || '',
            employeeName: employee?.name || '',
            percentageScore: `${entry.score?.toFixed(2)} / ${totalMaxScore.toFixed(2)}`,
            userRank: `${index + 1}`,
            kpiSummary: entry.values
              .map((kpi: any) => `${kpi.key}: ${kpi.score?.toFixed(2)}`)
              .join(' | '),
            topPerformers: 'No top performers',
            entryId: entry._id.toString(),
          });

          top5PercentOfEntries.push({
            rank: index + 1,
            employee: employee,
            score: entry.score,
          });
        } catch (error) {
          logger.error(
            `Error processing top performer entry at rank ${index + 1}:`,
            error
          );
          // Add a placeholder so the process continues
          top5PercentOfEntries.push({
            rank: index + 1,
            employee: employeeMap.find(
              (e) => e._id.toString() === entry.employeeId
            ),
            score: entry.score,
            error: true,
          });
        }
      }
      // Only process bottom performers if there's more than 1 entry
      const bottom5PercentOfEntries = [];
      if (bottomCount > 0) {
        logToFile(`--------------------------------`);
        logToFile(`Bottom ${bottomCount} performers`);
        logToFile(`--------------------------------`);
        // Process bottom performers sequentially
        const bottom5PercentEntries = entriesForTemplate
          .slice(-bottomCount)
          .reverse();
        logToFile(
          `Selected ${bottom5PercentEntries.length} bottom performer(s) to process`
        );
        for (let index = 0; index < bottom5PercentEntries.length; index++) {
          const entry = bottom5PercentEntries[index];
          try {
            const employee = employeeMap.find(
              (e) => e._id.toString() === entry.employeeId
            );
            logToFile(
              `Rank ${entriesForTemplate.length - index}: ${employee?.name} - ${entry.score?.toFixed(2)} / ${totalMaxScore.toFixed(2)} - ${employee?.contact?.phone}`
            );

            const response = await createWhatsAppAPICall({
              campaignName: 'Bottom_Performer',
              contact: employee?.contact?.phone || '',
              employeeName: employee?.name || '',
              percentageScore: `${entry.score?.toFixed(2)} / ${totalMaxScore.toFixed(2)}`,
              userRank: `${entriesForTemplate.length - index}`,
              kpiSummary: entry.values
                .map((kpi: any) => `${kpi.key}: ${kpi.score?.toFixed(2)}`)
                .join(' | '),
              topPerformers: top5PercentOfEntries
                .filter((e: any) => !e.error)
                .map(
                  (e: any) =>
                    `Rank ${e.rank} : ${e.employee?.name || 'Unknown'} - ${e.score?.toFixed(2)} / ${totalMaxScore.toFixed(2)}`
                )
                .join('\n'),
              entryId: entry._id.toString(),
            });

            bottom5PercentOfEntries.push({
              rank: entriesForTemplate.length - index,
              employee: employee,
              score: entry.score,
            });
          } catch (error) {
            logger.error(
              `Error processing bottom performer entry at rank ${entriesForTemplate.length - index}:`,
              error
            );
            bottom5PercentOfEntries.push({
              rank: entriesForTemplate.length - index,
              employee: employeeMap.find(
                (e) => e._id.toString() === entry.employeeId
              ),
              score: entry.score,
              error: true,
            });
          }
        }
      }
      // Only process middle entries if there are enough entries (more than top + bottom)
      const middleEntries = [];
      if (entriesForTemplate.length > topCount + bottomCount) {
        logToFile(`--------------------------------`);
        logToFile(`Middle Entries`);
        logToFile(`--------------------------------`);
        // Process middle entries sequentially
        const middleEntriesList = entriesForTemplate.slice(
          topCount,
          bottomCount > 0 ? -bottomCount : undefined
        );
        const startRank = topCount + 1;
        for (let index = 0; index < middleEntriesList.length; index++) {
          const entry = middleEntriesList[index];
          try {
            const employee = employeeMap.find(
              (e) => e._id.toString() === entry.employeeId
            );
            const currentRank = index + 1 + startRank;
            logToFile(
              `Rank ${currentRank}: ${employee?.name} - ${entry.score?.toFixed(2)} / ${totalMaxScore.toFixed(2)} - ${employee?.contact?.phone}`
            );
            const response = await createWhatsAppAPICall({
              campaignName: 'Medium_Perfomer_API',
              contact: employee?.contact?.phone || '',
              employeeName: employee?.name || '',
              percentageScore: `${entry.score?.toFixed(2)} / ${totalMaxScore.toFixed(2)}`,
              userRank: `${currentRank}`,
              kpiSummary: entry.values
                .map((kpi: any) => `${kpi.key}: ${kpi.score?.toFixed(2)}`)
                .join(' | '),
              topPerformers: top5PercentOfEntries
                .filter((e: any) => !e.error)
                .map(
                  (e: any) =>
                    `Rank ${e.rank} : ${e.employee?.name || 'Unknown'} - ${e.score?.toFixed(2)} / ${totalMaxScore.toFixed(2)}`
                )
                .join('\n'),
              entryId: entry._id.toString(),
            });

            middleEntries.push({
              rank: currentRank,
              employee: employee,
              score: entry.score,
            });
          } catch (error) {
            logger.error(
              `Error processing middle performer entry at rank ${index + 1 + startRank}:`,
              error
            );
            middleEntries.push({
              rank: index + 1 + startRank,
              employee: employeeMap.find(
                (e) => e._id.toString() === entry.employeeId
              ),
              score: entry.score,
              error: true,
            });
          }
        }
      }
      logToFile(`--------------------------------`);
      logToFile(`Total Entries: ${entriesForTemplate.length}`);
      logToFile(`Top Performers: ${top5PercentOfEntries.length}`);
      logToFile(`Bottom Performers: ${bottom5PercentOfEntries.length}`);
      logToFile(`Middle Entries: ${middleEntries.length}`);
      logToFile(`--------------------------------`);
    }
  } catch (error) {
    logger.error('Error in getOverview:', error);
    errorToFile(
      `Error in getOverview: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }
}

async function generalOverview() {
  try {
    // Initialize log file
    initLogFile();

    await connectDB();
    const entries = await EntryModel.find({
      month: 11,
      status: 'generated', // filter out generated entries
    })
      .sort({ createdAt: 1 })
      .lean();
    logToFile(`Total entries: ${entries.length}`);

    // Create a overview analysis of the entries deparetment and role wise

    const listOfTemplates = [
      ...new Set(entries.map((entry) => entry.templateId)),
    ];

    const templates = await KPITemplateModel.find({
      _id: { $in: listOfTemplates },
    });

    for (const template of listOfTemplates) {
      const refTemplate = templates.find((t) => t._id.toString() === template);
      if (!refTemplate) {
        throw new Error(`Template not found: ${template}`);
      }
      const entriesForTemplate = entries.filter(
        (entry) => entry.templateId === template
      );
      const totalMaxScore = refTemplate.template.reduce(
        (total, kpi) => total + kpi.maxMarks,
        0
      );
      logToFile(`--------------------------------`);
      logToFile(
        `Template: ${refTemplate.name} (${refTemplate.departmentSlug}) ${totalMaxScore}`
      );
      logToFile(`Entries: ${entriesForTemplate.length}`);
      logToFile(`--------------------------------`);
    }
  } catch (error) {
    logger.error('Error in generalOverview:', error);
    errorToFile(
      `Error in generalOverview: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  } finally {
    logToFile('General overview script completed successfully');
    logToFile(
      `=== General Overview Script Log - Completed at ${new Date().toISOString()} ===\n`
    );
    process.exit(0);
  }
}

(async () => {
  try {
    await generalOverview();
    logToFile('Overview script completed successfully');
    logToFile(
      `=== Overview Script Log - Completed at ${new Date().toISOString()} ===\n`
    );
    process.exit(0);
  } catch (error) {
    logger.error('Fatal error in overview script:', error);
    errorToFile(
      `Fatal error in overview script: ${error instanceof Error ? error.message : String(error)}`
    );
    logToFile(
      `=== Overview Script Log - Failed at ${new Date().toISOString()} ===\n`
    );
    process.exit(1);
  }
})();
