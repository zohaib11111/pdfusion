import { storage } from './appwrite';
import { ID } from 'appwrite';

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
}

// Check if Appwrite is configured
const isAppwriteConfigured = () => {
  const endpoint = process.env.REACT_APP_APPWRITE_ENDPOINT;
  const projectId = process.env.REACT_APP_APPWRITE_PROJECT_ID;
  return endpoint && projectId && endpoint !== 'YOUR_ENDPOINT' && projectId !== 'YOUR_PROJECT_ID';
};

export const uploadFile = async (file: File): Promise<UploadedFile> => {
  try {
    if (isAppwriteConfigured()) {
      // Real Appwrite upload
      const fileId = ID.unique();
      const response = await storage.createFile(
        'pdf-files', // bucket ID - you'll need to create this bucket in Appwrite
        fileId,
        file
      );
      const fileUrl = storage.getFileView('pdf-files', fileId);

      return {
        id: response.$id,
        name: file.name,
        size: file.size,
        type: file.type,
        url: fileUrl.toString(),
      };
    } else {
      // Demo mode - simulate upload
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate upload delay

      // Create a mock file URL using FileReader for demo
      const mockUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      return {
        id: 'demo-file-' + Date.now(),
        name: file.name,
        size: file.size,
        type: file.type,
        url: mockUrl,
      };
    }
  } catch (error) {
    console.error('File upload failed:', error);
    throw new Error('Failed to upload file. Please try again.');
  }
};

export const deleteFile = async (fileId: string): Promise<void> => {
  try {
    if (isAppwriteConfigured()) {
      await storage.deleteFile('pdf-files', fileId);
    } else {
      // Demo mode - just log
      console.log('Demo mode: Would delete file', fileId);
    }
  } catch (error) {
    console.error('File deletion failed:', error);
    throw new Error('Failed to delete file.');
  }
};
