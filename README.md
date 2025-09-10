# PDF Analyzer & Markdown Converter
## Project Brief & Development Requirements

### 🎯 Project Overview
Build a comprehensive PDF analysis application that extracts text, images, and tables from uploaded PDFs and outputs everything in clean Markdown format. The system uses Appwrite as the backend service for authentication, storage, and database management.

### 🏆 Value Proposition
- **Problem Solved**: Manual PDF content extraction is time-consuming and error-prone
- **Target Users**: Researchers, students, content creators, document processors
- **Unique Features**: Complete PDF reconstruction with tables and smart Markdown formatting
- **Hackathon Appeal**: Showcases full-stack development with real-time processing and modern web technologies

---

## 🔧 Technical Architecture

### Core Stack
- **Frontend**: React 18+ with TypeScript
- **Backend**: Appwrite (BaaS) + Python Functions
- **Storage**: Appwrite Storage
- **Database**: Appwrite Database
- **Styling**: Tailwind CSS
- **State Management**: React Context + useReducer

### System Architecture
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   React App     │───▶│   Appwrite       │───▶│  Python         │
│   (Frontend)    │    │   (Backend)      │    │  Functions      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │                          │
                              ▼                          ▼
                       ┌──────────────┐         ┌──────────────┐
                       │   Storage &  │         │   PDF        │
                       │   Database   │         │ Processing   │
                       └──────────────┘         └──────────────┘
```

---

## 📋 Functional Requirements

### Core Features (MVP)
1. **User Authentication**
   - Email/password registration and login
   - Protected routes for authenticated users
   - User session management

2. **PDF Upload & Management**
   - Drag-and-drop PDF upload interface
   - File validation (PDF only, size limits)
   - Upload progress indicators
   - File management dashboard

3. **PDF Processing Pipeline**
   - Text extraction from PDF documents
   - Image detection and extraction
   - Table identification and reconstruction

4. **Markdown Generation**
   - Convert extracted content to structured Markdown
   - Preserve document hierarchy (headers, lists, etc.)
   - Include extracted images with proper references
   - Format tables in Markdown table syntax

5. **Real-time Processing Status**
   - Live updates on processing progress
   - Error handling and user feedback
   - Processing queue management

6. **Results Display & Export**
   - Preview extracted Markdown content
   - Download processed Markdown files
   - View extracted images separately
   - Copy to clipboard functionality

### Advanced Features (Future Improvements)
- OCR processing for image content using Google Vision API
- Batch PDF processing
- Document comparison tools
- Advanced table formatting options
- Export to multiple formats (HTML, DOCX)
- Document search and indexing

---

## 🏗️ Development Requirements & Guidelines

### Code Quality Standards
- **SOLID Principles**: Apply Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, and Dependency Inversion
- **DRY (Don't Repeat Yourself)**: Extract common logic into reusable functions/components
- **KISS (Keep It Simple, Stupid)**: Prefer simple, readable solutions over complex ones
- **Component Reusability**: Convert to reusable components when used 2+ times

### File Structure
```
src/
├── components/           # Reusable UI components
│   ├── common/          # Generic components (Button, Modal, etc.)
│   ├── forms/           # Form-specific components
│   └── layout/          # Layout components
├── pages/               # Page components
├── services/            # API and external service integrations
├── hooks/               # Custom React hooks
├── contexts/            # React Context providers
├── utils/               # Utility functions
├── types/               # TypeScript type definitions
└── constants/           # Application constants
```

### Component Architecture Guidelines
```typescript
// Example: Reusable component structure
interface ComponentProps {
  // Props interface
}

const Component: React.FC<ComponentProps> = ({ ...props }) => {
  // Component logic
  return (
    // JSX
  );
};

export default Component;
```

---

## 🔌 API Integration Requirements

### Appwrite Configuration
```javascript
// appwrite.config.js
const client = new Client()
  .setEndpoint(process.env.REACT_APP_APPWRITE_ENDPOINT)
  .setProject(process.env.REACT_APP_APPWRITE_PROJECT_ID);

const databases = new Databases(client);
const storage = new Storage(client);
const functions = new Functions(client);
const account = new Account(client);
```

### Database Schema Design
```javascript
// Collections
const collections = {
  documents: {
    userId: "string",
    originalFileName: "string",
    fileId: "string",  // IMPORTANT: This must be the Appwrite file ID (e.g., "68baf465002390a5d863"), NOT the filename
    status: "pending|processing|completed|failed",
    processingStarted: "datetime",
    processingCompleted: "datetime",
    extractedText: "string",
    markdownContent: "string",
    imageIds: "string[]",  // Array of Appwrite file IDs for extracted images
    tableCount: "integer",
    ocrEnabled: "boolean",
    errorMessage: "string",
    metadata: "object"
  },

  images: {
    documentId: "string",
    fileId: "string",
    originalName: "string",
    ocrText: "string",
    position: "integer",
    boundingBox: "object"
  },

  tables: {
    documentId: "string",
    position: "integer",
    rows: "integer",
    columns: "integer",
    data: "object",
    markdownTable: "string"
  }
};
```

### File Upload API Endpoint

#### Endpoint: `/upload`
**Method**: `POST`  
**Content-Type**: `multipart/form-data`

Upload PDF files to the system for processing. The endpoint automatically creates storage buckets, handles file storage, and creates database records.

#### Request Format

**Form Data:**
- **Key**: `file`
- **Type**: File
- **Value**: Select your PDF file (e.g., `C5_W4.pdf`)

**Headers:**
```
x-user-id: your-user-id          # Required: User identifier
x-filename: C5_W4.pdf           # Optional: Override filename (if not detected from file)
x-bucket-id: pdf-files          # Optional: Storage bucket (default: pdf-files)
```

#### Postman Setup
1. **Method**: POST
2. **URL**: `https://your-function-url/upload`
3. **Body**:
   - Select **"form-data"**
   - Add key `file` as **File** type
   - Select your PDF file
4. **Headers** (optional but recommended):
   - `x-user-id`: `your-user-id`
   - `x-filename`: `C5_W4.pdf` (if needed)

#### Success Response
```json
{
  "success": true,
  "message": "PDF uploaded successfully",
  "documentId": "67b8f1a5002c8e9d1f2a",
  "fileId": "67b8f1a6002c8e9d1f2b",
  "fileName": "default-user_1757340749_C5_W4.pdf",
  "bucketId": "pdf-files"
}
```

#### Error Responses
```json
// Missing file
{
  "error": "No file data found in request",
  "usage": "Send PDF file as multipart/form-data with key 'file'"
}

// Storage bucket error
{
  "error": "Failed to create or access bucket 'pdf-files'",
  "available_buckets": ["existing-bucket-1"],
  "suggestion": "Create bucket manually or use existing bucket"
}

// General error
{
  "error": "File upload failed",
  "message": "Detailed error message",
  "type": "ExceptionType"
}
```

#### Features
- ✅ **Automatic bucket creation** - Creates storage bucket if it doesn't exist
- ✅ **File validation** - Validates PDF format and file integrity
- ✅ **Database integration** - Creates document records automatically
- ✅ **Error recovery** - Cleans up files if database operations fail
- ✅ **Flexible headers** - Supports custom user IDs and bucket names
- ✅ **Comprehensive logging** - Detailed logs for debugging

#### Python Function Structure
```python
# functions/src/main.py
from .upload_handler import UploadHandler

def main(context):
    if context.req.path == "/upload":
        upload_handler = UploadHandler(context)
        result = upload_handler.handle_upload(context.req)
        return context.res.json(result)
```

```python
# functions/src/upload_handler.py
class UploadHandler:
    def handle_upload(self, request) -> Dict[str, Any]:
        # Extract file data and metadata
        # Validate and process upload
        # Return structured response
        pass
```

---

## 🎨 UI/UX Requirements

### Design Principles
- **Clean & Modern**: Minimalist interface with intuitive navigation
- **Responsive**: Mobile-first design approach
- **Accessible**: WCAG 2.1 AA compliance
- **Performance**: Fast loading and smooth interactions

### Key UI Components (Reusable)
1. **FileUploader** - Drag & drop with progress
2. **ProcessingStatus** - Real-time status updates with separate dialogs for upload vs processing
3. **MarkdownPreview** - Syntax-highlighted preview
4. **ProgressIndicator** - Processing progress with step-by-step indicators
5. **ErrorBoundary** - Error handling wrapper
6. **LoadingSpinner** - Loading states
7. **Toast** - Notifications system
8. **Modal** - Dialog wrapper
9. **Navigation Bar** - Always visible with user info and logout
10. **ResultsView** - Clean markdown-only results display

### Color Scheme & Theming
- Primary: Blue/Indigo for actions and links
- Secondary: Gray for neutral elements
- Success: Green for completed states
- Warning: Yellow for processing states
- Error: Red for error states
- Background: Light gray with white cards

---

## 📦 Dependencies & Setup

### Frontend Dependencies
```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.8.0",
    "appwrite": "^13.0.0",
    "typescript": "^4.9.0",
    "tailwindcss": "^3.2.0",
    "react-markdown": "^8.0.0",
    "react-syntax-highlighter": "^15.5.0",
    "react-dropzone": "^14.2.0",
    "lucide-react": "^0.263.1",
    "clsx": "^1.2.1"
  }
}
```

### Python Function Dependencies
```txt
appwrite==4.0.0
PyMuPDF==1.21.1
pandas==1.5.3
tabulate==0.9.0
Pillow==9.4.0
python-dotenv==1.0.0
```

---

## 🧪 Testing Strategy

### Unit Tests
- Component rendering and behavior
- Utility functions and helpers
- API service methods
- PDF processing functions

### Integration Tests
- File upload workflow
- PDF processing pipeline
- Database operations

### E2E Tests
- Complete user workflow
- Authentication flow
- File processing end-to-end
- Error scenarios

---

## 🛠️ Development Environment Setup

### Prerequisites
- Node.js 18+
- Python 3.9+
- Appwrite Cloud account
- Git and GitHub account

### Quick Start Commands
```bash
# Frontend setup
npx create-react-app pdf-analyzer --template typescript
cd pdf-analyzer
npm install appwrite tailwindcss @types/react

# Python function setup
mkdir appwrite-functions/pdf-processor
pip install -r requirements.txt

# Environment variables
cp .env.example .env
# Add your API keys and endpoints
```

## 🔧 Environment Variables Configuration

### Frontend Environment Variables (`.env`)
These variables are used by the React frontend and must be prefixed with `VITE_` to be accessible in the browser:

```bash
# ==========================================
# FRONTEND CONFIGURATION (Client-side)
# ==========================================

# Appwrite Configuration
VITE_APPWRITE_ENDPOINT=https://syd.cloud.appwrite.io/v1
VITE_APPWRITE_PROJECT_ID=your_project_id_here
VITE_APPWRITE_DATABASE_ID=your_database_id_here
VITE_APPWRITE_STORAGE_BUCKET_ID=your_storage_bucket_id
VITE_APPWRITE_FUNCTION_ID=pdf-processor

# ==========================================
# BACKEND CONFIGURATION (Server-side - Python Functions)
# ==========================================

# Server-side API Key (used by Python functions)
APPWRITE_API_KEY=your_server_api_key_here

# Google Vision API (optional - for OCR processing)
GOOGLE_VISION_API_KEY=your_google_vision_api_key
```

### Backend Environment Variables (Python Functions)
These variables are used by the Python functions running on Appwrite and should be set in your Appwrite function environment:

```bash
# Appwrite Function Environment Variables
APPWRITE_ENDPOINT=https://syd.cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=your_project_id_here
APPWRITE_API_KEY=your_server_api_key_here
GOOGLE_VISION_API_KEY=your_google_vision_api_key
```

### Setup Instructions

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Create API Key** in Appwrite:
   - Go to your project dashboard → "API Keys"
   - Click "Create API Key"
   - Name: "PDFusion Server Key"
   - Scopes: Select ALL (databases.read, databases.write, storage.read, storage.write, functions.read, functions.write)
   - Copy the generated key (starts with numbers like "919c2d18fb...")

3. **Configure Frontend Environment** (`.env` file):
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

4. **Configure Backend Environment** (Appwrite Functions):
   - Go to your Appwrite project dashboard → Functions
   - Select your PDF processor function
   - Go to "Environment Variables" section
   - Add the backend environment variables listed above

5. **Run database setup**:
   ```bash
   npm run setup-db
   ```

This will create all required collections (documents, images, tables) with proper attributes and indexes.

## 🚨 Troubleshooting Deployment Issues

### "Failed to construct 'URL': Invalid URL" Error

If you encounter this error when deployed to Appwrite but not locally, it's likely due to missing or incorrect environment variables in your deployment environment.

**Symptoms:**
- Login fails with `TypeError: Failed to construct 'URL': Invalid URL`
- Works fine in local development
- Error occurs in deployed Appwrite environment

**Solutions:**

1. **Check Environment Variables in Appwrite Console:**
   - Go to your Appwrite project dashboard
   - Navigate to "Deployments" → "Web App"
   - Check the "Environment Variables" section
   - Ensure these variables are set:
     ```
     VITE_APPWRITE_ENDPOINT=https://your-region.cloud.appwrite.io/v1
     VITE_APPWRITE_PROJECT_ID=your_project_id
     ```

2. **Verify Variable Names:**
   - Make sure variables start with `VITE_` prefix
   - Check for typos in variable names
   - Ensure no extra spaces or special characters

3. **Check Appwrite Region:**
   - Your endpoint should match your Appwrite region
   - Common regions: `cloud.appwrite.io`, `syd.cloud.appwrite.io`, `fra.cloud.appwrite.io`
   - Example: `https://syd.cloud.appwrite.io/v1`

4. **Redeploy After Changes:**
   - Environment variable changes require redeployment
   - Go to "Deployments" → "Web App" → "Deploy"

**Debugging Steps:**
1. Add console logging to check environment variables:
   ```javascript
   console.log('Endpoint:', import.meta.env.VITE_APPWRITE_ENDPOINT);
   console.log('Project ID:', import.meta.env.VITE_APPWRITE_PROJECT_ID);
   ```

2. Check browser developer tools for any console errors
3. Verify the Appwrite project is accessible from your deployment region

### "Route not found" / Function ID Format Error

If you encounter a 404 error with "Route not found" when uploading files, it's likely due to incorrect function ID format.

**Symptoms:**
- Upload fails with `POST .../functions/.../executions 404 (Not Found)`
- Error mentions "Route not found" or "AppwriteException"
- Function URL looks malformed in the error

**Root Cause:**
The `VITE_APPWRITE_FUNCTION_ID` is set to a full URL instead of just the function ID.

**Incorrect (causes error):**
```bash
VITE_APPWRITE_FUNCTION_ID=https://68bacfc2002c8e9d1f2c.syd.appwrite.run/
```

**Correct:**
```bash
VITE_APPWRITE_FUNCTION_ID=68bacfc2002c8e9d1f2c
```

**How to Find Your Function ID:**
1. Go to your Appwrite project dashboard
2. Navigate to "Functions" in the left sidebar
3. Select your PDF processor function
4. Copy the Function ID from the function details (it should be a string like `68bacfc2002c8e9d1f2c`)

**Verification:**
- Function ID should be just alphanumeric characters
- No `https://` or domain names
- No trailing slashes
- Usually around 20-25 characters long

### Environment Variables Reference

| Variable | Location | Purpose | Example |
|----------|----------|---------|---------|
| `VITE_APPWRITE_ENDPOINT` | Frontend | Appwrite API endpoint | `https://cloud.appwrite.io/v1` |
| `VITE_APPWRITE_PROJECT_ID` | Frontend | Appwrite project ID | `12345678901234567890` |
| `VITE_APPWRITE_DATABASE_ID` | Frontend | Database ID | `12345678901234567890` |
| `VITE_APPWRITE_STORAGE_BUCKET_ID` | Frontend | Storage bucket ID | `12345678901234567890` |
| `VITE_APPWRITE_FUNCTION_ID` | Frontend | Function ID for PDF processing | `pdf12345678901234567890` |
| `APPWRITE_API_KEY` | Backend | Server-side API key | `1234567890...` |
| `GOOGLE_VISION_API_KEY` | Backend | Google Vision API key | `Abcdefg...` |

---

This comprehensive brief provides everything needed for an agentic IDE to build a production-ready PDF analyzer that follows best practices and architectural principles while delivering hackathon-winning functionality.
