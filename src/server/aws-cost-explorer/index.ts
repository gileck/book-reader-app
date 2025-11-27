/**
 * AWS Cost Explorer SDK Wrapper
 * 
 * Encapsulates AWS Cost Explorer API calls for tracking TTS (Polly) usage and costs.
 * This provides a clean interface for fetching real AWS usage data to display in dashboards.
 * 
 * IMPORTANT: This wrapper ONLY tracks Amazon Polly (AWS TTS) usage.
 * Google TTS and ElevenLabs usage must continue to use internal tracking.
 */

import { 
  CostExplorerClient, 
  GetCostAndUsageCommand,
  type GetCostAndUsageCommandOutput,
  type ResultByTime,
  type Group
} from '@aws-sdk/client-cost-explorer';

export interface AwsTtsUsageData {
  totalCharacters: number;
  totalCost: number;
  usageByDay: Record<string, {
    characters: number;
    cost: number;
    usageTypes: Record<string, {
      characters: number;
      cost: number;
    }>;
  }>;
  periodStart: string;
  periodEnd: string;
  dataAvailable: boolean;
  error?: string;
  // Current month free-tier breakdown (if this is current month data)
  currentMonthFreeTier?: {
    standard: number;
    neural: number;
    longform: number;
    generative: number;
  };
}

export interface AwsCostExplorerConfig {
  accessKeyId?: string;
  secretAccessKey?: string;
  region?: string;
}

/**
 * AWS Cost Explorer Client wrapper
 */
export class AwsCostExplorerWrapper {
  private client: CostExplorerClient;
  private enabled: boolean;

  constructor(config?: AwsCostExplorerConfig) {
    // Check if credentials are available
    const accessKeyId = config?.accessKeyId || process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = config?.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY;
    
    this.enabled = !!(accessKeyId && secretAccessKey);

    if (this.enabled) {
      this.client = new CostExplorerClient({
        region: config?.region || 'us-east-1', // Cost Explorer is only available in us-east-1
        credentials: {
          accessKeyId: accessKeyId!,
          secretAccessKey: secretAccessKey!
        }
      });
    } else {
      // Create a dummy client (won't be used)
      this.client = {} as CostExplorerClient;
      console.warn('AWS Cost Explorer: Credentials not found. AWS data will not be available.');
    }
  }

  /**
   * Get Amazon Polly (TTS) usage for a specific date range
   */
  async getPollyUsage(startDate: Date, endDate: Date): Promise<AwsTtsUsageData> {
    if (!this.enabled) {
      return this.getEmptyUsageData(startDate, endDate, 'AWS credentials not configured');
    }

    try {
      const command = new GetCostAndUsageCommand({
        TimePeriod: {
          Start: this.formatDate(startDate),
          End: this.formatDate(endDate)
        },
        Granularity: 'DAILY',
        Metrics: ['UsageQuantity', 'BlendedCost'],
        Filter: {
          Dimensions: {
            Key: 'SERVICE',
            Values: ['Amazon Polly']
          }
        },
        GroupBy: [
          {
            Type: 'DIMENSION',
            Key: 'USAGE_TYPE'
          }
        ]
      });

      const response = await this.client.send(command);

      return this.parseResponse(response, startDate, endDate);
    } catch (error) {
      console.error('AWS Cost Explorer error:', error);
      return this.getEmptyUsageData(startDate, endDate, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Get Amazon Polly usage for the last N days
   */
  async getPollyUsageForLastDays(days: number): Promise<AwsTtsUsageData> {
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 1); // Yesterday (Cost Explorer has 24-48h delay)
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.getPollyUsage(startDate, endDate);
  }

  /**
   * Get Amazon Polly usage for the current month
   */
  async getPollyUsageForCurrentMonth(): Promise<AwsTtsUsageData> {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 1); // Yesterday

    return this.getPollyUsage(startDate, endDate);
  }

  /**
   * Get monthly summary (aggregated by month)
   */
  async getPollyMonthlySummary(startDate: Date, endDate: Date): Promise<AwsTtsUsageData> {
    if (!this.enabled) {
      return this.getEmptyUsageData(startDate, endDate, 'AWS credentials not configured');
    }

    try {
      const command = new GetCostAndUsageCommand({
        TimePeriod: {
          Start: this.formatDate(startDate),
          End: this.formatDate(endDate)
        },
        Granularity: 'MONTHLY',
        Metrics: ['UsageQuantity', 'BlendedCost'],
        Filter: {
          Dimensions: {
            Key: 'SERVICE',
            Values: ['Amazon Polly']
          }
        }
      });

      const response = await this.client.send(command);

      return this.parseResponse(response, startDate, endDate);
    } catch (error) {
      console.error('AWS Cost Explorer error:', error);
      return this.getEmptyUsageData(startDate, endDate, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Parse AWS Cost Explorer response
   */
  private parseResponse(response: GetCostAndUsageCommandOutput, startDate: Date, endDate: Date): AwsTtsUsageData {
    const usageData: AwsTtsUsageData = {
      totalCharacters: 0,
      totalCost: 0,
      usageByDay: {},
      periodStart: this.formatDate(startDate),
      periodEnd: this.formatDate(endDate),
      dataAvailable: true
    };

    if (!response.ResultsByTime || response.ResultsByTime.length === 0) {
      usageData.dataAvailable = false;
      return usageData;
    }

    // Track usage by voice type for free-tier calculation
    const usageByVoiceType = {
      standard: 0,
      neural: 0,
      longform: 0,
      generative: 0
    };

    response.ResultsByTime.forEach((timeResult: ResultByTime) => {
      const date = timeResult.TimePeriod?.Start;
      if (!date) return;
      
      if (!usageData.usageByDay[date]) {
        usageData.usageByDay[date] = {
          characters: 0,
          cost: 0,
          usageTypes: {}
        };
      }

      const dayData = usageData.usageByDay[date];

      // Process grouped results (by usage type)
      if (timeResult.Groups && timeResult.Groups.length > 0) {
        timeResult.Groups.forEach((group: Group) => {
          const usageType = group.Keys?.[0] || 'unknown';
          const metrics = group.Metrics;

          const characters = parseFloat(metrics?.UsageQuantity?.Amount || '0');
          const cost = parseFloat(metrics?.BlendedCost?.Amount || '0');

          dayData.characters += characters;
          dayData.cost += cost;

          dayData.usageTypes[usageType] = {
            characters,
            cost
          };

          usageData.totalCharacters += characters;
          usageData.totalCost += cost;

          // Categorize by voice type for free-tier tracking
          if (usageType.includes('LongForm')) {
            usageByVoiceType.longform += characters;
          } else if (usageType.includes('Generative')) {
            usageByVoiceType.generative += characters;
          } else if (usageType.includes('Neural')) {
            usageByVoiceType.neural += characters;
          } else {
            usageByVoiceType.standard += characters;
          }
        });
      } 
      // Process non-grouped results (total only)
      else if (timeResult.Total) {
        const characters = parseFloat(timeResult.Total.UsageQuantity?.Amount || '0');
        const cost = parseFloat(timeResult.Total.BlendedCost?.Amount || '0');

        dayData.characters += characters;
        dayData.cost += cost;

        usageData.totalCharacters += characters;
        usageData.totalCost += cost;
      }
    });

    // Check if this is current month data and add free-tier breakdown
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const startDateStr = this.formatDate(startDate);
    const currentMonthStartStr = this.formatDate(currentMonthStart);

    if (startDateStr === currentMonthStartStr || startDateStr.substring(0, 7) === currentMonthStartStr.substring(0, 7)) {
      usageData.currentMonthFreeTier = usageByVoiceType;
    }

    return usageData;
  }

  /**
   * Format date to YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Get empty usage data (when AWS is not available or errors occur)
   */
  private getEmptyUsageData(startDate: Date, endDate: Date, error?: string): AwsTtsUsageData {
    return {
      totalCharacters: 0,
      totalCost: 0,
      usageByDay: {},
      periodStart: this.formatDate(startDate),
      periodEnd: this.formatDate(endDate),
      dataAvailable: false,
      error
    };
  }

  /**
   * Check if AWS Cost Explorer is enabled and available
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

// Export a singleton instance
export const awsCostExplorer = new AwsCostExplorerWrapper();

