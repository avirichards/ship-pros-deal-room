import { useState, useEffect } from 'react';
import { X, Table2, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { OpportunityFile } from '../../lib/types';
import Papa from 'papaparse';

interface DataPreviewModalProps {
  file: OpportunityFile;
  onClose: () => void;
}

export function DataPreviewModal({ file, onClose }: DataPreviewModalProps) {
  const [data, setData] = useState<string[][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPreviewData();
  }, [file]);

  async function fetchPreviewData() {
    try {
      setLoading(true);
      setError(null);

      // Download the file contents
      const { data: fileBlob, error: downloadError } = await supabase.storage
        .from('opportunity-files')
        .download(file.file_path);

      if (downloadError || !fileBlob) {
        throw new Error('Failed to load file for preview');
      }

      const text = await fileBlob.text();

      Papa.parse(text, {
        complete: (results) => {
          // Filter out completely empty rows
          const parsedData = (results.data as string[][]).filter(
            row => row.some(cell => cell.trim() !== '')
          );
          
          if (parsedData.length === 0) {
            setError('The file is empty or could not be parsed.');
          } else {
            setData(parsedData.slice(0, 100)); // Limit to first 100 rows for performance
          }
          setLoading(false);
        },
        error: (err: any) => {
          setError(`Failed to parse CSV: ${err.message}`);
          setLoading(false);
        },
      });
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred during preview');
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-[95vw] max-h-[90vh] mx-4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 rounded-t-xl">
          <div className="flex flex-col">
            <h2 className="text-lg font-semibold text-navy-950 flex items-center gap-2">
              <Table2 className="w-5 h-5 text-teal-600" />
              Data Preview
            </h2>
            <p className="text-sm text-gray-500 mt-1 truncate max-w-xl">
              Previewing: <span className="font-medium">{file.file_name}</span> (First 100 rows)
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-0 min-h-[300px] relative bg-white rounded-b-xl">
          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500 mb-4"></div>
              <p className="text-sm text-gray-500">Loading data preview...</p>
            </div>
          ) : error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
              <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
              <p className="text-red-700 font-medium">{error}</p>
            </div>
          ) : data.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left whitespace-nowrap border-collapse">
                <thead className="text-xs text-gray-700 uppercase bg-gray-100 sticky top-0 z-10 shadow-sm">
                  <tr>
                    {/* Render first row as headers */}
                    {data[0]?.map((header, i) => (
                      <th key={i} className="px-4 py-3 border border-gray-300 font-semibold bg-gray-100">
                        {header || `Column ${i + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Render the rest as data */}
                  {data.slice(1).map((row, i) => (
                    <tr key={i} className={`hover:bg-teal-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      {row.map((cell, j) => (
                        <td key={j} className="px-4 py-2.5 text-gray-600 border border-gray-200 truncate max-w-[300px]" title={cell}>
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
