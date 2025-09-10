# src/vision_processor.py
import os
from typing import Dict, List, Any

class VisionProcessor:
    """Handles Google Vision OCR processing"""
    
    def __init__(self, context=None):
        self.context = context
        self.vision_client = self._initialize_vision_client()
    
    def _initialize_vision_client(self):
        """Initialize Google Vision client if available"""
        try:
            from google.cloud import vision
            if os.environ.get('GOOGLE_VISION_CREDENTIALS'):
                return vision.ImageAnnotatorClient()
        except ImportError:
            pass
        return None
    
    def _log(self, message: str):
        if self.context:
            self.context.log(message)
    
    def _error(self, message: str):
        if self.context:
            self.context.error(message)
    
    def process_images_with_ocr(self, extracted_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process images with Google Vision OCR
        """
        if not self.vision_client:
            return extracted_data
            
        for image in extracted_data.get('images', []):
            try:
                vision_image = self.vision_client.image(content=image['data'])
                response = self.vision_client.text_detection(image=vision_image)
                texts = response.text_annotations
                if texts:
                    image['ocr_text'] = texts[0].description
                else:
                    image['ocr_text'] = ''
            except Exception as e:
                self._error(f"OCR failed for image: {str(e)}")
                image['ocr_text'] = ''
        
        return extracted_data