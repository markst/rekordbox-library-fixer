/**
 * Audio quality helpers for duplicate resolution.
 *
 * Lossless formats (FLAC, WAV, AIFF) are inherently higher quality than lossy
 * formats (MP3, AAC, OGG) regardless of reported bitrate.  Rekordbox may store
 * lossless VBR files with BitRate = 0, so comparing raw bitrate numbers would
 * incorrectly rank a 320 kbps MP3 above a FLAC.
 *
 * Rather than adding an arbitrary numeric bonus, we classify tracks into
 * lossless vs lossy tiers.  A lossless track always wins over a lossy track.
 * Within the same tier, bitrate, file size, and metadata richness break ties.
 */

/** Extensions recognised as lossless audio formats. */
export const LOSSLESS_EXTENSIONS: readonly string[] = ['.flac', '.wav', '.aiff', '.aif'];

/** Returns `true` when the file extension indicates a lossless audio format. */
export function isLossless(location: string): boolean {
  const ext = location.includes('.')
    ? '.' + location.split('.').pop()!.toLowerCase()
    : '';
  return LOSSLESS_EXTENSIONS.includes(ext);
}
