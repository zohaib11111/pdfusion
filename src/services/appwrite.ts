import { Client, Databases, Storage, Functions, Account } from 'appwrite';

// Get environment variables with fallbacks
const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID || '';

// Debug logging for environment variables (only in development)
if (import.meta.env.DEV) {
  console.log('Appwrite Config:', {
    endpoint,
    projectId,
    hasEndpoint: !!endpoint,
    hasProjectId: !!projectId
  });
}

// Validate required environment variables
if (!endpoint || !projectId) {
  console.error('Missing required Appwrite environment variables:', {
    VITE_APPWRITE_ENDPOINT: endpoint,
    VITE_APPWRITE_PROJECT_ID: projectId
  });
  throw new Error('Appwrite configuration is incomplete. Please check your environment variables.');
}

const client = new Client()
  .setEndpoint(endpoint)
  .setProject(projectId);

// Note: API key is not set for client-side operations
// API keys are only needed for server-side operations

export const databases = new Databases(client);
export const storage = new Storage(client);
export const functions = new Functions(client);
export const account = new Account(client);

export default client;
