// setup-database.js
import { Client, Databases, ID } from 'node-appwrite';
import 'dotenv/config';

// Initialize the Appwrite client
const client = new Client();

// Configure the client with your project details
client
    .setEndpoint(process.env.VITE_APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1')
    .setProject(process.env.VITE_APPWRITE_PROJECT_ID || 'YOUR_PROJECT_ID')
    .setKey(process.env.APPWRITE_API_KEY || 'YOUR_API_KEY'); // Server-side API key

// Initialize services
const databases = new Databases(client);

// Database and collection configuration
const DATABASE_ID = process.env.VITE_APPWRITE_DATABASE_ID || 'YOUR_DATABASE_ID';

// Collection schemas
const collections = {
  documents: {
    name: 'documents',
    attributes: [
      { key: 'userId', type: 'string', size: 255, required: true },
      { key: 'originalFileName', type: 'string', size: 255, required: true },
      { key: 'fileId', type: 'string', size: 255, required: true },
      { key: 'status', type: 'string', size: 50, required: true },
      { key: 'processingStarted', type: 'datetime', required: false },
      { key: 'processingCompleted', type: 'datetime', required: false },
      { key: 'markdownContent', type: 'string', size: 1000000, required: false }, // Large text field
      { key: 'imageIds', type: 'string', size: 1000, required: false, array: true },
      { key: 'tableCount', type: 'integer', required: false, default: 0 },
      { key: 'ocrEnabled', type: 'boolean', required: false, default: true },
      { key: 'errorMessage', type: 'string', size: 1000, required: false },
      { key: 'metadata', type: 'string', size: 10000, required: false } // JSON string
    ],
    indexes: [
      { key: 'user_status', type: 'key', attributes: ['userId', 'status'] },
      { key: 'status', type: 'key', attributes: ['status'] },
      { key: 'userId', type: 'key', attributes: ['userId'] }
    ]
  },

  images: {
    name: 'images',
    attributes: [
      { key: 'userId', type: 'string', size: 255, required: true },
      { key: 'fileId', type: 'string', size: 255, required: true },
      { key: 'contentHash', type: 'string', size: 64, required: true }, // SHA-256 hex string
      { key: 'fileName', type: 'string', size: 500, required: true },
      { key: 'imageUrl', type: 'string', size: 2000, required: true },
      { key: 'page', type: 'integer', required: false },
      { key: 'ocrText', type: 'string', size: 100000, required: false },
      { key: 'width', type: 'integer', required: false, default: 0 },
      { key: 'height', type: 'integer', required: false, default: 0 },
      { key: 'createdAt', type: 'datetime', required: false }
    ],
    indexes: [
      // Fast lookup by user + hash (deduplication check)
      { key: 'user_hash', type: 'key', attributes: ['userId', 'contentHash'], orders: ['ASC', 'ASC'] },
      // Fast lookup by file ID
      { key: 'fileId', type: 'key', attributes: ['fileId'] },
    ]
  }
};

// Helper function to create a collection
async function createCollection(collectionConfig) {
  try {
    console.log(`Checking collection: ${collectionConfig.name}`);

    // Check if collection already exists
    let collection;
    try {
      collection = await databases.getCollection(DATABASE_ID, collectionConfig.name);
      console.log(`✓ Collection '${collectionConfig.name}' already exists with ID: ${collection.$id}`);
    } catch (error) {
      if (error.code === 404) {
        // Collection doesn't exist, create it
        console.log(`Creating collection: ${collectionConfig.name}`);
        collection = await databases.createCollection(
          DATABASE_ID,
          collectionConfig.name,
          collectionConfig.name,
          undefined, // permissions - using default
          false // document security
        );
        console.log(`✓ Collection '${collectionConfig.name}' created with ID: ${collection.$id}`);
      } else {
        throw error;
      }
    }

    // Create attributes
    for (const attr of collectionConfig.attributes) {
      try {
        if (attr.type === 'string') {
          await databases.createStringAttribute(
            DATABASE_ID,
            collection.$id,
            attr.key,
            attr.size,
            attr.required,
            attr.default || undefined,
            attr.array || false
          );
        } else if (attr.type === 'integer') {
          await databases.createIntegerAttribute(
            DATABASE_ID,
            collection.$id,
            attr.key,
            attr.required,
            attr.default || 0,
            undefined, // min
            undefined  // max
          );
        } else if (attr.type === 'boolean') {
          await databases.createBooleanAttribute(
            DATABASE_ID,
            collection.$id,
            attr.key,
            attr.required,
            attr.default || false
          );
        } else if (attr.type === 'datetime') {
          await databases.createDatetimeAttribute(
            DATABASE_ID,
            collection.$id,
            attr.key,
            attr.required
          );
        }

        console.log(`  ✓ Attribute '${attr.key}' created`);
      } catch (error) {
        console.log(`  ⚠ Attribute '${attr.key}' may already exist:`, error.message);
      }
    }

    // Create indexes
    for (const index of collectionConfig.indexes) {
      try {
        await databases.createIndex(
          DATABASE_ID,
          collection.$id,
          index.key,
          index.type,
          index.attributes
        );
        console.log(`  ✓ Index '${index.key}' created`);
      } catch (error) {
        console.log(`  ⚠ Index '${index.key}' may already exist:`, error.message);
      }
    }

    return collection;
  } catch (error) {
    console.error(`✗ Failed to create collection '${collectionConfig.name}':`, error.message);
    throw error;
  }
}

// Main setup function
async function setupDatabase() {
  console.log('🚀 Starting PDFusion database setup...');
  console.log('Database ID:', DATABASE_ID);
  console.log('');

  try {
    // Create collections
    for (const [key, config] of Object.entries(collections)) {
      await createCollection(config);
      console.log('');
    }

    console.log('✅ Database setup completed successfully!');
    console.log('');
    console.log('📋 Summary:');
    console.log('- Documents collection: Tracks PDF processing status and results');
    console.log('- Images collection: Stores extracted images and OCR text');
    console.log('- Tables collection: Stores extracted tables and markdown representation');
    console.log('');
    console.log('🎯 Your database is ready for PDF processing!');

  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  }
}

// Run the setup
setupDatabase();