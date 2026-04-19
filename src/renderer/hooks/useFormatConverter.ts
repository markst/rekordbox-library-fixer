import { useState, useCallback, useMemo, useEffect } from 'react';
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

  // Selection
  selectedTrackIds: Set<string>;
  selectedTracks: ConversionTrack[];

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

  // Selection
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(new Set());

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

  // Select all filtered tracks by default when filter changes
  useEffect(() => {
    setSelectedTrackIds(new Set(filteredTracks.map((t) => t.id)));
  }, [filteredTracks]);

  // Derive selected tracks (only those still in the filtered list)
  const selectedTracks: ConversionTrack[] = useMemo(() => {
    return filteredTracks.filter((t) => selectedTrackIds.has(t.id));
  }, [filteredTracks, selectedTrackIds]);

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

  // ── Selection helpers ──
  const toggleTrackSelection = useCallback((trackId: string) => {
    setSelectedTrackIds((prev) => {
      const next = new Set(prev);
      if (next.has(trackId)) {
        next.delete(trackId);
      } else {
        next.add(trackId);
      }
      return next;
    });
  }, []);

  const selectAllTracks = useCallback(() => {
    setSelectedTrackIds(new Set(filteredTracks.map((t) => t.id)));
  }, [filteredTracks]);

  const deselectAllTracks = useCallback(() => {
    setSelectedTrackIds(new Set());
  }, []);

  // ── Dry run ──
  const runDryRun = useCallback(async () => {
    if (selectedTracks.length === 0) {
      showNotification('info', 'No tracks selected');
      return;
    }

    setIsDryRunning(true);
    try {
      const response = await window.electronAPI.dryRunConversion({
        tracks: selectedTracks,
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
  }, [selectedTracks, options, showNotification]);

  // ── Convert ──
  const startConversion = useCallback(async () => {
    if (selectedTracks.length === 0) {
      showNotification('info', 'No tracks selected');
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
        tracks: selectedTracks,
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
              // IPC preserves the Map via structured clone, so use it directly
              // (Object.entries() on a Map returns [] and would empty the track list)
              setLibraryData({
                libraryPath,
                tracks: updatedLibrary.data.tracks,
                playlists: updatedLibrary.data.playlists,
              });
            }
          } catch (reloadErr) {
            console.error('Failed to reload library after conversion:', reloadErr);
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
  }, [selectedTracks, options, libraryPath, showNotification, setLibraryData]);

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

    // Selection
    selectedTrackIds,
    selectedTracks,
    toggleTrackSelection,
    selectAllTracks,
    deselectAllTracks,

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
