import React, { useState, useEffect } from 'react';
import { Upload, CheckCircle2 } from 'lucide-react';
import { FormField } from './FormBuilderUtils';

interface DocumentAnalyzerProps {
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  selectedFile: File | null;
  onFieldsDetected: (fields: FormField[]) => void;
}

export function DocumentAnalyzer({ onFileSelect, selectedFile, onFieldsDetected }: DocumentAnalyzerProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const [librariesLoaded, setLibrariesLoaded] = useState(false);
  const [detectedFieldsCount, setDetectedFieldsCount] = useState(0);

  useEffect(() => {
    const loadLibraries = async () => {
      try {
        if (!(window as any).pdfjsLib) {
          const script1 = document.createElement('script');
          script1.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
          script1.async = true;
          document.head.appendChild(script1);
          
          await new Promise((resolve) => {
            script1.onload = resolve;
          });
          
          (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = 
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }

        if (!(window as any).mammoth) {
          const script2 = document.createElement('script');
          script2.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';
          script2.async = true;
          document.head.appendChild(script2);
          await new Promise((resolve) => {
            script2.onload = resolve;
          });
        }

        if (!(window as any).XLSX) {
          const script3 = document.createElement('script');
          script3.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
          script3.async = true;
          document.head.appendChild(script3);
          await new Promise((resolve) => {
            script3.onload = resolve;
          });
        }

        setLibrariesLoaded(true);
        console.log('All document processing libraries loaded successfully');
      } catch (error) {
        console.error('Error loading libraries:', error);
        setLibrariesLoaded(true);
      }
    };

    loadLibraries();
  }, []);

  useEffect(() => {
    if (selectedFile && librariesLoaded) {
      analyzeDocument(selectedFile);
    }
  }, [selectedFile, librariesLoaded]);

  const extractTextFromPDF = async (file: File): Promise<string> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = (window as any).pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += pageText + '\n';
      }
      
      return fullText;
    } catch (error) {
      throw new Error('Failed to extract text from PDF');
    }
  };

  const extractTextFromDOCX = async (file: File): Promise<string> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await (window as any).mammoth.extractRawText({ arrayBuffer });
      return result.value;
    } catch (error) {
      throw new Error('Failed to extract text from DOCX');
    }
  };

  const extractTextFromXLSX = async (file: File): Promise<string> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = (window as any).XLSX.read(arrayBuffer, { type: 'array' });
      
      let fullText = '';
      workbook.SheetNames.forEach((sheetName: string) => {
        const sheet = workbook.Sheets[sheetName];
        const csv = (window as any).XLSX.utils.sheet_to_csv(sheet);
        fullText += csv + '\n';
      });
      
      return fullText;
    } catch (error) {
      throw new Error('Failed to extract text from Excel file');
    }
  };

  const detectFormFields = (text: string): FormField[] => {
    const fields: FormField[] = [];
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
    const detectedLabels = new Set<string>();

    const normalizeLabel = (label: string): string => {
      return label.trim()
        .replace(/\s+/g, ' ')
        .replace(/[:\s]*$/, '')
        .replace(/^[:\s]+/, '');
    };

    const addField = (label: string, type: FormField['type'], required: boolean = false) => {
      const normalized = normalizeLabel(label);
      const lowerNormalized = normalized.toLowerCase();
      
      if (detectedLabels.has(lowerNormalized) || normalized.length < 2) {
        return;
      }
      
      const noiseWords = ['notes', 'policies', 'required', 'notification', 'file', 'medical certificate', 
                          'leave type selection', 'sick leave credits', 'vacation leave credits',
                          'notes & policies'];
      if (noiseWords.some(noise => lowerNormalized === noise || lowerNormalized.includes(noise))) {
        return;
      }

      fields.push({
        id: `field_${Date.now()}_${Math.random()}`,
        label: normalized,
        type,
        required,
        placeholder: type === 'textarea' ? 'Enter details...' : `Enter ${normalized.toLowerCase()}`,
      });
      detectedLabels.add(lowerNormalized);
    };

    lines.forEach((line) => {
      const bracketMatches = line.matchAll(/\[\s*\]\s*([A-Z][A-Z\s]{2,40})/g);
      for (const match of bracketMatches) {
        const label = match[1].trim();
        if (label && label.length >= 3 && label.length <= 40) {
          addField(label, 'checkbox', false);
        }
      }

      const underscorePattern1 = /^([A-Z][A-Z\s\/\(\)\.,']{1,60}?):\s*_{2,}/i;
      const underscoreMatch1 = line.match(underscorePattern1);
      if (underscoreMatch1) {
        const label = underscoreMatch1[1].trim();
        let fieldType: FormField['type'] = 'text';
        
        const lowerLabel = label.toLowerCase();
        if (lowerLabel.includes('date')) fieldType = 'date';
        else if (lowerLabel.includes('reason') || lowerLabel.includes('comment')) fieldType = 'textarea';
        else if (lowerLabel.includes('no.') || lowerLabel.includes('days') || 
                 lowerLabel.includes('credits') || lowerLabel.includes('balance') ||
                 lowerLabel.includes('total') || lowerLabel.includes('taken') ||
                 lowerLabel.includes('available') || lowerLabel.includes('remaining')) fieldType = 'number';
        else if (lowerLabel.includes('name')) fieldType = 'text';
        
        addField(label, fieldType, false);
      }

      const colonEndPattern = /^([A-Z][A-Z\s\/\(\)\.,']{2,60}?):\s*$/i;
      const colonEndMatch = line.match(colonEndPattern);
      if (colonEndMatch) {
        const label = colonEndMatch[1].trim();
        let fieldType: FormField['type'] = 'text';
        
        const lowerLabel = label.toLowerCase();
        if (lowerLabel.includes('date')) fieldType = 'date';
        else if (lowerLabel.includes('comment') || lowerLabel.includes('notes') || lowerLabel.includes('reason')) fieldType = 'textarea';
        else if (lowerLabel.includes('number') || lowerLabel.includes('days') ||
                 lowerLabel.includes('credits') || lowerLabel.includes('balance') ||
                 lowerLabel.includes('total') || lowerLabel.includes('taken') ||
                 lowerLabel.includes('available') || lowerLabel.includes('remaining')) fieldType = 'number';
        
        addField(label, fieldType, false);
      }
    });
    
    return fields;
  };

  const analyzeDocument = async (file: File) => {
    setAnalyzing(true);
    try {
      let text = '';

      if (file.type === 'application/pdf') {
        text = await extractTextFromPDF(file);
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        text = await extractTextFromDOCX(file);
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                 file.type === 'application/vnd.ms-excel') {
        text = await extractTextFromXLSX(file);
      } else {
        console.warn('Unsupported file type for auto-detection');
        setAnalyzing(false);
        return;
      }
      
      if (text.trim()) {
        const detectedFields = detectFormFields(text);
        
        if (detectedFields.length > 0) {
          onFieldsDetected(detectedFields);
          setDetectedFieldsCount(detectedFields.length);
          alert(`✓ Successfully detected ${detectedFields.length} form fields!`);
        } else {
          alert('No form fields detected automatically. You can add fields manually below.');
        }
      } else {
        alert('Could not extract text from document. Please add fields manually.');
      }
    } catch (error) {
      console.error('Error analyzing document:', error);
      alert('Error analyzing document: ' + (error as Error).message);
    } finally {
      setAnalyzing(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-3">
        Upload a document (PDF, DOCX, XLSX) and we'll automatically detect form fields!
        {!librariesLoaded && ' (Loading analysis tools...)'}
      </p>
      {analyzing && (
        <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          <span className="text-sm text-blue-700 dark:text-blue-300">
            Analyzing document and detecting form fields...
          </span>
        </div>
      )}
      <div className="border-2 border-dashed border-border rounded-lg p-8 text-center bg-secondary/30 hover:bg-secondary/50 transition-colors">
        <input
          type="file"
          id="formFile"
          accept=".pdf,.doc,.docx,.xls,.xlsx"
          onChange={onFileSelect}
          className="hidden"
          disabled={analyzing}
        />
        <label htmlFor="formFile" className="cursor-pointer flex flex-col items-center gap-3">
          <Upload size={40} className="text-muted-foreground" />
          {selectedFile ? (
            <div className="text-sm">
              <p className="font-semibold text-foreground text-lg">{selectedFile.name}</p>
              <p className="text-muted-foreground mt-1">{formatFileSize(selectedFile.size)}</p>
              {detectedFieldsCount > 0 && (
                <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-full">
                  <CheckCircle2 size={14} className="text-green-600" />
                  <span className="text-xs text-green-700 dark:text-green-300 font-medium">
                    {detectedFieldsCount} fields detected
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm">
              <p className="font-semibold text-foreground text-lg">Click to upload document</p>
              <p className="text-muted-foreground mt-1">PDF, DOC, DOCX, XLS, XLSX (Max 5MB)</p>
              <p className="text-xs text-primary mt-2">
                {librariesLoaded ? '✓ Auto-detection ready' : '⏳ Loading analysis tools...'}
              </p>
            </div>
          )}
        </label>
      </div>
    </div>
  );
}