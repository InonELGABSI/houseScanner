import { useState } from 'react';
import type { UploadPanelProps } from '../../../types';

export function UploadPanel({ onFilesSelected }: UploadPanelProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const files = event.dataTransfer.files;
    if (files && files.length > 0) {
      onFilesSelected(files);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      onFilesSelected(event.target.files);
      event.target.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <label className="flex items-center justify-between w-full rounded-xl border border-slate-700/70 bg-slate-800/60 px-6 py-4 transition-colors hover:border-emerald-500/60 hover:bg-slate-800">
        <div className="flex items-center space-x-4">
          <span className="text-3xl">📁</span>
          <div>
            <p className="text-slate-200 font-semibold">Upload from device</p>
            <p className="text-sm text-slate-400">Choose JPG or PNG images</p>
          </div>
        </div>
        <div className="rounded-lg bg-emerald-600/80 px-3 py-1 text-sm font-medium text-white">
          Browse
        </div>
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleInputChange}
        />
      </label>

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-all ${
          isDragging
            ? 'border-emerald-500/80 bg-emerald-900/20'
            : 'border-slate-700/60 bg-slate-900/40'
        }`}
      >
        <span className="text-4xl mb-3">⬆️</span>
        <p className="text-slate-300 font-medium">Drag and drop photos here</p>
        <p className="text-sm text-slate-500">Add multiple room photos at once</p>
      </div>
    </div>
  );
}
