"use client";

import React, { useState, useCallback } from "react";
import { Upload, FileText, AlertCircle, CheckCircle2, X } from "lucide-react";

interface OpenAPIUploadProps {
  onFileUpload: (content: string, fileName: string) => void;
  onClear?: () => void;
  isLoading?: boolean;
}

export function OpenAPIUpload({ onFileUpload, onClear, isLoading = false }: OpenAPIUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const validateFile = (file: File): boolean => {
    // Check file extension
    const validExtensions = ['.yaml', '.yml', '.json'];
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    
    if (!validExtensions.includes(fileExtension)) {
      setError(`Invalid file type. Please upload a YAML (.yaml, .yml) or JSON (.json) file.`);
      return false;
    }

    // Check file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setError(`File too large. Maximum size is 5MB.`);
      return false;
    }

    return true;
  };

  const processFile = async (file: File) => {
    if (!validateFile(file)) {
      return;
    }

    setError(null);
    
    try {
      const content = await file.text();
      
      // Basic validation - check if it looks like OpenAPI/Swagger
      const contentLower = content.toLowerCase();
      const isOpenAPI = contentLower.includes('openapi') || 
                       contentLower.includes('swagger') ||
                       contentLower.includes('paths:') ||
                       contentLower.includes('"paths"');
      
      if (!isOpenAPI) {
        setError('File does not appear to be a valid OpenAPI/Swagger specification.');
        return;
      }

      setUploadedFile(file.name);
      onFileUpload(content, file.name);
    } catch (err) {
      setError(`Failed to read file: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0]);
    }
  }, [onFileUpload]);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      await processFile(e.target.files[0]);
    }
  };

  const handleClear = () => {
    setUploadedFile(null);
    setError(null);
    if (onClear) {
      onClear();
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Upload Area */}
      {!uploadedFile && (
        <div
          className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive
              ? "border-blue-500 bg-blue-50"
              : "border-gray-300 hover:border-gray-400"
          } ${isLoading ? "opacity-50 pointer-events-none" : ""}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            id="file-upload"
            className="hidden"
            accept=".yaml,.yml,.json"
            onChange={handleChange}
            disabled={isLoading}
          />
          
          <div className="flex flex-col items-center space-y-4">
            <div className="p-4 bg-blue-100 rounded-full">
              <Upload className="w-8 h-8 text-blue-600" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-gray-900">
                Upload OpenAPI Specification
              </h3>
              <p className="text-sm text-gray-600">
                Drag and drop your OpenAPI/Swagger file here, or click to browse
              </p>
              <p className="text-xs text-gray-500">
                Supports OpenAPI 3.0/3.1 and Swagger 2.0 (YAML or JSON)
              </p>
            </div>

            <button
              type="button"
              onClick={() => document.getElementById('file-upload')?.click()}
              disabled={isLoading}
              className="mt-2 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <FileText className="w-4 h-4 mr-2" />
              Choose File
            </button>
          </div>
        </div>
      )}

      {/* Uploaded File Display */}
      {uploadedFile && !error && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-900">
                  {uploadedFile}
                </span>
                <span className="text-xs text-green-700">uploaded successfully</span>
              </div>
            </div>
            <button
              onClick={handleClear}
              disabled={isLoading}
              className="p-1 text-green-700 hover:text-green-900 hover:bg-green-100 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
              <span className="text-sm text-red-900">{error}</span>
            </div>
            <button
              onClick={() => setError(null)}
              className="p-1 text-red-700 hover:text-red-900 hover:bg-red-100 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">
          What is OpenAPI Spec Validation?
        </h4>
        <p className="text-xs text-blue-800 mb-2">
          Upload your OpenAPI/Swagger specification to detect drift between your API documentation 
          and actual implementation. We'll check for:
        </p>
        <ul className="text-xs text-blue-800 space-y-1 ml-4">
          <li>• <strong>Undocumented endpoints</strong> - APIs that exist but aren't in the spec</li>
          <li>• <strong>Missing implementations</strong> - Endpoints documented but not implemented</li>
          <li>• <strong>Parameter mismatches</strong> - Required params not validated</li>
          <li>• <strong>Schema drift</strong> - Request/response schema differences</li>
          <li>• <strong>Deprecated endpoints</strong> - Deprecated APIs still in use</li>
        </ul>
      </div>
    </div>
  );
}

// Made with Bob