import { useState, useCallback, useMemo } from 'react';
import { useAppContext } from '../AppWithRouter';
import type {
  ConversionOptions,
  ConversionTrack,
  ConversionResult,
  DryRunPreview,
  TargetFormat,
} from '../types';

export interface FormatConverterState {
  // ffmpeg availability
  ffmpegAvailable: boolean | null;
  ffmpegError: string | null;

  // Conversion options
  options: ConversionOptions;

  // Filtered tracks
  sourceFormatFilter: string;
  filteredTracks: ConversionTrack[];

  // Dry run
  dryRunResults: DryRunPreview[];
  isDryRunning: boolean;

  // Conversion
  isConverting: boolean;
  conversionResults: ConversionResult[];
}

const SOURCE_FORMATS: Record<string, string[]> = {
  flac: ['FLAC File', 'FLAC'],
  wav: ['WAV File', 'WAV'],
  aiff: ['AIFF File', 'AIFF'],
  mp3: ['MP3 File', 'MP3'],
  m4a: ['M4A File', 'AAC File', 'M4A', 'AAC'],
};

/**
 * Determine whether a track's Kind matches the given format filter.
 */
function matchesFormat(kind: string | undefined, filter: string): boolean {
  if (!filter || filter === 'all') return true;
  if (!kind) return false;
  const kindUpper = kind.toUpperCase();
  const candidates = SOURCE_FORMATS[filter];
  if (candidates) {
    return candidates.some((c) => kindUpper.includes(c.toUpperCase()));
  }
  return kindUpper.includes(filter.toUpperCase());
}

export function useFormatConverter(
  showNotification: (type: 'success' | 'error' | 'info', message: string) => void
) {
  const { libraryData, libraryPath, setLibraryData } = useAppContext();

  // ffmpeg check
  const [ffmpegAvailable, setFfmpegAvailable] = useState<boolean | null>(null);
  const [ffmpegError, setFfmpegError] = useState<string | null>(null);

  // Options
  const [options, setOptions] = useState<ConversionOptions>({
    targetFormat: 'mp3',
    bitrate: 320,
    deleteOriginals: false,
  });

  // Filter
  const [sourceFormatFilter, setSourceFormatFilter] = useState<string>('flac');

  // Dry run
  const [dryRunResults, setDryRunResults] = useState<DryRunPreview[]>([]);
  const [isDryRunning, setIsDryRunning] = useState(false);

  // Conversion
  const [isConverting, setIsConverting] = useState(false);
  const [conversionResults, setConversionResults] = useState<ConversionResult[]>([]);

  // Derive filtered tracks from library
  const filteredTracks: ConversionTrack[] = useMemo(() => {
    if (!libraryData?.tracks) return [];
    const result: ConversionTrack[] = [];
    libraryData.tracks.forEach((track: any, id: string) => {
      if (matchesFormat(track.kind, sourceFormatFilter)) {
        result.push({
          id,
          name: track.name,
          artist: track.artist,
          location: track.location,
          kind: track.kind,
          bitrate: track.bitrate,
          size: track.size,
        });
      }
    });
    return result;
  }, [libraryData, sourceFormatFilter]);

  // ── Check ffmpeg ──
  const checkFFmpeg = useCallback(async () => {
    try {
      const response = await window.electronAPI.checkFFmpeg();
      if (response.success) {
        setFfmpegAvailable(response.data.available);
        setFfmpegError(response.data.error || null);
      } else {
        setFfmpegAvailable(false);
        setFfmpegError(response.error || 'Unknown error');
      }
    } catch (err) {
      setFfmpegAvailable(false);
      setFfmpegError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  // ── Update options ──
  const updateOption = useCallback(
    <K extends keyof ConversionOptions>(key: K, value: ConversionOptions[K]) => {
      setOptions((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const setTargetFormat = useCallback((format: TargetFormat) => {
    updateOption('targetFormat', format);
  }, [updateOption]);

  const setBitrate = useCallback((bitrate: number) => {
    updateOption('bitrate', bitrate);
  }, [updateOption]);

  const setDeleteOriginals = useCallback((del: boolean) => {
    updateOption('deleteOriginals', del);
  }, [updateOption]);

  const setOutputDirectory = useCallback(async () => {
    const folder = await window.electronAPI.selectFolder();
    if (folder) {
      updateOption('outputDirectory', folder);
    }
  }, [updateOption]);

  const clearOutputDirectory = useCallback(() => {
    updateOption('outputDirectory', undefined);
  }, [updateOption]);

  // ── Dry run ──
  const runDryRun = useCallback(async () => {
    if (filteredTracks.length === 0) {
      showNotification('info', 'No tracks match the selected source format');
      return;
    }

    setIsDryRunning(true);
    try {
      const response = await window.electronAPI.dryRunConversion({
        tracks: filteredTracks,
        options,
      });
      if (response.success) {
        setDryRunResults(response.data);
        showNotification('info', `Preview: ${response.data.length} tracks would be converted`);
      } else {
        showNotification('error', response.error || 'Dry run failed');
      }
    } catch (err) {
      showNotification('error', err instanceof Error ? err.message : 'Dry run failed');
    } finally {
      setIsDryRunning(false);
    }
  }, [filteredTracks, options, showNotification]);

  // ── Convert ──
  const startConversion = useCallback(async () => {
    if (filteredTracks.length === 0) {
      showNotification('info', 'No tracks to convert');
      return;
    }

    if (!libraryPath) {
      showNotification('error', 'No library loaded');
      return;
    }

    setIsConverting(true);
    setConversionResults([]);
    try {
      const response = await window.electronAPI.convertTracks({
        tracks: filteredTracks,
        options,
        libraryPath,
      });
      if (response.success) {
        const results: ConversionResult[] = response.data.results || [];
        setConversionResults(results);
        const successCount = results.filter((r: ConversionResult) => r.success).length;
        showNotification(
          'success',
          `Conversion complete: ${successCount}/${results.length} tracks converted` +
          (response.data.xmlUpdated
            ? `. XML updated (backup: ${response.data.backupPath})`
            : '')
        );

        // Reload library data to reflect XML changes
        if (response.data.xmlUpdated && libraryPath) {
          try {
            const updatedLibrary = await window.electronAPI.parseRekordboxLibrary(libraryPath);
            if (updatedLibrary.success) {
              setLibraryData({
                libraryPath,
                tracks: new Map(Object.entries(updatedLibrary.data.tracks)),
                playlists: updatedLibrary.data.playlists,
              });
            }
          } catch {
            // Silently ignore reload errors – data will refresh on next load
          }
        }
      } else {
        showNotification('error', response.error || 'Conversion failed');
      }
    } catch (err) {
      showNotification('error', err instanceof Error ? err.message : 'Conversion failed');
    } finally {
      setIsConverting(false);
    }
  }, [filteredTracks, options, libraryPath, showNotification, setLibraryData]);

  // ── Cancel ──
  const cancelConversion = useCallback(async (operationId: string) => {
    try {
      await window.electronAPI.cancelConversion(operationId);
    } catch (err) {
      console.error('Failed to cancel conversion:', err);
    }
  }, []);

  return {
    // ffmpeg
    ffmpegAvailable,
    ffmpegError,
    checkFFmpeg,

    // Options
    options,
    setTargetFormat,
    setBitrate,
    setDeleteOriginals,
    setOutputDirectory,
    clearOutputDirectory,

    // Filter
    sourceFormatFilter,
    setSourceFormatFilter,
    filteredTracks,

    // Dry run
    dryRunResults,
    isDryRunning,
    runDryRun,

    // Conversion
    isConverting,
    conversionResults,
    startConversion,
    cancelConversion,
  };
}
