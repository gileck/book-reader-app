import { useState, useCallback } from 'react';
import type { SSEEvent } from './useUploadManager';

interface UploadParams {
    file: File | null;
    pdfUrl: string;
    uploadMode: 'file' | 'url';
    fileName?: string;
}

/**
 * Custom hook for handling SSE upload streaming
 * Separates complex SSE logic from UI components
 */
export const useSSEUpload = () => {
    const [isUploading, setIsUploading] = useState(false);

    /**
     * Prepare request body based on upload mode
     */
    const prepareRequestBody = async (
        file: File | null,
        pdfUrl: string,
        uploadMode: 'file' | 'url'
    ): Promise<{ pdfBase64?: string; pdfUrl?: string; fileName?: string }> => {
        if (uploadMode === 'file' && file) {
            const reader = new FileReader();
            const base64Promise = new Promise<string>((resolve, reject) => {
                reader.onload = () => {
                    const base64 = (reader.result as string).split(',')[1];
                    resolve(base64);
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            const base64 = await base64Promise;
            return {
                pdfBase64: base64,
                fileName: file.name
            };
        } else {
            return {
                pdfUrl: pdfUrl.trim()
            };
        }
    };

    /**
     * Process SSE stream and call onEvent for each event
     */
    const processSSEStream = async (
        response: Response,
        onEvent: (event: SSEEvent) => string | null | undefined
    ): Promise<void> => {
        console.log('📞 Starting SSE stream reading...');

        const streamReader = response.body!.getReader();
        const decoder = new TextDecoder();
        let uploadId: string | null = null;

        console.log('📞 Stream reader created, entering read loop...');

        while (true) {
            const { done, value } = await streamReader.read();
            
            console.log('📞 Stream chunk received:', { done, valueSize: value?.length });
            
            if (done) break;

            const text = decoder.decode(value);
            const lines = text.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = JSON.parse(line.substring(6)) as SSEEvent;
                    
                    // Get uploadId from first event
                    if (data.uploadId && !uploadId) {
                        uploadId = data.uploadId;
                    }
                    
                    // Call event handler
                    const result = onEvent(data);
                    
                    // Update uploadId if returned
                    if (result && !uploadId) {
                        uploadId = result;
                    }
                }
            }
        }
    };

    /**
     * Start upload with SSE streaming
     */
    const startUpload = useCallback(async (
        params: UploadParams,
        onEvent: (event: SSEEvent) => string | null | undefined
    ): Promise<boolean> => {
        setIsUploading(true);

        try {
            const requestBody = await prepareRequestBody(
                params.file,
                params.pdfUrl,
                params.uploadMode
            );

            console.log('📞 Sending upload request...');

            const response = await fetch('/api/upload/parse', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            }) as Response;

            console.log('📞 Upload request completed, status:', response.status);
            console.log('📞 Response headers:', {
                contentType: response.headers.get('content-type'),
                cacheControl: response.headers.get('cache-control'),
                connection: response.headers.get('connection')
            });

            if (!response.ok) {
                throw new Error('Upload failed');
            }

            await processSSEStream(response, onEvent);

            return true;
        } catch (err) {
            console.error('Upload error:', err);
            throw err;
        } finally {
            setIsUploading(false);
        }
    }, []);

    return {
        isUploading,
        startUpload
    };
};

