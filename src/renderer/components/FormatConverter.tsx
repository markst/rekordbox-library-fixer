import React, { useEffect, useState } from 'react';
import {
  RefreshCw,
  Play,
  Eye,
  Folder,
  X,
  AlertTriangle,
  CheckCircle,
  Loader2,
  FileAudio,
} from 'lucide-react';
import { useAppContext } from '../AppWithRouter';
import { useFormatConverter } from '../hooks/useFormatConverter';
import { PageHeader } from './ui/PageHeader';
import { ConversionProgressDialog } from './ui/ConversionProgressDialog';
import type { TargetFormat, DryRunPreview } from '../types';
import { formatFileSize } from '../utils';

const FORMAT_OPTIONS: { value: TargetFormat; label: string }[] = [
  { value: 'mp3', label: 'MP3' },
  { value: 'aiff', label: 'AIFF' },
  { value: 'wav', label: 'WAV' },
];

const BITRATE_OPTIONS = [128, 192, 256, 320];

const SOURCE_FORMAT_OPTIONS = [
  { value: 'all', label: 'All Formats' },
  { value: 'flac', label: 'FLAC' },
  { value: 'wav', label: 'WAV' },
  { value: 'aiff', label: 'AIFF' },
  { value: 'mp3', label: 'MP3' },
  { value: 'm4a', label: 'M4A / AAC' },
];

export const FormatConverter: React.FC = () => {
  const { showNotification } = useAppContext();
  const {
    ffmpegAvailable,
    ffmpegError,
    checkFFmpeg,
    options,
    setTargetFormat,
    setBitrate,
    setDeleteOriginals,
    setOutputDirectory,
    clearOutputDirectory,
    sourceFormatFilter,
    setSourceFormatFilter,
    filteredTracks,
    dryRunResults,
    isDryRunning,
    runDryRun,
    isConverting,
    startConversion,
  } = useFormatConverter(showNotification);

  const [showProgress, setShowProgress] = useState(false);
  const [showDryRun, setShowDryRun] = useState(false);

  // Check ffmpeg on mount
  useEffect(() => {
    checkFFmpeg();
  }, [checkFFmpeg]);

  const handleStartConversion = () => {
    setShowProgress(true);
    startConversion();
  };

  const handleDryRun = async () => {
    await runDryRun();
    setShowDryRun(true);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <PageHeader
        title="Format Converter"
        icon={RefreshCw}
        stats={`${filteredTracks.length} tracks`}
      />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* ffmpeg Status */}
        {ffmpegAvailable === false && (
          <div className="card p-4 border-te-red-500 bg-red-50">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-te-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-te-display text-sm font-bold uppercase tracking-te-display text-te-grey-800 mb-1">
                  ffmpeg Not Found
                </h3>
                <p className="text-sm text-te-grey-600 font-te-mono">
                  {ffmpegError || 'ffmpeg is required for audio conversion.'}
                </p>
                <p className="text-sm text-te-grey-500 font-te-mono mt-1">
                  Install ffmpeg from{' '}
                  <button
                    onClick={() => window.electronAPI?.openExternal?.('https://ffmpeg.org/download.html')}
                    className="text-te-orange underline hover:text-te-orange/80"
                  >
                    ffmpeg.org
                  </button>{' '}
                  and restart the app.
                </p>
              </div>
            </div>
          </div>
        )}

        {ffmpegAvailable === true && (
          <div className="card p-3 flex items-center gap-2 border-green-300 bg-green-50">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-sm text-green-700 font-te-mono">ffmpeg is available</span>
          </div>
        )}

        {ffmpegAvailable === null && (
          <div className="card p-3 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-te-grey-500" />
            <span className="text-sm text-te-grey-500 font-te-mono">Checking ffmpeg...</span>
          </div>
        )}

        {/* Configuration */}
        <div className="card p-4">
          <h3 className="font-te-display text-sm font-bold uppercase tracking-te-display text-te-grey-800 mb-4">
            Conversion Settings
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Source format filter */}
            <div>
              <label className="block text-xs text-te-grey-500 font-te-mono uppercase mb-1">
                Source Format
              </label>
              <select
                value={sourceFormatFilter}
                onChange={(e) => setSourceFormatFilter(e.target.value)}
                className="w-full p-2 bg-te-grey-100 border-2 border-te-grey-300 rounded-te text-sm font-te-mono text-te-grey-800 focus:border-te-orange focus:outline-none"
              >
                {SOURCE_FORMAT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Target format */}
            <div>
              <label className="block text-xs text-te-grey-500 font-te-mono uppercase mb-1">
                Target Format
              </label>
              <select
                value={options.targetFormat}
                onChange={(e) => setTargetFormat(e.target.value as TargetFormat)}
                className="w-full p-2 bg-te-grey-100 border-2 border-te-grey-300 rounded-te text-sm font-te-mono text-te-grey-800 focus:border-te-orange focus:outline-none"
              >
                {FORMAT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Bitrate (only for mp3) */}
            {options.targetFormat === 'mp3' && (
              <div>
                <label className="block text-xs text-te-grey-500 font-te-mono uppercase mb-1">
                  Bitrate
                </label>
                <select
                  value={options.bitrate}
                  onChange={(e) => setBitrate(Number(e.target.value))}
                  className="w-full p-2 bg-te-grey-100 border-2 border-te-grey-300 rounded-te text-sm font-te-mono text-te-grey-800 focus:border-te-orange focus:outline-none"
                >
                  {BITRATE_OPTIONS.map((br) => (
                    <option key={br} value={br}>
                      {br} kbps
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Output directory */}
            <div>
              <label className="block text-xs text-te-grey-500 font-te-mono uppercase mb-1">
                Output Directory
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 p-2 bg-te-grey-100 border-2 border-te-grey-300 rounded-te text-sm font-te-mono text-te-grey-600 truncate min-h-[38px] flex items-center">
                  {options.outputDirectory || 'Same as original (default)'}
                </div>
                <button
                  onClick={setOutputDirectory}
                  className="p-2 bg-te-grey-200 border-2 border-te-grey-300 rounded-te hover:bg-te-grey-300 transition-colors"
                  title="Select output folder"
                >
                  <Folder className="w-4 h-4 text-te-grey-600" />
                </button>
                {options.outputDirectory && (
                  <button
                    onClick={clearOutputDirectory}
                    className="p-2 bg-te-grey-200 border-2 border-te-grey-300 rounded-te hover:bg-te-grey-300 transition-colors"
                    title="Reset to default"
                  >
                    <X className="w-4 h-4 text-te-grey-600" />
                  </button>
                )}
              </div>
            </div>

            {/* Delete originals */}
            <div className="flex items-center gap-3 col-span-full">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.deleteOriginals}
                  onChange={(e) => setDeleteOriginals(e.target.checked)}
                  className="w-4 h-4 rounded border-2 border-te-grey-400 text-te-orange focus:ring-te-orange"
                />
                <span className="text-sm font-te-mono text-te-grey-700">
                  Delete original files after successful conversion
                </span>
              </label>
              {options.deleteOriginals && (
                <span className="text-xs text-te-red-500 font-te-mono flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  This cannot be undone
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleDryRun}
            disabled={isDryRunning || filteredTracks.length === 0 || ffmpegAvailable !== true}
            className="flex items-center gap-2 px-4 py-2 bg-te-grey-200 border-2 border-te-grey-400 rounded-te
                       font-te-mono text-sm uppercase tracking-wider text-te-grey-700
                       hover:bg-te-grey-300 hover:border-te-grey-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isDryRunning ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
            Preview
          </button>

          <button
            onClick={handleStartConversion}
            disabled={isConverting || filteredTracks.length === 0 || ffmpegAvailable !== true}
            className="flex items-center gap-2 px-4 py-2 bg-te-orange border-2 border-te-orange rounded-te
                       font-te-mono text-sm uppercase tracking-wider text-te-cream
                       hover:bg-te-orange/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
          >
            {isConverting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Convert {filteredTracks.length} Tracks
          </button>
        </div>

        {/* Dry Run Results */}
        {showDryRun && dryRunResults.length > 0 && (
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-te-display text-sm font-bold uppercase tracking-te-display text-te-grey-800">
                Conversion Preview
              </h3>
              <button
                onClick={() => setShowDryRun(false)}
                className="text-te-grey-400 hover:text-te-grey-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {dryRunResults.map((item: DryRunPreview) => (
                <div
                  key={item.trackId}
                  className="flex items-center gap-2 p-2 bg-te-grey-100 rounded-te text-xs font-te-mono"
                >
                  <FileAudio className="w-3 h-3 text-te-grey-500 flex-shrink-0" />
                  <span className="text-te-grey-700 truncate flex-1" title={item.inputPath}>
                    {item.trackName}
                  </span>
                  <span className="text-te-grey-400">→</span>
                  <span className="text-te-orange truncate max-w-[200px]" title={item.outputPath}>
                    {item.outputPath.split('/').pop() || item.outputPath.split('\\').pop()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Track List */}
        <div className="card p-4">
          <h3 className="font-te-display text-sm font-bold uppercase tracking-te-display text-te-grey-800 mb-3">
            Matching Tracks ({filteredTracks.length})
          </h3>
          {filteredTracks.length === 0 ? (
            <p className="text-sm text-te-grey-500 font-te-mono text-center py-8">
              No tracks match the selected source format
            </p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto space-y-1">
              {filteredTracks.slice(0, 200).map((track) => (
                <div
                  key={track.id}
                  className="flex items-center gap-3 p-2 bg-te-grey-100 rounded-te hover:bg-te-grey-200 transition-colors"
                >
                  <FileAudio className="w-4 h-4 text-te-grey-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-te-mono text-te-grey-800 truncate">
                      {track.name}
                    </p>
                    <p className="text-xs text-te-grey-500 font-te-mono truncate">
                      {track.artist}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {track.kind && (
                      <span className="text-xs text-te-grey-500 font-te-mono bg-te-grey-200 px-2 py-0.5 rounded">
                        {track.kind}
                      </span>
                    )}
                    {track.bitrate && (
                      <span className="text-xs text-te-grey-500 font-te-mono">
                        {track.bitrate}kbps
                      </span>
                    )}
                    {track.size && (
                      <span className="text-xs text-te-grey-500 font-te-mono">
                        {formatFileSize(track.size)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {filteredTracks.length > 200 && (
                <p className="text-xs text-te-grey-500 font-te-mono text-center py-2">
                  Showing first 200 of {filteredTracks.length} tracks
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Conversion Progress Dialog */}
      <ConversionProgressDialog
        isOpen={showProgress}
        onClose={() => setShowProgress(false)}
        onCancel={() => {
          setShowProgress(false);
        }}
      />
    </div>
  );
};
