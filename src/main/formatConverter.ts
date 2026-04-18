import * as fs from 'fs';
import * as path from 'path';
import { execFile, ChildProcess } from 'child_process';
import { mainLogger as appLogger } from './appLogger';

export type TargetFormat = 'mp3' | 'aiff' | 'wav';

export interface ConversionOptions {
  targetFormat: TargetFormat;
  bitrate: number;          // kbps – used for mp3; ignored for wav/aiff (lossless)
  outputDirectory?: string; // if omitted, converted files go next to originals
  deleteOriginals: boolean;
}

export interface ConversionTrack {
  id: string;
  name: string;
  artist: string;
  location: string;       // decoded file path
  kind?: string;
  bitrate?: number;
  size?: number;
}

export interface ConversionResult {
  trackId: string;
  trackName: string;
  originalPath: string;
  convertedPath?: string;
  success: boolean;
  error?: string;
  newSize?: number;
  newBitrate?: number;
  newKind?: string;
}

const FORMAT_EXT: Record<TargetFormat, string> = {
  mp3: '.mp3',
  aiff: '.aiff',
  wav: '.wav',
};

const FORMAT_KIND: Record<TargetFormat, string> = {
  mp3: 'MP3 File',
  aiff: 'AIFF File',
  wav: 'WAV File',
};

/**
 * Resolve the ffmpeg binary path.
 * Checks the system PATH first – returns 'ffmpeg' so execFile resolves via PATH.
 * Throws if ffmpeg is not available.
 */
async function resolveFFmpegPath(): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    execFile('ffmpeg', ['-version'], (error) => {
      if (error) {
        reject(
          new Error(
            'ffmpeg is not installed or not found in PATH. ' +
            'Please install ffmpeg (https://ffmpeg.org/download.html) and try again.'
          )
        );
      } else {
        resolve('ffmpeg');
      }
    });
  });
}

/**
 * Build the ffmpeg arguments for a given conversion.
 */
function buildFFmpegArgs(
  inputPath: string,
  outputPath: string,
  options: ConversionOptions
): string[] {
  const args = ['-y', '-i', inputPath];

  switch (options.targetFormat) {
    case 'mp3':
      args.push(
        '-codec:a', 'libmp3lame',
        '-b:a', `${options.bitrate}k`,
        '-map_metadata', '0'
      );
      break;
    case 'aiff':
      args.push(
        '-codec:a', 'pcm_s16be',
        '-f', 'aiff',
        '-map_metadata', '0'
      );
      break;
    case 'wav':
      args.push(
        '-codec:a', 'pcm_s16le',
        '-f', 'wav',
        '-map_metadata', '0'
      );
      break;
  }

  args.push(outputPath);
  return args;
}

/**
 * Compute the output file path for a converted file.
 */
function getOutputPath(
  inputPath: string,
  options: ConversionOptions
): string {
  const dir = options.outputDirectory || path.dirname(inputPath);
  const baseName = path.basename(inputPath, path.extname(inputPath));
  const ext = FORMAT_EXT[options.targetFormat];
  return path.join(dir, `${baseName}${ext}`);
}

/**
 * Convert a single audio file using ffmpeg.
 */
async function convertFile(
  ffmpegPath: string,
  inputPath: string,
  outputPath: string,
  options: ConversionOptions
): Promise<void> {
  // Ensure output directory exists
  const outDir = path.dirname(outputPath);
  await fs.promises.mkdir(outDir, { recursive: true });

  const args = buildFFmpegArgs(inputPath, outputPath, options);

  return new Promise<void>((resolve, reject) => {
    const proc: ChildProcess = execFile(
      ffmpegPath,
      args,
      { maxBuffer: 10 * 1024 * 1024 },
      (error, _stdout, stderr) => {
        if (error) {
          reject(new Error(`ffmpeg failed: ${stderr || error.message}`));
        } else {
          resolve();
        }
      }
    );

    // Ensure child process is cleaned up
    proc.on('error', (err) => {
      reject(new Error(`Failed to start ffmpeg: ${err.message}`));
    });
  });
}

export class FormatConverter {
  private activeOperations = new Map<string, { cancelled: boolean }>();

  /**
   * Check whether ffmpeg is available on this system.
   */
  async checkFFmpeg(): Promise<{ available: boolean; error?: string }> {
    try {
      await resolveFFmpegPath();
      return { available: true };
    } catch (err) {
      return {
        available: false,
        error: err instanceof Error ? err.message : 'ffmpeg not found',
      };
    }
  }

  /**
   * Dry-run: return what *would* happen without touching any files.
   */
  dryRun(
    tracks: ConversionTrack[],
    options: ConversionOptions
  ): Array<{ trackId: string; trackName: string; inputPath: string; outputPath: string }> {
    return tracks.map((track) => ({
      trackId: track.id,
      trackName: track.name,
      inputPath: track.location,
      outputPath: getOutputPath(track.location, options),
    }));
  }

  /**
   * Cancel a running conversion operation.
   */
  cancelConversion(operationId: string): void {
    const token = this.activeOperations.get(operationId);
    if (token) {
      token.cancelled = true;
      appLogger.info(`⚠️ Conversion operation ${operationId} cancelled`);
    }
  }

  /**
   * Convert a batch of tracks, emitting progress via the supplied callback.
   *
   * @returns Array of ConversionResult for each track.
   */
  async convertTracks(
    tracks: ConversionTrack[],
    options: ConversionOptions,
    operationId: string,
    onProgress: (progress: ConversionProgress) => void
  ): Promise<ConversionResult[]> {
    const cancelToken = { cancelled: false };
    this.activeOperations.set(operationId, cancelToken);

    const results: ConversionResult[] = [];

    try {
      // Verify ffmpeg first
      const ffmpegPath = await resolveFFmpegPath();

      onProgress({
        operationId,
        type: 'start',
        total: tracks.length,
        current: 0,
        message: 'Starting format conversion...',
      });

      let successCount = 0;

      for (let i = 0; i < tracks.length; i++) {
        if (cancelToken.cancelled) {
          onProgress({
            operationId,
            type: 'cancelled',
            total: tracks.length,
            current: i,
            successCount,
            message: 'Conversion cancelled',
          });
          break;
        }

        const track = tracks[i];
        const outputPath = getOutputPath(track.location, options);

        onProgress({
          operationId,
          type: 'converting',
          total: tracks.length,
          current: i + 1,
          trackName: track.name,
          trackArtist: track.artist,
          message: `Converting: ${track.name}`,
          successCount,
        });

        try {
          // Check source file exists
          await fs.promises.access(track.location, fs.constants.R_OK);

          // Run conversion
          await convertFile(ffmpegPath, track.location, outputPath, options);

          // Get converted file stats
          const stats = await fs.promises.stat(outputPath);
          const newSize = stats.size;

          // Compute approximate bitrate for the result
          const newBitrate = options.targetFormat === 'mp3'
            ? options.bitrate
            : undefined;

          const newKind = FORMAT_KIND[options.targetFormat];

          // Optionally delete original
          if (options.deleteOriginals) {
            await fs.promises.unlink(track.location);
            appLogger.info(`🗑️ Deleted original: ${track.location}`);
          }

          successCount++;

          results.push({
            trackId: track.id,
            trackName: track.name,
            originalPath: track.location,
            convertedPath: outputPath,
            success: true,
            newSize,
            newBitrate,
            newKind,
          });

          onProgress({
            operationId,
            type: 'converted',
            total: tracks.length,
            current: i + 1,
            trackName: track.name,
            trackArtist: track.artist,
            message: `Converted: ${track.name}`,
            successCount,
          });

          appLogger.info(
            `✅ Converted "${track.name}": ${track.location} → ${outputPath}`
          );
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error';
          results.push({
            trackId: track.id,
            trackName: track.name,
            originalPath: track.location,
            success: false,
            error: errorMsg,
          });

          onProgress({
            operationId,
            type: 'error',
            total: tracks.length,
            current: i + 1,
            trackName: track.name,
            trackArtist: track.artist,
            message: `Failed: ${track.name} - ${errorMsg}`,
            successCount,
          });

          appLogger.error(`❌ Failed to convert "${track.name}": ${errorMsg}`);
        }
      }

      if (!cancelToken.cancelled) {
        onProgress({
          operationId,
          type: 'complete',
          total: tracks.length,
          current: tracks.length,
          successCount,
          message: `Complete: ${successCount}/${tracks.length} tracks converted`,
        });
      }
    } finally {
      this.activeOperations.delete(operationId);
    }

    return results;
  }
}

export interface ConversionProgress {
  operationId: string;
  type:
    | 'start'
    | 'converting'
    | 'converted'
    | 'complete'
    | 'cancelled'
    | 'error';
  total: number;
  current: number;
  successCount?: number;
  trackName?: string;
  trackArtist?: string;
  message: string;
}
