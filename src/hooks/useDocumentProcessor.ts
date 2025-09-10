
import { useState, useCallback } from 'react';
import type { Document } from '../types/types';
import { DocumentStatus } from '../types/types';
import { processDocument } from '../services/pdfProcessingService';
import type { ProcessingProgress } from '../services/pdfProcessingService';

export const useDocumentProcessor = () => {
  const [document, setDocument] = useState<Document | null>(null);
  const [processingLog, setProcessingLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const processFile = useCallback(async (file: File, fileId?: string, bucketId?: string): Promise<Document> => {
    setError(null);
    setProcessingLog([]);

    const newDoc: Document = {
      id: new Date().toISOString(),
      fileName: file.name,
      status: DocumentStatus.PENDING,
    };
    setDocument(newDoc);

    const progressCallback = (progress: ProcessingProgress) => {
        setProcessingLog(prevLog => [...prevLog, progress.message]);
    };

    try {
      const completedDoc = await processDocument(newDoc, fileId || '', bucketId || 'pdf-files', progressCallback);
      setDocument(completedDoc);
      return completedDoc;
    } catch (err) {
      const errorDoc = err as Document;
      setError(errorDoc.errorMessage || 'An unknown error occurred.');
      setDocument(errorDoc);
      throw err;
    }
  }, []);

  const resetProcessor = useCallback(() => {
    setDocument(null);
    setProcessingLog([]);
    setError(null);
  }, []);

  return { document, processingLog, error, processFile, resetProcessor };
};
