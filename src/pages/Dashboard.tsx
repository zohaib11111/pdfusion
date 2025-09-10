import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import FileUploader from '../components/FileUploader';
import { functions } from '../services/appwrite';
import { Document, DocumentStatus } from '../types/types';
import ProcessingView from '../components/ProcessingView';
import ResultsView from '../components/ResultsView';
import { FileText, BarChart3, Clock, CheckCircle, LogOut, User, AlertCircle } from '../components/icons';

// Interface for upload response from Appwrite function
interface UploadResponse {
  success: boolean;
  documentId: string;
  fileId: string;
  fileName: string;
  bucketId: string;
  originalFileName: string;
  error?: string;
  message?: string;
}

// Interface for processing response from Appwrite function
interface ProcessingResponse {
  id: string;
  fileName: string;
  status: DocumentStatus;
  markdownContent?: string;
  extractedImages?: Array<{
    id: string;
    url: string;
    caption: string;
  }>;
  extractedTables?: Array<{
    caption: string;
    markdown: string;
    pageNumber: number;
    confidence?: number;
  }>;
  errorMessage?: string;
}

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadResponse, setUploadResponse] = useState<UploadResponse | null>(null);
  const [document, setDocument] = useState<Document | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [processingStep, setProcessingStep] = useState<'upload' | 'process' | null>(null);

  const handleLogout = async () => {
    await logout();
  };

  const handleFileUpload = async (file: File) => {
    if (!user) {
      const errorDocument: Document = {
        id: Date.now().toString(),
        fileName: file.name,
        status: DocumentStatus.FAILED,
        errorMessage: 'User not authenticated',
      };
      setDocument(errorDocument);
      return;
    }

    setProcessing(true);
    setProcessingStep('upload');
    setProgressMessage('Uploading file to server...');

    try {
      // Validate function ID format
      const functionId = import.meta.env.VITE_APPWRITE_FUNCTION_ID;
      if (!functionId) {
        throw new Error('VITE_APPWRITE_FUNCTION_ID is not configured. Please check your environment variables.');
      }

      // Check if function ID looks like a URL (common mistake)
      if (functionId.startsWith('http')) {
        throw new Error('VITE_APPWRITE_FUNCTION_ID should be just the function ID, not a full URL. Example: "68bacfc2002c8e9d1f2c"');
      }

      // Convert file to base64 for sending to function
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Remove the data URL prefix (e.g., "data:application/pdf;base64,")
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Call Appwrite upload function
      const response = await functions.createExecution(
        functionId,
        JSON.stringify({
          action: 'upload',
          file: base64Data,
          filename: file.name,
          fileSize: file.size,
          fileType: file.type
        }),
        false,
        '/upload',
        'POST'
      );

      const uploadResult: UploadResponse = JSON.parse(response.responseBody);

      if (uploadResult.success) {
        setUploadedFile(file);
        setUploadResponse(uploadResult);
        setProgressMessage('File uploaded successfully!');
      } else {
        throw new Error(uploadResult.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload failed:', error);
      const errorDocument: Document = {
        id: Date.now().toString(),
        fileName: file.name,
        status: DocumentStatus.FAILED,
        errorMessage: error instanceof Error ? error.message : 'Upload failed',
      };
      setDocument(errorDocument);
    }

    setProcessing(false);
  };

  const handleProcessPdf = async () => {
    if (!uploadResponse) return;

    setProcessing(true);
    setProcessingStep('process');
    setProgressMessage('Starting PDF processing...');

    try {
      // Validate function ID format
      const functionId = import.meta.env.VITE_APPWRITE_FUNCTION_ID;
      if (!functionId) {
        throw new Error('VITE_APPWRITE_FUNCTION_ID is not configured. Please check your environment variables.');
      }

      // Check if function ID looks like a URL (common mistake)
      if (functionId.startsWith('http')) {
        throw new Error('VITE_APPWRITE_FUNCTION_ID should be just the function ID, not a full URL. Example: "68bacfc2002c8e9d1f2c"');
      }

      // Call Appwrite process function
      const response = await functions.createExecution(
        functionId,
        '',
        false,
        `/process?documentId=${uploadResponse.documentId}&fileId=${uploadResponse.fileId}&bucketId=${uploadResponse.bucketId}`,
        'GET'
      );

      const processingResult: ProcessingResponse = JSON.parse(response.responseBody);

      // Convert to Document format
      const newDocument: Document = {
        id: processingResult.id,
        fileName: processingResult.fileName,
        status: processingResult.status,
        markdownContent: processingResult.markdownContent,
        extractedImages: processingResult.extractedImages,
        extractedTables: processingResult.extractedTables,
        errorMessage: processingResult.errorMessage,
      };

      setDocument(newDocument);
      setProgressMessage('Processing completed!');
    } catch (error) {
      console.error('Processing failed:', error);
      const errorDocument: Document = {
        id: uploadResponse.documentId,
        fileName: uploadResponse.originalFileName,
        status: DocumentStatus.FAILED,
        errorMessage: error instanceof Error ? error.message : 'Processing failed',
      };
      setDocument(errorDocument);
    }

    setProcessing(false);
  };

  const handleReset = () => {
    setUploadedFile(null);
    setUploadResponse(null);
    setDocument(null);
    setProcessing(false);
    setProgressMessage('');
  };

  if (processing) {
    return <ProcessingView message={progressMessage} step={processingStep} />;
  }

  if (document) {
    return <ResultsView document={document} onReset={handleReset} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Navigation Bar - Always Visible */}
      <nav className="bg-white/80 backdrop-blur-lg shadow-lg border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  PDFusion
                </h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-slate-700">
                <User className="w-4 h-4" />
                <span className="text-sm font-medium">Welcome, {user?.name}</span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 transform hover:scale-105 shadow-md hover:shadow-lg"
                title="Logout from your account"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-8 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {!uploadedFile ? (
            <>
              {/* Welcome Section */}
              <div className="text-center mb-12">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full mb-6 shadow-lg">
                  <FileText className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-4xl font-bold text-slate-900 mb-4">
                  PDF Processing Dashboard
                </h2>
                <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                  Upload PDFs to extract text, images, and tables with advanced OCR processing.
                </p>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center mr-4">
                      <CheckCircle className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">0</p>
                      <p className="text-slate-600 text-sm">Processed PDFs</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center mr-4">
                      <BarChart3 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">0</p>
                      <p className="text-slate-600 text-sm">Images Extracted</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-white/20 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center mr-4">
                      <Clock className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-slate-900">0m</p>
                      <p className="text-slate-600 text-sm">Avg. Processing Time</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* File Uploader */}
              <div className="max-w-2xl mx-auto">
                <FileUploader onFileUpload={handleFileUpload} />
              </div>
            </>
          ) : (
            <div className="max-w-4xl mx-auto">
              {/* File Upload Success */}
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-white/20 mb-8">
                <div className="flex items-center mb-6">
                  <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mr-4">
                    <CheckCircle className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900">File Uploaded Successfully</h3>
                    <p className="text-slate-600">Ready to process your PDF</p>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-slate-50 to-blue-50 rounded-xl p-6 border border-slate-200">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center space-x-3 min-w-0">
                      <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-slate-500 uppercase tracking-wide">File Name</p>
                        <div className="relative">
                          <p
                            className="text-slate-900 font-medium truncate pr-6"
                            title={uploadedFile.name}
                          >
                            {uploadedFile.name.length > 25
                              ? `${uploadedFile.name.substring(0, 22)}...`
                              : uploadedFile.name
                            }
                          </p>
                          {uploadedFile.name.length > 25 && (
                            <button
                              className="absolute right-0 top-0 text-blue-600 hover:text-blue-800 text-xs opacity-60 hover:opacity-100"
                              title="Click to copy full filename"
                              onClick={() => navigator.clipboard.writeText(uploadedFile.name)}
                            >
                              📋
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <BarChart3 className="w-5 h-5 text-blue-600 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wide">Size</p>
                        <p className="text-slate-900 font-medium">{(uploadedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Clock className="w-5 h-5 text-blue-600 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wide">Type</p>
                        <p className="text-slate-900 font-medium">{uploadedFile.type}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={() => setUploadedFile(null)}
                    className="flex-1 flex items-center justify-center space-x-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-200 transform hover:scale-105 shadow-md hover:shadow-lg"
                  >
                    <FileText className="w-5 h-5" />
                    <span>Upload Another File</span>
                  </button>
                  <button
                    onClick={handleProcessPdf}
                    className="flex-1 flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl"
                  >
                    <BarChart3 className="w-5 h-5" />
                    <span>Process PDF</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
