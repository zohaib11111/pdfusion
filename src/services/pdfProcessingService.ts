// This is needed to find the global objects from the CDN scripts
declare const pdfjsLib: any;
declare const Tesseract: any;

// Debug flag for production environments
const DEBUG = false;

export interface ExtractionStats {
    totalPages: number;
    imagesDetected: number;
    imagesExtracted: number;
    pagesWithOcr: number;
    tablesConverted: number;
}

export interface ExtractionResult {
  fullText: string;
  stats: ExtractionStats;
  images: string[];
  tables: ExtractedTable[];
}

export interface ProcessingProgress {
  message: string;
  step: number;
  totalSteps: number;
}

/**
 * Initializes the PDF.js worker.
 */
const initializePdfJs = () => {
    if (typeof pdfjsLib !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    } else {
        throw new Error("PDF.js library is not loaded. Please check the script tags in your HTML file.");
    }
};

/**
 * Extracts standard text content from a single PDF page.
 * @param page A pdf.js page object.
 * @returns The extracted text as a single string.
 */
const getTextContentFromPage = async (page: any): Promise<string> => {
    const textContent = await page.getTextContent();
    return textContent.items.map((item: any) => item.str).join(' ');
};

/**
 * Extracts embedded images from a single PDF page.
 * @param page A pdf.js page object.
 * @returns An object containing an array of base64 image data URLs and the count of detected images.
 */
const extractImagesFromPage = async (page: any): Promise<{ images: string[], detectedCount: number }> => {
    const operatorList = await page.getOperatorList();
    const extractedImages: string[] = [];
    const processedImages = new Set();

    // Look for various image operations
    const imageArgs: string[] = [];
    for (let opIdx = 0; opIdx < operatorList.fnArray.length; opIdx++) {
        const op = operatorList.fnArray[opIdx];
        const args = operatorList.argsArray[opIdx];

        // Check for different image operations
        if (op === pdfjsLib.OPS.paintImageXObject ||
            op === pdfjsLib.OPS.paintInlineImageXObject ||
            op === pdfjsLib.OPS.paintImageMaskXObject) {
            if (args && args[0]) {
                imageArgs.push(args[0]);
            }
        }
    }

    const uniqueImageArgs = [...new Set(imageArgs)];
    if (DEBUG) console.log(`Page ${page.pageNumber}: Found ${uniqueImageArgs.length} unique image references:`, uniqueImageArgs);

    for (const arg of uniqueImageArgs) {
        if (processedImages.has(arg)) continue;
        processedImages.add(arg);

        try {
            const img = await page.objs.get(arg);
            if (!img) {
                console.warn(`Image object ${arg} not found in page ${page.pageNumber}`);
                continue;
            }

            if (!img.width || !img.height) {
                console.warn(`Image object ${arg} missing width/height:`, img);
                continue;
            }

            const { width, height, bitmap } = img;
            if (DEBUG) console.log(`Processing image ${arg}: ${width}x${height}, has bitmap: ${!!bitmap}, has data: ${!!img.data}`);

            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
                console.warn(`Could not get canvas context for image ${arg}`);
                continue;
            }

            let success = false;

            // Handle ImageBitmap (newer PDF.js versions)
            if (bitmap && bitmap instanceof ImageBitmap) {
                if (DEBUG) console.log(`Drawing ImageBitmap for ${arg}`);
                ctx.drawImage(bitmap, 0, 0, width, height);
                success = true;
            }
            // Handle raw pixel data (older PDF.js versions)
            else if (img.data) {
                const { kind, data } = img;
                if (DEBUG) console.log(`Processing raw data for ${arg}, kind: ${kind}, data length: ${data.length}`);

                const imageData = ctx.createImageData(width, height);
                const pixels = imageData.data;

                if (kind === pdfjsLib.ImageKind.RGB_24BPP) {
                    if (data.length === width * height * 3) {
                        let j = 0;
                        for (let k = 0; k < data.length; k += 3) {
                            pixels[j++] = data[k];     // R
                            pixels[j++] = data[k + 1]; // G
                            pixels[j++] = data[k + 2]; // B
                            pixels[j++] = 255;         // A
                        }
                        ctx.putImageData(imageData, 0, 0);
                        success = true;
                    }
                } else if (kind === pdfjsLib.ImageKind.RGBA_32BPP) {
                    if (data.length === width * height * 4) {
                        pixels.set(data);
                        ctx.putImageData(imageData, 0, 0);
                        success = true;
                    }
                } else if (kind === pdfjsLib.ImageKind.GRAYSCALE_8BPP) {
                    if (data.length === width * height) {
                        let j = 0;
                        for (let k = 0; k < data.length; k++) {
                            const gray = data[k];
                            pixels[j++] = gray; // R
                            pixels[j++] = gray; // G
                            pixels[j++] = gray; // B
                            pixels[j++] = 255; // A
                        }
                        ctx.putImageData(imageData, 0, 0);
                        success = true;
                    }
                }
            } else {
                console.warn(`Image ${arg} has neither bitmap nor data:`, img);
            }

            if (success) {
                const dataURL = canvas.toDataURL('image/png');
                extractedImages.push(dataURL);
                if (DEBUG) console.log(`Successfully extracted image ${arg} from page ${page.pageNumber}`);
            } else {
                if (DEBUG) console.warn(`Failed to process image ${arg}`);
            }
        } catch(e) {
            console.warn(`Could not extract image ${arg} from page ${page.pageNumber}:`, e);
        }
    }

    if (DEBUG) console.log(`Page ${page.pageNumber}: Extracted ${extractedImages.length} images out of ${uniqueImageArgs.length} detected`);
    return { images: extractedImages, detectedCount: uniqueImageArgs.length };
};

/**
 * Renders a PDF page to a canvas and performs OCR with enhanced options.
 * @param page A pdf.js page object.
 * @param worker A Tesseract.js worker instance.
 * @returns Object containing OCR text and TSV data for layout analysis.
 */
const performOcrOnPage = async (page: any, worker: any): Promise<{ text: string, tsv: string }> => {
    const viewport = page.getViewport({ scale: 3 }); // Higher scale for better OCR quality
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    if (context) {
        await page.render({ canvasContext: context, viewport: viewport }).promise;
        const { data } = await worker.recognize(canvas, 'eng', {
            tessjs_create_tsv: true
        });
        return {
            text: data.text.trim(),
            tsv: data.tsv
        };
    }
    return { text: '', tsv: '' };
};

/**
 * Extracts text with detailed positions from a PDF page.
 * @param page A pdf.js page object.
 * @returns An array of text items with positions and styling information.
 */
const extractTextWithPositions = async (page: any) => {
  const content = await page.getTextContent();
  const viewport = page.getViewport({ scale: 1 });
  
  // Check page rotation to handle coordinate system properly
  const pageRotation = page.pageInfo?.rotate || 0;
  const isRotated = pageRotation === 90 || pageRotation === 270;

  return content.items
    .filter((item: any) => item.str && item.str.trim().length > 0) // Filter out empty items
    .map((item: any) => {
      // Transform coordinates to normalized page coordinates
      const transform = item.transform;
      const x = transform[4];
      const y = isRotated ? x : viewport.height - transform[5]; // Flip Y coordinate for normal orientation
      
      return {
        str: item.str.trim(),
        x: Math.round(x * 100) / 100,
        y: Math.round(y * 100) / 100,
        width: item.width || 0,
        height: item.height || 0,
        fontSize: Math.abs(transform[0]) || 12, // Font size from transform matrix
        fontName: item.fontName || ''
      };
    })
    .sort((a: any, b: any) => {
      // Sort by Y position first (top to bottom), then by X position (left to right)
      const yDiff = b.y - a.y; // Descending Y (top to bottom)
      if (Math.abs(yDiff) > 5) { // If items are on different lines (5pt threshold)
        return yDiff;
      }
      return a.x - b.x; // Same line, sort left to right
    });
};

/**
 * Groups text items into logical rows based on Y position.
 * @param items Array of text items with positions.
 * @returns Array of rows, where each row is an array of text items.
 */
const groupIntoRows = (items: any[]): any[][] => {
  if (items.length === 0) return [];
  
  const rows: any[][] = [];
  let currentRow: any[] = [];
  let currentY: number | null = null;
  
  for (const item of items) {
    // Use font size to determine if items are on the same line
    const lineThreshold = Math.max(item.fontSize * 0.7, 8); // Adaptive threshold
    
    if (currentY === null || Math.abs(item.y - currentY) <= lineThreshold) {
      // Same row
      currentRow.push(item);
      currentY = currentY === null ? item.y : (currentY + item.y) / 2; // Average Y position
    } else {
      // New row
      if (currentRow.length > 0) {
        // Sort current row left to right
        currentRow.sort((a, b) => a.x - b.x);
        rows.push(currentRow);
      }
      currentRow = [item];
      currentY = item.y;
    }
  }
  
  // Don't forget the last row
  if (currentRow.length > 0) {
    currentRow.sort((a, b) => a.x - b.x);
    rows.push(currentRow);
  }
  
  return rows;
};

/**
 * Analyzes column structure to determine if rows form a table.
 * @param rows Array of rows to analyze.
 * @returns Object with analysis results.
 */
const analyzeTableStructure = (rows: any[][]) => {
  if (rows.length < 2) {
    return { isTable: false, reason: 'Insufficient rows' };
  }
  
  // Calculate column positions for each row
  const rowColumnInfo = rows.map(row => ({
    count: row.length,
    positions: row.map(item => item.x),
    avgSpacing: row.length > 1 ? (row[row.length - 1].x - row[0].x) / (row.length - 1) : 0
  }));
  
  // Check for consistent column counts
  const columnCounts = rowColumnInfo.map(info => info.count);
  const avgColumns = columnCounts.reduce((a, b) => a + b, 0) / columnCounts.length;
  const columnVariance = columnCounts.reduce((sum, count) => sum + Math.pow(count - avgColumns, 2), 0) / columnCounts.length;
  
  // Tables should have relatively consistent column counts
  if (avgColumns < 2) {
    return { isTable: false, reason: 'Too few columns on average' };
  }
  
  if (columnVariance > 2) {
    return { isTable: false, reason: 'Inconsistent column count' };
  }
  
  // Check for alignment patterns
  const allPositions = rowColumnInfo.flatMap(info => info.positions);
  allPositions.sort((a, b) => a - b);
  
  // Group similar X positions (column alignment)
  const positionGroups: number[][] = [];
  const alignmentThreshold = 20; // 20 points tolerance for alignment
  
  for (const pos of allPositions) {
    let addedToGroup = false;
    for (const group of positionGroups) {
      if (group.some(groupPos => Math.abs(pos - groupPos) <= alignmentThreshold)) {
        group.push(pos);
        addedToGroup = true;
        break;
      }
    }
    if (!addedToGroup) {
      positionGroups.push([pos]);
    }
  }
  
  // Calculate alignment score
  const alignmentScore = positionGroups.length >= 2 ? 
    positionGroups.reduce((sum, group) => sum + group.length, 0) / allPositions.length : 0;
  
  // Check for table indicators
  const hasMultipleAlignedColumns = positionGroups.length >= 2;
  const hasConsistentStructure = columnVariance <= 1;
  const hasGoodAlignment = alignmentScore >= 0.6;
  
  if (DEBUG) {
    console.log('Table analysis:', {
      avgColumns,
      columnVariance,
      alignmentScore,
      positionGroups: positionGroups.length,
      hasMultipleAlignedColumns,
      hasConsistentStructure,
      hasGoodAlignment
    });
  }
  
  const isTable = hasMultipleAlignedColumns && (hasConsistentStructure || hasGoodAlignment);
  
  return {
    isTable,
    reason: isTable ? 'Table structure detected' : 'No clear table structure',
    confidence: (alignmentScore + (hasConsistentStructure ? 0.3 : 0) + (hasMultipleAlignedColumns ? 0.2 : 0))
  };
};

/**
 * Converts structured rows into markdown table format.
 * @param rows Array of rows to convert.
 * @returns Markdown table string.
 */
const convertRowsToMarkdown = (rows: any[][]): string => {
  if (rows.length === 0) return '';
  
  // Determine maximum number of columns
  const maxCols = Math.max(...rows.map(row => row.length));
  
  const markdownRows: string[] = [];
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    
    // Pad row to maxCols if necessary
    const paddedRow = [...row];
    while (paddedRow.length < maxCols) {
      paddedRow.push({ str: '' });
    }
    
    // Create markdown row
    const cellTexts = paddedRow.map(cell => cell.str || '').map(text => 
      text.replace(/\|/g, '\\|').trim() // Escape pipes and trim
    );
    
    markdownRows.push(`| ${cellTexts.join(' | ')} |`);
    
    // Add header separator after first row
    if (i === 0) {
      const separator = Array(maxCols).fill('---').join(' | ');
      markdownRows.push(`| ${separator} |`);
    }
  }
  
  return markdownRows.join('\n');
};

/**
 * Enhanced table inference from text items based on layout and structure.
 * @param items Array of text items with positions.
 * @returns Array of ExtractedTable objects.
 */
const inferTablesFromText = (items: any[], pageNumber: number): ExtractedTable[] => {
  if (items.length < 4) { // Need at least 4 items for a 2x2 table
    return [];
  }

  if (DEBUG) console.log(`Analyzing ${items.length} text items for tables on page ${pageNumber}`);

  // Group items into rows
  const rows = groupIntoRows(items);

  if (DEBUG) console.log(`Found ${rows.length} rows`);

  // Look for table structures in different sections of the page
  const tables: ExtractedTable[] = [];
  let startIdx = 0;

  while (startIdx < rows.length) {
    // Try to find a table starting from current position
    let bestTable = null;
    let bestEndIdx = startIdx;

    // Try different table lengths
    for (let endIdx = startIdx + 2; endIdx <= Math.min(rows.length, startIdx + 20); endIdx++) {
      const candidateRows = rows.slice(startIdx, endIdx);
      const analysis = analyzeTableStructure(candidateRows);

      if (analysis.isTable && (!bestTable || analysis.confidence > bestTable.confidence)) {
        bestTable = {
          rows: candidateRows,
          analysis,
          endIdx
        };
        bestEndIdx = endIdx;
      }
    }

    if (bestTable && bestTable.analysis.confidence > 0.5) {
      // Found a good table
      const markdown = convertRowsToMarkdown(bestTable.rows);
      if (markdown) {
        tables.push({
          caption: `Table from page ${pageNumber}`,
          markdown,
          pageNumber,
          confidence: bestTable.analysis.confidence
        });

        if (DEBUG) console.log(`Found table with confidence ${bestTable.analysis.confidence}`);
      }
      startIdx = bestEndIdx;
    } else {
      startIdx++;
    }
  }

  return tables;
};

/**
 * Parses TSV data from Tesseract OCR to extract word positions and layout information.
 * @param tsvString The TSV string from Tesseract.
 * @returns Array of word objects with position data.
 */
const parseTsvData = (tsvString: string): any[] => {
  if (!tsvString) return [];

  const lines = tsvString.split('\n').filter(line => line.trim());
  const words: any[] = [];

  for (const line of lines) {
    const parts = line.split('\t');
    if (parts.length >= 12) {
      const [level, page, block, par, line_num, word_num, left, top, width, height, conf, text] = parts;

      // Only process word-level entries (level 5)
      if (parseInt(level) === 5 && text && text.trim()) {
        words.push({
          text: text.trim(),
          left: parseInt(left),
          top: parseInt(top),
          width: parseInt(width),
          height: parseInt(height),
          conf: parseInt(conf),
          line: parseInt(line_num),
          block: parseInt(block)
        });
      }
    }
  }

  return words;
};

/**
 * Groups OCR words into rows based on vertical position (top coordinate).
 * @param words Array of word objects from TSV parsing.
 * @returns Array of rows containing word objects.
 */
const groupOcrWordsIntoRows = (words: any[]): any[][] => {
  if (words.length === 0) return [];

  // Sort words by top position, then left position
  words.sort((a, b) => {
    const topDiff = a.top - b.top;
    if (Math.abs(topDiff) <= 10) { // Same row threshold
      return a.left - b.left;
    }
    return topDiff;
  });

  const rows: any[][] = [];
  let currentRow: any[] = [];
  let currentTop = words[0].top;

  for (const word of words) {
    if (Math.abs(word.top - currentTop) <= 10) { // Same row
      currentRow.push(word);
    } else { // New row
      if (currentRow.length > 0) {
        rows.push(currentRow);
      }
      currentRow = [word];
      currentTop = word.top;
    }
  }

  if (currentRow.length > 0) {
    rows.push(currentRow);
  }

  return rows;
};

/**
 * Processes OCR text using line splitting and column gap detection heuristics.
 * @param ocrText The OCR text output.
 * @returns Array of table rows with columns.
 */
const extractTablesFromOcrText = (ocrText: string): any[][] => {
  if (!ocrText || ocrText.trim().length === 0) return [];

  const lines = ocrText.split('\n').filter(line => line.trim());
  const tableRows: any[][] = [];

  for (const line of lines) {
    // Split on multiple spaces (gap-based column detection)
    const columns = line.split(/\s{2,}/).filter(col => col.trim().length > 0);
    if (columns.length > 1) { // Only consider lines with multiple columns
      tableRows.push(columns.map(col => ({ str: col.trim() })));
    }
  }

  return tableRows;
};

/**
 * Extracts tables from OCR results using both TSV layout data and text heuristics.
 * @param ocrResult The OCR result object containing text and TSV data.
 * @param pageNumber The page number for table captions.
 * @returns Array of ExtractedTable objects.
 */
const extractTablesFromOcr = (ocrResult: { text: string, tsv: string }, pageNumber: number): ExtractedTable[] => {
  const tables: ExtractedTable[] = [];

  // Method 1: Use TSV data for precise layout-based table extraction
  if (ocrResult.tsv) {
    const words = parseTsvData(ocrResult.tsv);
    if (words.length >= 4) { // Need minimum words for table detection
      const rows = groupOcrWordsIntoRows(words);

      if (DEBUG) console.log(`OCR TSV: Found ${rows.length} rows from ${words.length} words`);

      // Look for table patterns in OCR rows
      let startIdx = 0;
      while (startIdx < rows.length) {
        let bestTable = null;
        let bestEndIdx = startIdx;

        // Try different table sizes
        for (let endIdx = startIdx + 2; endIdx <= Math.min(rows.length, startIdx + 15); endIdx++) {
          const candidateRows = rows.slice(startIdx, endIdx);
          const analysis = analyzeOcrTableStructure(candidateRows);

          if (analysis.isTable && (!bestTable || analysis.confidence > bestTable.confidence)) {
            bestTable = {
              rows: candidateRows,
              analysis,
              endIdx
            };
            bestEndIdx = endIdx;
          }
        }

        if (bestTable && bestTable.analysis.confidence > 0.4) { // Lower threshold for OCR
          const markdown = convertOcrRowsToMarkdown(bestTable.rows);
          if (markdown) {
            tables.push({
              caption: `OCR Table from page ${pageNumber}`,
              markdown,
              pageNumber,
              confidence: bestTable.analysis.confidence
            });

            if (DEBUG) console.log(`Found OCR table with confidence ${bestTable.analysis.confidence}`);
          }
          startIdx = bestEndIdx;
        } else {
          startIdx++;
        }
      }
    }
  }

  // Method 2: Use text-based heuristics as fallback/supplement
  if (tables.length === 0 && ocrResult.text) {
    const textRows = extractTablesFromOcrText(ocrResult.text);
    if (textRows.length >= 2) {
      const markdown = convertRowsToMarkdown(textRows);
      if (markdown) {
        tables.push({
          caption: `OCR Table (heuristic) from page ${pageNumber}`,
          markdown,
          pageNumber,
          confidence: 0.3 // Lower confidence for heuristic method
        });

        if (DEBUG) console.log('Found OCR table using text heuristics');
      }
    }
  }

  return tables;
};

/**
 * Analyzes OCR table structure based on word positions and alignment.
 * @param rows Array of OCR word rows.
 * @returns Analysis result with table detection confidence.
 */
const analyzeOcrTableStructure = (rows: any[][]) => {
  if (rows.length < 2) {
    return { isTable: false, reason: 'Insufficient rows', confidence: 0 };
  }

  // Calculate column positions for each row
  const rowColumnInfo = rows.map(row => ({
    count: row.length,
    positions: row.map(word => word.left),
    avgSpacing: row.length > 1 ? (row[row.length - 1].left - row[0].left) / (row.length - 1) : 0
  }));

  // Check for consistent column counts
  const columnCounts = rowColumnInfo.map(info => info.count);
  const avgColumns = columnCounts.reduce((a, b) => a + b, 0) / columnCounts.length;
  const columnVariance = columnCounts.reduce((sum, count) => sum + Math.pow(count - avgColumns, 2), 0) / columnCounts.length;

  if (avgColumns < 2) {
    return { isTable: false, reason: 'Too few columns', confidence: 0 };
  }

  // Group similar X positions (column alignment)
  const allPositions = rowColumnInfo.flatMap(info => info.positions);
  allPositions.sort((a, b) => a - b);

  const positionGroups: number[][] = [];
  const alignmentThreshold = 30; // Larger threshold for OCR (less precise)

  for (const pos of allPositions) {
    let addedToGroup = false;
    for (const group of positionGroups) {
      if (group.some(groupPos => Math.abs(pos - groupPos) <= alignmentThreshold)) {
        group.push(pos);
        addedToGroup = true;
        break;
      }
    }
    if (!addedToGroup) {
      positionGroups.push([pos]);
    }
  }

  const alignmentScore = positionGroups.length >= 2 ?
    positionGroups.reduce((sum, group) => sum + group.length, 0) / allPositions.length : 0;

  const hasMultipleColumns = positionGroups.length >= 2;
  const hasConsistentStructure = columnVariance <= 2; // More lenient for OCR
  const hasGoodAlignment = alignmentScore >= 0.5;

  const isTable = hasMultipleColumns && (hasConsistentStructure || hasGoodAlignment);
  const confidence = alignmentScore + (hasConsistentStructure ? 0.2 : 0) + (hasMultipleColumns ? 0.1 : 0);

  return {
    isTable,
    reason: isTable ? 'OCR table structure detected' : 'No clear OCR table structure',
    confidence
  };
};

/**
 * Converts OCR word rows to markdown table format.
 * @param rows Array of OCR word rows.
 * @returns Markdown table string.
 */
const convertOcrRowsToMarkdown = (rows: any[][]): string => {
  if (rows.length === 0) return '';

  // Determine maximum number of columns
  const maxCols = Math.max(...rows.map(row => row.length));

  const markdownRows: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Pad row to maxCols if necessary
    const paddedRow = [...row];
    while (paddedRow.length < maxCols) {
      paddedRow.push({ text: '' });
    }

    // Create markdown row
    const cellTexts = paddedRow.map(cell => (cell.text || '').replace(/\|/g, '\\|').trim());

    markdownRows.push(`| ${cellTexts.join(' | ')} |`);

    // Add header separator after first row
    if (i === 0) {
      const separator = Array(maxCols).fill('---').join(' | ');
      markdownRows.push(`| ${separator} |`);
    }
  }

  return markdownRows.join('\n');
};

/**
 * Extracts text and images from a given PDF file.
 * @param file The PDF file to process.
 * @param onProgress A callback function to report progress messages.
 * @returns A promise that resolves to an object containing extracted text, images, and stats.
 */
export const extractTextFromPdf = async (file: File, onProgress: (message: string) => void): Promise<ExtractionResult> => {
    initializePdfJs();

    onProgress('Loading OCR model...');
    const worker = await Tesseract.createWorker('eng');

    onProgress('Reading PDF file...');
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });

    try {
        const pdf = await loadingTask.promise;
        const textPages: string[] = [];
        const allExtractedImages: string[] = [];
        const allTables: ExtractedTable[] = [];
        const stats: ExtractionStats = {
            totalPages: pdf.numPages,
            imagesDetected: 0,
            imagesExtracted: 0,
            pagesWithOcr: 0,
            tablesConverted: 0,
        };

        for (let i = 1; i <= pdf.numPages; i++) {
            const pageTextParts: string[] = [];
            onProgress(`Processing page ${i} of ${pdf.numPages}...`);
            const page = await pdf.getPage(i);

            // 1. Extract standard text
            const structuredText = await getTextContentFromPage(page);
            if (structuredText.trim().length > 0) {
                 pageTextParts.push(structuredText);
            }

            // 2. Extract Images
            const { images: pageImages, detectedCount } = await extractImagesFromPage(page);
            allExtractedImages.push(...pageImages);
            stats.imagesDetected += detectedCount;

            // 3. Enhanced Table Extraction
            onProgress(`Page ${i}: Analyzing table structure...`);
            const structuredTextItems = await extractTextWithPositions(page);
            
            if (DEBUG) console.log(`Page ${i}: Found ${structuredTextItems.length} text items`);
            
            const pageTables = inferTablesFromText(structuredTextItems, i);
            allTables.push(...pageTables);
            
            if (pageTables.length > 0) {
                onProgress(`Page ${i}: Found ${pageTables.length} table(s)`);
            }

            // 4. Perform OCR if necessary
            if (structuredText.trim().length < 50) { // Heuristic: OCR if little text is found
                onProgress(`Page ${i}: Performing OCR...`);
                const ocrResult = await performOcrOnPage(page, worker);

                if (ocrResult.text.length > 0) {
                    // Improved OCR comparison using simple overlap check
                    const firstWords = structuredText.split(/\s+/).slice(0, 10).join(' ');
                    const ocrFirstWords = ocrResult.text.split(/\s+/).slice(0, 10).join(' ');
                    const hasSignificantOverlap = firstWords.length > 0 && ocrFirstWords.includes(firstWords.substring(0, Math.min(30, firstWords.length)));

                    if (!hasSignificantOverlap) {
                        pageTextParts.push(`\n--- OCR Result ---\n${ocrResult.text}`);
                        stats.pagesWithOcr++;

                        // 5. Extract tables from OCR results
                        onProgress(`Page ${i}: Analyzing OCR for tables...`);
                        const ocrTables = extractTablesFromOcr(ocrResult, i);
                        allTables.push(...ocrTables);

                        if (ocrTables.length > 0) {
                            onProgress(`Page ${i}: Found ${ocrTables.length} table(s) from OCR`);
                        }
                    }
                }
            }

            textPages.push(`--- Page ${i} ---\n\n${pageTextParts.join('\n\n')}`);
        }

        onProgress('Cleaning up...');
        await worker.terminate();

        stats.imagesExtracted = allExtractedImages.length;
        stats.tablesConverted = allTables.length;

        if (DEBUG) console.log('Final stats:', stats);

        return {
            fullText: textPages.join('\n\n'),
            stats: stats,
            images: allExtractedImages,
            tables: allTables,
        };

    } catch (error) {
        console.error('Error processing PDF:', error);
        if (error instanceof Error && error.name === 'PasswordException') {
            throw new Error('This PDF is password-protected and cannot be processed.');
        }
        throw new Error('Failed to read or process the PDF file.');
    }
};

// Import types from the types file
import type { Document, ExtractedTable } from '../types/types';
import { DocumentStatus } from '../types/types';

/**
 * Main processing function that adapts the working PDF extraction to the app's Document interface.
 * @param document The document object to process
 * @param fileId File ID (not used in client-side processing)
 * @param bucketId Bucket ID (not used in client-side processing)
 * @param onProgress Progress callback
 * @returns Promise resolving to updated Document
 */
export const processDocument = async (
  document: Document,
  fileId: string,
  bucketId: string,
  onProgress?: (progress: ProcessingProgress) => void
): Promise<Document> => {
  try {
    // For client-side processing, we need the actual file
    // This is a limitation - we need to get the file from somewhere
    // For now, we'll throw an error indicating this needs to be handled differently
    throw new Error('Client-side PDF processing requires the actual File object. Please modify the calling code to pass the File.');

  } catch (error) {
    console.error('PDF processing failed:', error);

    return {
      ...document,
      status: DocumentStatus.FAILED,
      errorMessage: error instanceof Error ? error.message : 'Unknown processing error'
    };
  }
};

/**
 * Alternative processing function that takes a File object directly.
 * This is the main function that should be used for client-side PDF processing.
 * @param file The PDF file to process
 * @param onProgress Progress callback with string messages
 * @returns Promise resolving to ExtractionResult
 */
export const processPDFFile = async (
  file: File,
  onProgress?: (message: string) => void
): Promise<ExtractionResult> => {
  return extractTextFromPdf(file, onProgress || (() => {}));
};
