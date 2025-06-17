import { v4 as uuidv4 } from 'uuid';
import { uploadFile, getFileAsString, listFiles } from '../s3/sdk';
import type { TtsUsageRecord, TtsUsageSummary } from '../../apis/ttsUsage/types';
import type { TtsProvider } from '../tts/adapters/ttsAdapterFactory';

const TTS_USAGE_PREFIX = 'tts-usage/';

export const addTtsUsageRecord = async (
  provider: TtsProvider,
  voiceId: string,
  textLength: number,
  audioLength: number,
  cost: number,
  endpoint: string = 'unknown'
): Promise<TtsUsageRecord> => {
  try {
    const record: TtsUsageRecord = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      provider,
      voiceId,
      textLength,
      audioLength,
      cost,
      endpoint
    };

    const fileName = `${TTS_USAGE_PREFIX}${record.id}.json`;
    await uploadFile({
      content: JSON.stringify(record, null, 2),
      fileName,
      contentType: 'application/json'
    });

    console.log(`TTS usage record saved: ${record.id}`);
    return record;
  } catch (error) {
    console.error('Error saving TTS usage record:', error);
    throw error;
  }
};

export const getAllTtsUsageRecords = async (): Promise<TtsUsageRecord[]> => {
  try {
    const files = await listFiles(TTS_USAGE_PREFIX);
    
    const records: TtsUsageRecord[] = [];
    for (const file of files) {
      try {
        const recordId = file.key.replace(TTS_USAGE_PREFIX, '').replace('.json', '');
        const fileName = `${TTS_USAGE_PREFIX}${recordId}.json`;
        const content = await getFileAsString(fileName);
        const record = JSON.parse(content) as TtsUsageRecord;
        records.push(record);
      } catch (error) {
        console.error(`Error retrieving TTS record from file ${file.key}:`, error);
      }
    }
    
    return records.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch (error) {
    console.error('Error retrieving TTS usage records:', error);
    return [];
  }
};

export const getTtsUsageSummary = async (): Promise<TtsUsageSummary> => {
  const records = await getAllTtsUsageRecords();
  
  const summary: TtsUsageSummary = {
    totalCost: 0,
    totalCalls: 0,
    totalTextLength: 0,
    totalAudioLength: 0,
    usageByProvider: {},
    usageByDay: {}
  };
  
  records.forEach(record => {
    summary.totalCost += record.cost;
    summary.totalCalls += 1;
    summary.totalTextLength += record.textLength;
    summary.totalAudioLength += record.audioLength;
    
    if (!summary.usageByProvider[record.provider]) {
      summary.usageByProvider[record.provider] = {
        totalCost: 0,
        totalCalls: 0,
        totalTextLength: 0,
        totalAudioLength: 0
      };
    }
    const providerStats = summary.usageByProvider[record.provider];
    providerStats.totalCost += record.cost;
    providerStats.totalCalls += 1;
    providerStats.totalTextLength += record.textLength;
    providerStats.totalAudioLength += record.audioLength;
    
    const day = record.timestamp.split('T')[0];
    if (!summary.usageByDay[day]) {
      summary.usageByDay[day] = {
        totalCost: 0,
        totalCalls: 0
      };
    }
    summary.usageByDay[day].totalCost += record.cost;
    summary.usageByDay[day].totalCalls += 1;
  });
  
  return summary;
}; 