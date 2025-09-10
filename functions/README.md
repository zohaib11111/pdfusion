# 📄 PDF Processing Function

A powerful PDF processing function that extracts text, images, tables, and performs OCR using PyMuPDF, Google Vision API, and enhanced table extraction. 🚀

## 🧰 Usage

### GET /ping

- Health check endpoint that returns a "Pong" message.

**Response**

Sample `200` Response:

```text
Pong
```

### GET /process

- Processes a PDF document by extracting text, images, and performing OCR if configured.

**Sample query parameter**

```url
https://68bacfcb00395313ce97.syd.appwrite.run/process?documentId=68bae5bb003e52a6def5&fileId=68baf465002390a5d863&bucketId=68b6f6a10012da81c57c
```

**Parameters**
- `documentId` (required): The ID of the document record in Appwrite database
- `fileId` (required): The ID of the PDF file in Appwrite storage
- `bucketId` (optional): The storage bucket ID (defaults to "pdf-files")
- `project` (optional): Override Appwrite project ID

**Response**

Sample `200` Response:

```json
{
  "success": true,
  "documentId": "document_123",
  "markdownContent": "# Extracted PDF Content\n\n## Page 1\n\nContent here...",
  "images": [
    {
      "id": "file_123",
      "url": "https://storage.appwrite.io/v1/files/file_123/view",
      "name": "file_123.png",
      "ocrText": "Extracted text from image",
      "caption": "Image 1 from Page 1",
      "page": 1,
      "width": 100,
      "height": 200
    }
  ],
  "pageCount": 5,
  "imageCount": 3
}
```

**Error Response**

Sample `400` Response:

```json
{
  "error": "Missing documentId or fileId"
}
```

### GET, POST, PUT, PATCH, DELETE /*

- Catch-all endpoint for undefined routes.

**Response**

Sample `404` Response:

```json
{
  "error": "Endpoint not found"
}
```

## ⚙️ Configuration

| Setting           | Value                             |
| ----------------- | --------------------------------- |
| Runtime           | Python (3.9)                      |
| Entrypoint        | `src/main.py`                     |
| Build Commands    | `pip install -r requirements.txt` |
| Permissions       | `any`                             |
| Timeout (Seconds) | 15                                |

## 🔒 Environment Variables

| Variable | Description | Required |
| -------- | ----------- | -------- |
| `APPWRITE_ENDPOINT` | Appwrite API endpoint URL | Yes |
| `APPWRITE_PROJECT_ID` | Appwrite project ID | Yes |
| `APPWRITE_API_KEY` | Appwrite API key with necessary permissions | Yes |
| `APPWRITE_DATABASE_ID` | Appwrite database ID | Yes |
| `APPWRITE_DOCUMENTS_COLLECTION_ID` | Appwrite documents collection ID | Yes |
| `APPWRITE_IMAGES_COLLECTION_ID` | Appwrite imaages collection ID | Yes |
| `GOOGLE_VISION_CREDENTIALS` | Google Cloud Vision API credentials (JSON) | No (for OCR functionality) |

## 🏗️ Architecture

The function is organized into modular components:

```text
functions/
├── src/
│   ├── main.py                 # Main entry point and request routing
│   ├── pdf_extractor.py        # Text and image extraction
│   ├── table_extractor.py      # Enhanced table detection and extraction
│   ├── markdown_generator.py   # Markdown content generation
│   ├── storage_manager.py      # Appwrite storage operations
│   ├── database_manager.py     # Appwrite database operations
│   ├── vision_processor.py     # Google Vision OCR integration
│   └── dependency_handler.py   # Dependency management
├── test/
│   ├── test_pdf_extractor.py   # PDF extraction tests
│   ├── test_table_extractor.py # Table extraction tests
│   └── run_tests.py           # Test runner
└── requirements.txt           # Python dependencies
```

## ✨ Features

### Enhanced Table Extraction

- **PyMuPDF Integration**: Uses built-in table detection algorithms
- **Multiple Formats**: Extracts tables as CSV, Markdown, and raw data
- **Accurate Detection**: Better than text-based heuristics
- **Metadata Preservation**: Captures table position, dimensions, and structure

### Comprehensive Content Extraction

- **Text Extraction**: Full text content with page mapping
- **Image Extraction**: High-quality image extraction with metadata
- **OCR Integration**: Optional Google Vision API for image text recognition
- **Markdown Generation**: Structured output with proper formatting

### Robust Error Handling

- **Graceful Degradation**: Continues processing even if components fail
- **Comprehensive Logging**: Detailed logging for debugging
- **Status Tracking**: Real-time progress updates in database

## 🧪 Testing

### Running Tests

```bash
# Install test dependencies
pip install reportlab unittest2

# Run all tests
cd functions/test
python run_tests.py

# Run specific test suites
python run_tests.py --pdf-only
python run_tests.py --table-only

# Run individual test files
python test_pdf_extractor.py
python test_table_extractor.py
```

## Test Coverage

The test suite includes:

- **Unit Tests**: Individual component testing
- **Integration Tests**: Complete pipeline testing
- **Error Handling**: Invalid input and edge case testing
- **Mock Testing**: Appwrite service mocking
- **PDF Generation**: Automatic test PDF creation

## Test Output

Tests automatically generate sample PDFs with tables and verify:

- Text extraction accuracy
- Table detection and formatting
- Image extraction quality
- Markdown generation correctness
- Error handling robustness

## 🚀 Deployment

1. Install Dependencies:

```bash
pip install -r requirements.txt
```

2. Set Environment Variables:

```bash
export APPWRITE_ENDPOINT="your_endpoint"
export APPWRITE_PROJECT_ID="your_project_id"
export APPWRITE_API_KEY="your_api_key"
export APPWRITE_DATABASE_ID="your_database_id"
export APPWRITE_DOCUMENTS_COLLECTION_ID="your_documents_collection"
export APPWRITE_IMAGES_COLLECTION_ID="your_images_collection"
# Optional: For OCR functionality
export GOOGLE_VISION_CREDENTIALS='{"your": "credentials"}'
```

3. Deploy to Appwrite:

- Upload the function through Appwrite Console
- Or use Appwrite CLI for deployment

## 📊 Output Formats

### Database Updates

The function updates the document record with:

- Processing status (processing, completed, failed)
- Extracted text content
- Generated markdown
- Image references
- Table metadata
- Error messages (if any)

### File Outputs

- **Images**: Saved to Appwrite storage with public URLs
- **Tables**: Stored in database with multiple representations
- **Markdown**: Comprehensive document with all extracted content

## 🔧 Customization

### Adding New Extractors

1. Create a new module in src/
2. Implement the extraction logic
3. Add to the main processing pipeline
4. Update tests accordingly

### Modifying Output Formats

- Edit markdown_generator.py for content formatting
- Modify table extractor for different output formats
- Customize database schema in database_manager.py

## 🐛 Troubleshooting

### Common Issues

1. Missing Dependencies:

```bash
pip install pymupdf pandas google-cloud-vision appwrite
```

2. PDF Extraction Fails:

- Check PDF file integrity
- Verify PyMuPDF installation

3. Table Detection Issues:

- Ensure PDF contains properly formatted tables
- Check PyMuPDF version compatibility

4. OCR Not Working:

- Verify Google Vision credentials
- Check image quality and orientation

### Debug Mode

Enable detailed logging by checking function logs in Appwrite Console or by adding debug environment variables.

## 📈 Performance

- **Processing Time**: ~2-5 seconds per page (depending on content)
- **Memory Usage**: Optimized for serverless environments
- **Concurrency**: Designed for parallel processing
- **Timeout**: Configured for 15-second timeout (adjustable)

## 🔮 Future Enhancements

- Support for more document formats
- Advanced table structure recognition
- Machine learning-based content classification
- Real-time processing status updates
- Batch processing capabilities
- Custom output template support