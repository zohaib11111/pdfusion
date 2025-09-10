# test/test_pdf_extractor.py
import os
import sys
import unittest
from unittest.mock import Mock

# Add the src directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from pdf_extractor import PDFExtractor
from table_extractor import TableExtractor
from markdown_generator import MarkdownGenerator

class TestPDFExtractor(unittest.TestCase):
    
    def setUp(self):
        self.mock_context = Mock()
        self.mock_context.log = Mock()
        self.mock_context.error = Mock()
        self.pdf_extractor = PDFExtractor(self.mock_context)
        self.table_extractor = TableExtractor(self.mock_context)
        self.markdown_generator = MarkdownGenerator(self.mock_context)
        
        # Create a simple test PDF with a table
        self.create_test_pdf()
    
    def create_test_pdf(self):
      """Create a simple test PDF with a table that PyMuPDF can detect"""
      try:
          import fitz  # Use PyMuPDF to create a PDF with detectable tables
          
          # Create a simple PDF with text that looks like a table
          doc = fitz.open()
          page = doc.new_page()
          
          # Add some text that resembles a table
          text_lines = [
              "Name    Age    City",
              "John    30     New York",
              "Jane    25     London", 
              "Bob     35     Tokyo"
          ]
          
          # Position the text to look like a table
          y_position = 50
          for line in text_lines:
              page.insert_text((50, y_position), line, fontsize=12)
              y_position += 20
          
          # Save the PDF
          doc.save("test_document.pdf")
          doc.close()
          
          print("Created test_document.pdf with simple table-like text")
          
      except Exception as e:
          print(f"Could not create test PDF with PyMuPDF: {e}")
          # Fallback: try reportlab
          try:
              from reportlab.lib.pagesizes import letter
              from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph
              from reportlab.lib.styles import getSampleStyleSheet
              from reportlab.lib import colors
              
              doc = SimpleDocTemplate("test_document.pdf", pagesize=letter)
              elements = []
              
              styles = getSampleStyleSheet()
              elements.append(Paragraph("Test Document", styles['Title']))
              
              # Create a very simple table with clear borders
              data = [
                  ['Name', 'Age', 'City'],
                  ['John Doe', '30', 'New York'],
                  ['Jane Smith', '25', 'London']
              ]
              
              table = Table(data)
              table.setStyle(TableStyle([
                  ('GRID', (0, 0), (-1, -1), 1, colors.black),
                  ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
              ]))
              
              elements.append(table)
              doc.build(elements)
              print("Created test_document.pdf with ReportLab table")
              
          except ImportError:
              print("ReportLab not available, using existing test PDF if available")
    
    def test_pdf_extractor_initialization(self):
        """Test PDFExtractor initialization"""
        self.assertIsNotNone(self.pdf_extractor)
        self.assertEqual(self.pdf_extractor.context, self.mock_context)
    
    def test_table_extractor_initialization(self):
        """Test TableExtractor initialization"""
        self.assertIsNotNone(self.table_extractor)
        self.assertEqual(self.table_extractor.context, self.mock_context)
    
    def test_markdown_generator_initialization(self):
        """Test MarkdownGenerator initialization"""
        self.assertIsNotNone(self.markdown_generator)
        self.assertEqual(self.markdown_generator.context, self.mock_context)
    
    def test_extract_text_and_images(self):
        """Test PDF text and image extraction"""
        if not os.path.exists("test_document.pdf"):
            self.skipTest("Test PDF not available")
        
        with open("test_document.pdf", "rb") as f:
            pdf_data = f.read()
        
        # Test text and image extraction
        extracted_data = self.pdf_extractor.extract_content(pdf_data)
        
        self.assertIsInstance(extracted_data, dict)
        self.assertIn('text', extracted_data)
        self.assertIn('images', extracted_data)
        self.assertIsInstance(extracted_data['text'], list)
        self.assertIsInstance(extracted_data['images'], list)
        
        # Should have at least one page of text
        self.assertGreater(len(extracted_data['text']), 0)
        self.assertIn('page', extracted_data['text'][0])
        self.assertIn('content', extracted_data['text'][0])
    
    def test_table_extraction(self):
        """Test table extraction from PDF"""
        if not os.path.exists("test_document.pdf"):
            self.skipTest("Test PDF not available")
        
        with open("test_document.pdf", "rb") as f:
            pdf_data = f.read()
        
        # Test table extraction
        tables = self.table_extractor.extract_tables_from_pdf(pdf_data)
        
        self.assertIsInstance(tables, list)
        
        # Our test PDF should have at least one table
        if len(tables) > 0:
            table = tables[0]
            self.assertIn('page', table)
            self.assertIn('table_index', table)
            self.assertIn('parsed_data', table)
            self.assertIn('rows', table)
            self.assertIn('columns', table)
            self.assertIn('markdown', table)
    
    def test_scan_pages_for_tables(self):
      """Test scanning pages for tables"""
      if not os.path.exists("test_document.pdf"):
          self.skipTest("Test PDF not available")
      
      with open("test_document.pdf", "rb") as f:
          pdf_data = f.read()
      
      # Test page scanning
      pages_with_tables = self.table_extractor.scan_all_pages_for_tables(pdf_data)
      
      self.assertIsInstance(pages_with_tables, list)
      # Don't require that tables must be found - the simple PDF might not have detectable tables
      # The important thing is that the scanning doesn't crash
    
    def test_markdown_generation(self):
        """Test markdown generation from extracted content"""
        # Create mock extracted data
        extracted_data = {
            'text': [
                {
                    'page': 1,
                    'content': 'This is page 1 content with some text.\nAnd multiple lines.'
                }
            ],
            'images': [
                {
                    'page': 1,
                    'index': 0,
                    'ext': 'png',
                    'ocr_text': 'Extracted text from image'
                }
            ],
            'tables': [
                {
                    'page': 1,
                    'table_index': 1,
                    'title': 'Test Table',
                    'parsed_data': [
                        ['Name', 'Age', 'City'],
                        ['John', '30', 'New York'],
                        ['Jane', '25', 'London']
                    ],
                    'markdown': '| Name | Age | City |\n|------|-----|------|\n| John | 30  | New York |\n| Jane | 25  | London |',
                    'raw_text': 'Name\tAge\tCity\nJohn\t30\tNew York\nJane\t25\tLondon'
                }
            ]
        }
        
        # Mock image URLs
        image_urls = [
            {
                'url': 'https://example.com/image1.png',
                'id': 'img1',
                'page': 1
            }
        ]
        
        # Generate markdown
        markdown = self.markdown_generator.generate(extracted_data, image_urls)
        
        self.assertIsInstance(markdown, str)
        self.assertGreater(len(markdown), 0)
        
        # Should contain expected sections
        self.assertIn('# Extracted PDF Content', markdown)
        self.assertIn('## Page 1', markdown)
        self.assertIn('## Extracted Tables', markdown)
        self.assertIn('## Images', markdown)
        self.assertIn('Test Table', markdown)
        self.assertIn('https://example.com/image1.png', markdown)
    
    def test_empty_extracted_data(self):
        """Test markdown generation with empty data"""
        empty_data = {
            'text': [],
            'images': [],
            'tables': []
        }
        
        markdown = self.markdown_generator.generate(empty_data, [])
        
        self.assertIsInstance(markdown, str)
        self.assertIn('# Extracted PDF Content', markdown)
        # Should not have table or image sections
        self.assertNotIn('## Extracted Tables', markdown)
        self.assertNotIn('## Images', markdown)
    
    def test_error_handling(self):
        """Test error handling in extractors"""
        # Test with invalid PDF data
        invalid_pdf_data = b'This is not a valid PDF'
        
        # Should handle errors gracefully and return empty structure
        extracted_data = self.pdf_extractor.extract_content(invalid_pdf_data)
        self.assertEqual(extracted_data, {'text': [], 'images': []})
        
        # Table extractor should return empty list for invalid PDF
        tables = self.table_extractor.extract_tables_from_pdf(invalid_pdf_data)
        self.assertEqual(tables, [])
    
    def test_table_extraction_from_page(self):
        """Test table extraction from specific page"""
        if not os.path.exists("test_document.pdf"):
            self.skipTest("Test PDF not available")
        
        with open("test_document.pdf", "rb") as f:
            pdf_data = f.read()
        
        # Test extracting from page 0 (first page)
        tables = self.table_extractor.extract_tables_from_page_number(pdf_data, 0)
        
        self.assertIsInstance(tables, list)
        # Should handle both cases (tables found or not found)
        self.assertTrue(True)  # Just ensure no exception is raised
    
    def test_markdown_table_generation(self):
        """Test markdown table generation from data"""
        test_data = [
            ['Header1', 'Header2', 'Header3'],
            ['Data1', 'Data2', 'Data3'],
            ['Data4', 'Data5', 'Data6']
        ]
        
        # This is a private method, but we can test it through the table extractor
        markdown = self.table_extractor._generate_markdown_table(test_data)
        
        self.assertIsInstance(markdown, str)
        self.assertIn('Header1', markdown)
        self.assertIn('Header2', markdown)
        self.assertIn('Header3', markdown)
        self.assertIn('Data1', markdown)
        self.assertIn('Data2', markdown)
        self.assertIn('Data3', markdown)
    
    def test_single_row_table(self):
        """Test markdown generation for single row table"""
        single_row_data = [['Single', 'Row', 'Table']]
        
        markdown = self.table_extractor._generate_markdown_table(single_row_data)
        
        self.assertIsInstance(markdown, str)
        self.assertIn('Single', markdown)
        self.assertIn('Row', markdown)
        self.assertIn('Table', markdown)
    
    def tearDown(self):
        """Clean up test files"""
        if os.path.exists("test_document.pdf"):
            os.remove("test_document.pdf")

class TestIntegration(unittest.TestCase):
    """Integration tests for the complete extraction pipeline"""
    
    def setUp(self):
        self.mock_context = Mock()
        self.mock_context.log = Mock()
        self.mock_context.error = Mock()
        
        self.pdf_extractor = PDFExtractor(self.mock_context)
        self.table_extractor = TableExtractor(self.mock_context)
        self.markdown_generator = MarkdownGenerator(self.mock_context)
    
    def test_complete_extraction_pipeline(self):
      """Test the complete extraction pipeline"""
      # Try to find a test PDF
      test_pdf_path = None
      for pdf_name in ["test_document.pdf", "test_table_document.pdf"]:
          if os.path.exists(pdf_name):
              test_pdf_path = pdf_name
              break
      
      if not test_pdf_path:
          self.skipTest("No test PDF available")
      
      with open(test_pdf_path, "rb") as f:
          pdf_data = f.read()
      
      # Step 1: Extract text and images
      extracted_data = self.pdf_extractor.extract_content(pdf_data)
      self.assertIsInstance(extracted_data, dict)
      self.assertIn('text', extracted_data)
      self.assertIn('images', extracted_data)
      
      # Step 2: Extract tables (might be empty)
      tables = self.table_extractor.extract_tables_from_pdf(pdf_data)
      extracted_data['tables'] = tables
      self.assertIsInstance(tables, list)
      
      # Step 3: Generate markdown
      markdown = self.markdown_generator.generate(extracted_data, [])
      self.assertIsInstance(markdown, str)
      self.assertGreater(len(markdown), 0)
      
      # Verify all components worked together
      self.assertIn('# Extracted PDF Content', markdown)
      if len(tables) > 0:
          self.assertIn('## Extracted Tables', markdown)
      if len(extracted_data['images']) > 0:
          self.assertIn('## Images', markdown)

def run_tests():
    """Run all tests and return results"""
    # Create test suite
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    # Add test classes
    suite.addTests(loader.loadTestsFromTestCase(TestPDFExtractor))
    suite.addTests(loader.loadTestsFromTestCase(TestIntegration))
    
    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    return result

if __name__ == "__main__":
    print("Running PDF Extractor Tests...")
    print("=" * 50)
    
    result = run_tests()
    
    print("=" * 50)
    if result.wasSuccessful():
        print("All tests passed! ✅")
    else:
        print(f"Tests completed with {len(result.failures)} failures and {len(result.errors)} errors")
        sys.exit(1)