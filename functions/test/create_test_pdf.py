# create_test_pdf.py
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors

def create_test_pdf():
    """Create a simple PDF with a table for testing"""
    doc = SimpleDocTemplate("test_document.pdf", pagesize=letter)
    elements = []
    
    styles = getSampleStyleSheet()
    
    # Add some text
    elements.append(Paragraph("Test Document with Tables", styles['Title']))
    elements.append(Paragraph("This is a test PDF document containing tables.", styles['Normal']))
    
    # Create a simple table
    data = [
        ['Name', 'Age', 'City'],
        ['John Doe', '30', 'New York'],
        ['Jane Smith', '25', 'London'],
        ['Bob Johnson', '35', 'Tokyo']
    ]
    
    table = Table(data)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 14),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    
    elements.append(table)
    
    # Build PDF
    doc.build(elements)
    print("Created test_document.pdf with a simple table")

if __name__ == "__main__":
    create_test_pdf()