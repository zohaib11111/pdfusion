# src/main.py
import os

# Handle PyMuPDF import with fallback
try:
    import pymupdf as fitz
    PYPDF_AVAILABLE = True
except ImportError:
    try:
        import fitz
        PYPDF_AVAILABLE = True
    except ImportError:
        PYPDF_AVAILABLE = False
        print("PyMuPDF not available")

# Try to import pandas for table processing
try:
    import pandas as pd
    PANDAS_AVAILABLE = True
except ImportError:
    PANDAS_AVAILABLE = False
    print("Pandas not available")

# Try to import tabula for table extraction
try:
    import tabula
    TABULA_AVAILABLE = True
except ImportError:
    TABULA_AVAILABLE = False
    print("Tabula not available")

# Google Vision imports with safe handling
try:
    from google.cloud import vision
    VISION_AVAILABLE = True
except ImportError:
    VISION_AVAILABLE = False
    print("Google Vision not available")

# Appwrite imports with safe handling
try:
    from appwrite.client import Client
    from appwrite.services.databases import Databases
    from appwrite.services.storage import Storage
    from appwrite.input_file import InputFile
    from appwrite.id import ID
    APPWRITE_AVAILABLE = True
except ImportError:
    APPWRITE_AVAILABLE = False
    print("Appwrite SDK not available")

# PIL import with safe handling
try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    print("PIL/Pillow not available")

# Import the new TableExtractor
try:
    from .table_extractor import TableExtractor
    TABLE_EXTRACTOR_AVAILABLE = True
except ImportError as e:
    TABLE_EXTRACTOR_AVAILABLE = False
    print(f"TableExtractor not available: {e}")

# Try to import other components with relative imports
try:
    from .pdf_extractor import PDFExtractor
    from .markdown_generator import MarkdownGenerator
    from .storage_manager import StorageManager
    from .database_manager import DatabaseManager
    from .vision_processor import VisionProcessor
    from .pdf_processor import PDFProcessor
    from .upload_handler import UploadHandler
    COMPONENTS_AVAILABLE = True
except ImportError as e:
    COMPONENTS_AVAILABLE = False
    print(f"Some components not available: {e}")


def main(context):
    """
    Main function entry point for PDF processing and upload
    """
    try:
        # Debug logging
        context.log(f"Request method: {getattr(context.req, 'method', 'unknown')}")
        context.log(f"Request path: {context.req.path}")
        context.log(f"Request query: {getattr(context.req, 'query', {})}")
    except UnicodeDecodeError as e:
        # Handle UTF-8 decoding error that occurs when binary data is sent
        context.log(f"UTF-8 decoding error detected: {str(e)}")
        return context.res.json({
            "error": "Binary data detected in request. Please send PDF file as base64 encoded string in JSON payload.",
            "usage": {
                "method": "POST",
                "contentType": "application/json",
                "body": {
                    "file": "base64-encoded-pdf-data",
                    "filename": "document.pdf",
                    "userId": "optional-user-id"
                }
            }
        }, 400)
    except Exception as e:
        context.error(f"Unexpected error in main function: {str(e)}")
        return context.res.json({"error": f"Unexpected error: {str(e)}"}, 500)

    if context.req.path == "/ping":
        return context.res.text("Pong")
    elif context.req.path == "/upload":
        # Handle PDF upload
        if hasattr(context.req, 'method') and context.req.method != 'POST':
            return context.res.json({
                "error": "Only POST requests are supported for upload",
                "usage": {
                    "multipart": "Send POST request with multipart/form-data containing 'file' field",
                    "json": "Send POST request with JSON payload containing base64 encoded file"
                }
            }, 405)

        try:
            # Log upload attempt
            context.log("PDF upload endpoint called")

            # Check if this is a JSON payload with base64 data
            body = getattr(context.req, 'body', None)
            if body and isinstance(body, str):
                try:
                    import json
                    json_data = json.loads(body)
                    if 'file' in json_data and isinstance(json_data['file'], str):
                        context.log("Detected JSON payload with base64 encoded file")
                except json.JSONDecodeError:
                    pass

            # Use UploadHandler for clean file upload processing
            upload_handler = UploadHandler(context)
            result = upload_handler.handle_upload(context.req)

            # Return the result from UploadHandler
            if result.get("success"):
                return context.res.json(result)
            else:
                return context.res.json(result, 400)

        except Exception as e:
            context.error(f"Error in upload endpoint: {str(e)}")
            return context.res.json({
                "error": "File upload failed",
                "message": str(e),
                "type": type(e).__name__
            }, 500)
    elif context.req.path == "/process":
        # Force GET method only
        if hasattr(context.req, 'method') and context.req.method != 'GET':
            return context.res.json({
                "error": "Only GET requests are supported",
                "usage": "Use GET with query parameters: /process?documentId=XXX&fileId=XXX&bucketId=XXX"
            }, 405)

        try:
            # Check required dependencies
            if not PYPDF_AVAILABLE:
                return context.res.json({
                    "error": "PyMuPDF is required but not available",
                    "solution": "Install with: pip install PyMuPDF"
                }, 500)

            if not APPWRITE_AVAILABLE:
                return context.res.json({
                    "error": "Appwrite SDK is required but not available",
                    "solution": "Install with: pip install appwrite"
                }, 500)

            # Initialize Appwrite client
            client = Client()
            client.set_endpoint(os.environ.get('APPWRITE_ENDPOINT'))
            client.set_project(os.environ.get('APPWRITE_PROJECT_ID'))
            client.set_key(os.environ.get('APPWRITE_API_KEY'))
            databases = Databases(client)
            storage = Storage(client)

            # Use query parameters only
            query_params = getattr(context.req, 'query', {})
            document_id = query_params.get('documentId')
            file_id = query_params.get('fileId')
            bucket_id = query_params.get('bucketId', 'pdf-files')
            project_id = query_params.get('project')  # Support for dynamic project ID

            if not document_id or not file_id:
                return context.res.json({
                    "error": "Missing documentId or fileId in query parameters",
                    "usage": "Add ?documentId=XXX&fileId=XXX&bucketId=XXX to your URL",
                    "example": "https://your-function.run/process?documentId=68bae5bb003e52a6def5&fileId=1706.03762v7.pdf&bucketId=pdf-files"
                }, 400)

            # Override project ID if provided in query parameters
            if project_id:
                client.set_project(project_id)

            # Initialize processor and process document
            processor = PDFProcessor(context, client, databases, storage)
            result = processor.process_document(document_id, file_id, bucket_id)
            return context.res.json(result)
            
        except Exception as e:
            context.error(f"Error in main function: {str(e)}")
            return context.res.json({"error": str(e)}, 500)
    else:
        return context.res.json({"error": "Endpoint not found"}, 404)
