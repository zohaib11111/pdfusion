# src/pdf_processor.py
import os
from typing import Dict, List, Any
from datetime import datetime

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
    COMPONENTS_AVAILABLE = True
except ImportError as e:
    COMPONENTS_AVAILABLE = False
    print(f"Some components not available: {e}")


class PDFProcessor:
    """
    Handles PDF processing operations with enhanced table extraction
    """
    def __init__(self, context, client, databases, storage):
        self.context = context
        self.client = client
        self.databases = databases
        self.storage = storage

        # Initialize DatabaseManager - required component
        try:
            self.db_manager = DatabaseManager(databases, context)
        except Exception as e:
            context.error(f"Failed to initialize DatabaseManager: {str(e)}")
            raise Exception("DatabaseManager is required but not available")

        # Initialize StorageManager - required component
        try:
            self.storage_manager = StorageManager(storage, self.db_manager, context)
        except Exception as e:
            context.error(f"Failed to initialize StorageManager: {str(e)}")
            raise Exception("StorageManager is required but not available")

        # Initialize other components if available, otherwise use fallbacks
        if COMPONENTS_AVAILABLE:
            self.pdf_extractor = PDFExtractor(context)
            self.markdown_generator = MarkdownGenerator(context)
            self.vision_processor = VisionProcessor(context)
        else:
            # Fallback: initialize with None and handle in methods
            self.pdf_extractor = None
            self.markdown_generator = None
            self.vision_processor = None

        # Initialize table extractor
        if TABLE_EXTRACTOR_AVAILABLE:
            self.table_extractor = TableExtractor(context)
        else:
            self.table_extractor = None

    def _is_vision_configured(self):
        """Check if Google Vision API is configured"""
        return os.environ.get('GOOGLE_VISION_CREDENTIALS') is not None

    def process_document(self, document_id: str, file_id: str, bucket_id: str) -> Dict[str, Any]:
        """
        Main processing pipeline
        """
        try:
            # Set processing start timestamp and update status to processing
            processing_started = datetime.utcnow().isoformat()
            self._update_document_status(document_id, status='processing', processingStarted=processing_started)

            # Ensure images collection exists
            self.db_manager.ensure_images_collection_exists()

            # Download PDF file
            pdf_data = self.storage.get_file_download(bucket_id, file_id)

            # Extract content from PDF
            extracted_data = self._extract_pdf_content(pdf_data)

            # Process images with OCR if Vision API is available
            if self.vision_processor:
                extracted_data = self.vision_processor.process_images_with_ocr(extracted_data)

            # Get document to retrieve user_id for image deduplication
            document = self.db_manager.get_document(document_id)
            user_id = document.get('userId') if document else None

            # Always use document_id as a fallback for deduplication
            effective_user_id = user_id or document_id

             # Save extracted images to storage with deduplication
            image_urls = self._save_images_to_storage(extracted_data.get('images', []), document_id, bucket_id, effective_user_id)

            # Remove image data from extracted_data to avoid serialization issues
            if 'images' in extracted_data:
                for image in extracted_data['images']:
                    if 'data' in image:
                        del image['data']

            # Sanitize table data to handle None values
            if 'tables' in extracted_data:
                for table in extracted_data['tables']:
                    if 'parsed_data' in table and table['parsed_data']:
                        for row in table['parsed_data']:
                            if row:
                                for i, cell in enumerate(row):
                                    if cell is None:
                                        row[i] = ''

            # Generate Markdown
            markdown_content = self._generate_markdown(extracted_data, image_urls)

            # Set processing completion timestamp
            processing_completed = datetime.utcnow().isoformat()

            # Update document with results
            update_data = {
                'processingCompleted': processing_completed,
                'markdownContent': markdown_content,
                'imageIds': [img['id'] for img in image_urls],
                'tableCount': len(extracted_data.get('tables', [])),
                'errorMessage': None
            }

            # Combine status with other update data
            update_data_with_status = {'status': 'completed', **update_data}
            self._update_document_status(document_id, **update_data_with_status)
            self.context.log("Document processing completed successfully")

            return {
                'success': True,
                'documentId': document_id,
                'markdownContent': markdown_content,
                'images': image_urls,
                'pageCount': len(extracted_data.get('text', [])),
                'imageCount': len(image_urls)
            }

        except Exception as e:
            # Handle processing failure
            processing_completed = datetime.utcnow().isoformat()
            self._update_document_status(
                document_id, status='failed',
                processingCompleted=processing_completed,
                errorMessage=str(e)
            )
            raise e

    def _extract_pdf_content(self, pdf_data: bytes) -> Dict[str, Any]:
        """
        Extract text, images, and tables from PDF
        """
        try:
            # Use PDFExtractor if available, otherwise fallback to original method
            if self.pdf_extractor:
                extracted_data = self.pdf_extractor.extract_content(pdf_data)
            else:
                extracted_data = self._extract_pdf_content_fallback(pdf_data)

            # Extract tables using enhanced table extractor if available
            if self.table_extractor:
                try:
                    tables = self.table_extractor.extract_tables_from_pdf(pdf_data)
                    # Sanitize table data to handle None values
                    for table in tables:
                        if 'parsed_data' in table and table['parsed_data']:
                            for row in table['parsed_data']:
                                if row:
                                    for i, cell in enumerate(row):
                                        if cell is None:
                                            row[i] = ''
                    extracted_data['tables'] = tables
                    self.context.log(f"Extracted {len(tables)} tables using enhanced table detection")
                except Exception as e:
                    self.context.error(f"Table extraction failed: {str(e)}")
                    # Fallback to text-based table detection
                    extracted_data['tables'] = self._extract_tables_from_text(extracted_data.get('text', []))
            else:
                # Fallback to text-based table detection
                extracted_data['tables'] = self._extract_tables_from_text(extracted_data.get('text', []))

            self.context.log(f"Extracted {len(extracted_data['text'])} pages, "
                            f"{len(extracted_data['images'])} images, "
                            f"{len(extracted_data['tables'])} tables")

            return extracted_data

        except Exception as e:
            self.context.error(f"PDF extraction failed: {str(e)}")
            # Return empty structure instead of raising
            return {
                'text': [],
                'images': [],
                'tables': []
            }

    def _extract_pdf_content_fallback(self, pdf_data: bytes) -> Dict[str, Any]:
        """
        Fallback PDF extraction method (original implementation)
        """
        try:
            doc = fitz.open(stream=pdf_data, filetype="pdf")
            extracted_data = {
                'text': [],
                'images': [],
                'tables': []
            }

            for page_num in range(len(doc)):
                page = doc.load_page(page_num)

                # Extract text
                text = page.get_text()
                extracted_data['text'].append({
                    'page': page_num + 1,
                    'content': text
                })

                # Extract images
                image_list = page.get_images(full=True)
                for img_index, img in enumerate(image_list):
                    xref = img[0]
                    try:
                        base_image = doc.extract_image(xref)
                        if base_image and base_image.get("image"):
                            image_bytes = base_image["image"]
                            extracted_data['images'].append({
                                'page': page_num + 1,
                                'index': img_index,
                                'data': image_bytes,
                                'ext': base_image.get("ext", "png"),
                                'width': base_image.get("width", 0),
                                'height': base_image.get("height", 0)
                            })
                    except Exception as e:
                        self.context.error(f"Failed to extract image {xref}: {str(e)}")

                self.context.log(f"Page {page_num + 1}: Extracted {len(image_list)} images")

            doc.close()
            return extracted_data

        except Exception as e:
            self.context.error(f"PDF extraction failed: {str(e)}")
            return {
                'text': [],
                'images': [],
                'tables': []
            }

    def _extract_tables_from_text(self, text_blocks: List[Dict]) -> List[Dict]:
        """
        Fallback text-based table detection
        """
        tables = []
        for text_block in text_blocks:
            text = text_block['content']
            page_num = text_block['page']
            lines = text.split('\n')

            i = 0
            while i < len(lines):
                line = lines[i].strip()

                # Check if this line starts a table
                is_table_start = False
                table_title = ""

                if 'Table ' in line and ':' in line:
                    is_table_start = True
                    table_title = line

                if is_table_start:
                    table_lines = []
                    table_data = []
                    j = i + 1

                    # Look for table content
                    while j < len(lines) and j < i + 20:
                        next_line = lines[j].strip()

                        if (next_line.startswith('Table ') or
                            next_line.startswith('Figure ') or
                            next_line.startswith('# ') or
                            (not next_line and len(table_lines) > 0)):
                            break

                        if next_line:
                            table_lines.append(next_line)
                            parts = next_line.split()
                            # Replace None values with empty strings
                            parts = [str(part) if part is not None else '' for part in parts]
                            if len(parts) >= 2:
                                table_data.append(parts)

                        j += 1

                    if table_data:
                        tables.append({
                            'page': page_num,
                            'title': table_title,
                            'content': table_lines,
                            'parsed_data': table_data,
                            'raw_text': '\n'.join(table_lines),
                            'rows': len(table_data),
                            'columns': len(table_data[0]) if table_data else 0
                        })

                    i = j
                else:
                    i += 1

        return tables

    def _generate_markdown(self, extracted_data: Dict[str, Any], image_urls: List[Dict] = None) -> str:
        """
        Generate Markdown from extracted content
        """
        if self.markdown_generator:
            return self.markdown_generator.generate(extracted_data, image_urls)
        else:
            # Fallback markdown generation
            return self._generate_markdown_fallback(extracted_data, image_urls)

    def _generate_markdown_fallback(self, extracted_data: Dict[str, Any], image_urls: List[Dict] = None) -> str:
        """
        Fallback markdown generation (original implementation)
        """
        markdown_parts = []
        markdown_parts.append("# Extracted PDF Content\n")

        # Add text content
        for text_block in extracted_data.get('text', []):
            if text_block['content'].strip():
                markdown_parts.append(f"## Page {text_block['page']}\n")
                content = text_block['content'].replace('\n\n', '  \n')
                markdown_parts.append(content)
                markdown_parts.append("\n---\n")

        # Add tables
        if extracted_data.get('tables'):
            markdown_parts.append("## Extracted Tables\n")
            for i, table in enumerate(extracted_data['tables']):
                markdown_parts.append(f"### {table.get('title', f'Table {i+1}')}\n")
                markdown_parts.append(f"*From Page {table.get('page', 'N/A')}*\n")

                if len(table.get('parsed_data', [])) > 1:
                    headers = table['parsed_data'][0]
                    data_rows = table['parsed_data'][1:]

                    markdown_parts.append("| " + " | ".join(headers) + " |")
                    markdown_parts.append("|" + "---|" * len(headers))

                    for row in data_rows[:10]:
                        if len(row) == len(headers):
                            # Convert all cells to strings and handle None values
                            escaped_row = [str(cell) if cell is not None else '' for cell in row]
                            escaped_row = [cell.replace('|', '\\|') for cell in escaped_row]
                            markdown_parts.append("| " + " | ".join(escaped_row) + " |")

                markdown_parts.append("\n```")
                markdown_parts.append(table.get('raw_text', ''))
                markdown_parts.append("```\n")

        # Add images
        if extracted_data.get('images') and image_urls:
            markdown_parts.append("## Images\n")
            for i, image in enumerate(extracted_data['images']):
                if i < len(image_urls):
                    url = image_urls[i]['url']
                    caption = f"Image {i+1} from Page {image['page']}"
                    if image.get('ocr_text'):
                        caption += f" - OCR: {image['ocr_text'][:100]}..."
                    markdown_parts.append(f"![{caption}]({url})")
                    markdown_parts.append(f"*{caption}*\n")

        return "\n".join(markdown_parts)

    def _save_images_to_storage(self, images: List[Dict], document_id: str, bucket_id: str, effective_user_id: str = None) -> List[Dict]:
        """
        Save images to Appwrite storage using StorageManager
        """
        # Use StorageManager to save images
        return self.storage_manager.save_images(images, document_id, bucket_id, effective_user_id)

    def _update_document_status(self, document_id: str, **kwargs):
        """
        Update document status in database using DatabaseManager
        """
        self.db_manager.update_document_status(document_id, **kwargs)

    def _generate_markdown_table(self, table: Dict) -> str:
        """
        Generate markdown table from parsed table data
        """
        parsed_data = table.get('parsed_data', [])
        if not parsed_data:
            return table.get('raw_text', '')

        md_lines = []

        if len(parsed_data) > 1:
            headers = parsed_data[0]
            rows = parsed_data[1:]

            md_lines.append("| " + " | ".join([str(h) for h in headers]) + " |")
            md_lines.append("|" + "---|" * len(headers))

            for row in rows[:20]:
                if len(row) == len(headers):
                    escaped_row = [str(cell).replace('|', '\\|') for cell in row]
                    md_lines.append("| " + " | ".join(escaped_row) + " |")
        else:
            row = parsed_data[0]
            md_lines.append("| " + " | ".join([str(cell) for cell in row]) + " |")

        return "\n".join(md_lines)

    def _combine_extracted_text(self, text_blocks: List[Dict]) -> str:
        """Combine all extracted text blocks"""
        return "\n\n".join([
            text_block['content'] for text_block in text_blocks
            if text_block['content'].strip()
        ])
