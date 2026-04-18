// Global types and interfaces

export type TabType = 'duplicates' | 'import' | 'relocate' | 'maintenance' | 'convert';

export type NotificationType = 'success' | 'error' | 'info';

export interface Notification {
  type: NotificationType;
  message: string;
}

export interface Playlist {
  name: string;
  tracks: string[]; // Track IDs
  type: 'FOLDER' | 'PLAYLIST';
  children?: Playlist[];
}

export interface LibraryData {
  libraryPath: string;
  tracks: Map<string, any>;
  playlists: Playlist[];
}

export interface DuplicateItem {
  id: string;
  tracks: Track[];
  matchType: string;
  confidence: number;
  pathPreferences?: string[];
}

export interface Track {
  id: string;
  name: string;
  artist: string;
  album?: string;
  location: string;
  duration?: number;
  bitrate?: number;
  size?: number;
  dateAdded?: string;
  dateModified?: string;
  rating?: number;
  cues?: any[];
  loops?: any[];
}

export interface ScanOptions {
  useFingerprint: boolean;
  useMetadata: boolean;
  metadataFields: string[];
  pathPreferences: string[];
}

export type ResolutionStrategy =
  | 'keep-highest-quality'
  | 'keep-newest'
  | 'keep-oldest'
  | 'keep-preferred-path'
  | 'manual';

// Track Relocation types
export interface MissingTrack {
  id: string;
  name: string;
  artist: string;
  album?: string;
  originalLocation: string;
  size?: number;
  duration?: number;
  dateAdded?: string;
  isUnlocatable?: boolean; // Track marked as unlocatable after failed auto-relocation
}

export interface RelocationCandidate {
  path: string;
  score: number;
  matchType: 'exact' | 'fuzzy' | 'metadata' | 'size';
  confidence: number;
}

export interface RelocationOptions {
  searchPaths: string[];
  searchDepth: number;
  matchThreshold: number;
  includeSubdirectories: boolean;
  fileExtensions: string[];
}

export interface RelocationResult {
  trackId: string;
  oldLocation: string;
  newLocation?: string;
  success: boolean;
  candidates?: RelocationCandidate[];
  error?: string;
}

// Cloud Sync types
export interface CloudSyncIssue {
  trackId: string;
  trackName: string;
  originalLocation: string;
  issueType: 'online-only' | 'path-mismatch' | 'missing-local' | 'sync-conflict';
  cloudPath?: string;
  localPath?: string;
  severity: 'low' | 'medium' | 'high';
}

export interface CloudSyncFix {
  trackId: string;
  originalLocation: string;
  fixedLocation?: string;
  success: boolean;
  action: 'download' | 'path-update' | 'local-copy' | 'manual-required';
  error?: string;
}

// Track Ownership types
export interface OwnershipIssue {
  trackId: string;
  trackName: string;
  trackLocation: string;
  currentOwner?: string;
  expectedOwner?: string;
  issueType: 'grey-track' | 'wrong-owner' | 'missing-owner';
  severity: 'low' | 'medium' | 'high';
}

export interface OwnershipFix {
  trackId: string;
  originalOwner?: string;
  newOwner: string;
  success: boolean;
  action: 'ownership-transfer' | 'owner-assignment' | 'uuid-update';
  error?: string;
}

// Format Converter types
export type TargetFormat = 'mp3' | 'aiff' | 'wav';

export interface ConversionOptions {
  targetFormat: TargetFormat;
  bitrate: number;
  outputDirectory?: string;
  deleteOriginals: boolean;
}

export interface ConversionTrack {
  id: string;
  name: string;
  artist: string;
  location: string;
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

export interface DryRunPreview {
  trackId: string;
  trackName: string;
  inputPath: string;
  outputPath: string;
}

// Electron API types
declare global {
  interface Window {
    electronAPI: {
      selectRekordboxXML: () => Promise<string | null>;
      selectFolder: () => Promise<string | null>;
      parseRekordboxLibrary: (xmlPath: string) => Promise<any>;
      findDuplicates: (options: any) => Promise<any>;
      resolveDuplicates: (resolution: any) => Promise<any>;
      saveRekordboxXML: (data: any) => Promise<any>;
      showFileInFolder: (filePath: string) => Promise<any>;
      // Track Relocation APIs
      findMissingTracks: (tracks: any) => Promise<any>;
      resetTrackLocations: (trackIds: string[]) => Promise<any>;
      autoRelocateTracks: (data: { tracks: any[], options: any, libraryPath: string }) => Promise<any>;
      findRelocationCandidates: (track: MissingTrack, options: RelocationOptions) => Promise<any>;
      relocateTrack: (trackId: string, oldLocation: string, newLocation: string) => Promise<any>;
      batchRelocateTracks: (data: { libraryPath: string; relocations: any[] }) => Promise<any>;
      // Cloud Sync APIs
      detectCloudSyncIssues: (tracks: any) => Promise<any>;
      fixCloudSyncIssue: (issue: CloudSyncIssue) => Promise<any>;
      batchFixCloudSyncIssues: (issues: CloudSyncIssue[]) => Promise<any>;
      initializeDropboxAPI: (config: any) => Promise<any>;
      // Track Ownership APIs
      detectOwnershipIssues: (tracks: any, computers: any) => Promise<any>;
      fixTrackOwnership: (issue: OwnershipIssue) => Promise<any>;
      batchFixOwnership: (issues: OwnershipIssue[]) => Promise<any>;
      updateLibraryOwnership: (library: any, fixes: OwnershipFix[]) => Promise<any>;
      // App version
      getAppVersion: () => Promise<{ success: boolean; data?: { version: string }; error?: string }>;
      // File Drop APIs
      handleNativeDrop: (filePaths: string[]) => Promise<{ success: boolean; data?: { filePaths: string[]; filePath?: string }; error?: string }>;
      onNativeFileDrop: (callback: (filePaths: string[]) => void) => () => void;
      // Format Converter APIs
      checkFFmpeg: () => Promise<any>;
      dryRunConversion: (data: { tracks: ConversionTrack[], options: ConversionOptions }) => Promise<any>;
      convertTracks: (data: { tracks: ConversionTrack[], options: ConversionOptions, libraryPath: string }) => Promise<any>;
      cancelConversion: (operationId: string) => Promise<any>;
      onConversionProgress: (callback: (progress: ConversionProgress) => void) => () => void;
      // Open external URLs
      openExternal: (url: string) => Promise<{ success: boolean; error?: string }>;
      // Event listeners
      onShowAbout: (callback: () => void) => () => void;
    };
  }
}