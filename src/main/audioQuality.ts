/**
 * Audio quality scoring constants for duplicate resolution.
 *
 * Lossless formats (FLAC, WAV, AIFF) are VBR and Rekordbox may store their
 * BitRate as 0. Without a format-aware bonus, a 320 kbps MP3 (score ~3200)
 * would incorrectly outrank a lossless file (score ~0).
 *
 * The bonus is set high enough to always outrank the maximum realistic lossy
 * bitrate score (320 kbps × 10 = 3200) while still allowing bitrate and file
 * size to break ties between two lossless files.
 */

/** Extensions recognised as lossless audio formats. */
export const LOSSLESS_EXTENSIONS = ['.flac', '.wav', '.aiff', '.aif'];

/**
 * Quality-score bonus added to tracks whose file extension is in
 * {@link LOSSLESS_EXTENSIONS}.  The value must exceed the maximum possible
 * lossy bitrate contribution (320 × 10 = 3 200) so that any lossless file
 * always ranks above any lossy file.
 */
export const LOSSLESS_FORMAT_BONUS = 5000;
