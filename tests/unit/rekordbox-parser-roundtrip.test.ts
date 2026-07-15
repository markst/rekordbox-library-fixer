import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RekordboxParser } from '../../src/main/rekordboxParser';
import type { Track, Playlist, RekordboxLibrary } from '../../src/main/rekordboxParser';
import fs from 'fs';
import path from 'path';

// We need real fs for reading fixtures; the global mock keeps readFileSync real.
// For parseLibrary (which uses fs.promises.readFile) and saveLibrary (which uses
// fs.promises.writeFile), we set up targeted mocks per test.

const FIXTURE_PATH = path.join(__dirname, '..', 'fixtures', 'roundtrip-library.xml');
const fixtureXml = fs.readFileSync(FIXTURE_PATH, 'utf-8');

describe('RekordboxParser', () => {
  let parser: RekordboxParser;

  beforeEach(() => {
    parser = new RekordboxParser();
    vi.clearAllMocks();
  });

  // ── Parsing Tests ─────────────────────────────────────────────────────

  describe('parseLibrary', () => {
    let library: RekordboxLibrary;

    beforeEach(async () => {
      // Make fs.promises.readFile return our fixture content
      const fsPromises = (await import('fs')).promises;
      vi.mocked(fsPromises.readFile).mockResolvedValue(fixtureXml);
      library = await parser.parseLibrary(FIXTURE_PATH);
    });

    it('should parse the correct number of tracks', () => {
      expect(library.tracks.size).toBe(4);
    });

    it('should return tracks as a Map', () => {
      expect(library.tracks).toBeInstanceOf(Map);
    });

    it('should preserve all basic metadata fields', () => {
      const track = library.tracks.get('101')!;
      expect(track).toBeDefined();
      expect(track.id).toBe('101');
      expect(track.name).toBe('Deep House Groove');
      expect(track.artist).toBe('DJ Alpha');
      expect(track.album).toBe('Deep Cuts Vol.1');
      expect(track.genre).toBe('Deep House');
      expect(track.bpm).toBe(122.5);
      expect(track.key).toBe('Am');
      expect(track.comments).toBe('Great opener');
      expect(track.playCount).toBe(15);
      expect(track.rating).toBe(5);
      expect(track.duration).toBe(342);
    });

    it('should preserve required Rekordbox metadata fields', () => {
      const track = library.tracks.get('101')!;
      expect(track.composer).toBe('Alpha Composer');
      expect(track.grouping).toBe('Set A');
      expect(track.kind).toBe('FLAC File');
      expect(track.discNumber).toBe(1);
      expect(track.trackNumber).toBe(3);
      expect(track.year).toBe(2024);
      expect(track.sampleRate).toBe(44100);
      expect(track.remixer).toBe('Beta Remixer');
      expect(track.label).toBe('Deep Records');
      expect(track.mix).toBe('Original Mix');
    });

    it('should preserve size and bitrate as numbers', () => {
      const track = library.tracks.get('101')!;
      expect(track.size).toBe(45000000);
      expect(track.bitrate).toBe(1411);
    });

    it('should parse dateAdded as Date object', () => {
      const track = library.tracks.get('101')!;
      expect(track.dateAdded).toBeInstanceOf(Date);
      expect(track.dateAdded!.toISOString().startsWith('2024-06-15')).toBe(true);
    });

    it('should decode URL-encoded Location to a file path', () => {
      const track = library.tracks.get('101')!;
      expect(track.location).toBe('/Users/test/Music/Deep House Groove.flac');
    });

    it('should decode URL-encoded special characters in paths', () => {
      const track = library.tracks.get('103')!;
      expect(track.location).toBe('/Users/test/Music/café-dançante.wav');
    });

    it('should decode hash (#) characters in Location', () => {
      const track = library.tracks.get('104')!;
      expect(track.location).toBe('/Users/test/Music/Path With #Hash.aiff');
    });

    it('should parse cue points correctly', () => {
      const track = library.tracks.get('101')!;
      expect(track.cues).toHaveLength(3);
      expect(track.cues![0]).toMatchObject({ type: 'CUE', start: 0, name: 'Intro' });
      expect(track.cues![1]).toMatchObject({ type: 'CUE', start: 32.5, name: 'Drop', hotcue: 1 });
      expect(track.cues![2]).toMatchObject({ type: 'CUE', start: 128, name: 'Breakdown', hotcue: 2 });
    });

    it('should parse loop points correctly', () => {
      const track = library.tracks.get('101')!;
      expect(track.loops).toHaveLength(2);
      expect(track.loops![0]).toMatchObject({ start: 64, end: 96, name: 'Main Loop' });
      expect(track.loops![1]).toMatchObject({ start: 192, end: 224, name: 'Outro Loop' });
    });

    it('should parse multiple TEMPO elements', () => {
      const track = library.tracks.get('101')!;
      expect(track.tempos).toHaveLength(2);
      expect(track.tempos![0]).toMatchObject({ bpm: 122.5, inizio: 0.045, metro: '4/4', battito: 1 });
      expect(track.tempos![1]).toMatchObject({ bpm: 122.5, inizio: 15.123, metro: '4/4', battito: 3 });
    });

    it('should create beatgrid from first TEMPO element', () => {
      const track = library.tracks.get('101')!;
      expect(track.beatgrid).toMatchObject({ bpm: 122.5, offset: 0.045 });
    });

    it('should handle tracks with no cues or loops', () => {
      const track = library.tracks.get('104')!;
      expect(track.cues).toEqual([]);
      expect(track.loops).toEqual([]);
    });

    it('should handle tracks with empty optional fields', () => {
      const track = library.tracks.get('102')!;
      expect(track.composer).toBe('');
      expect(track.grouping).toBe('');
      expect(track.remixer).toBe('');
      expect(track.label).toBe('');
      expect(track.mix).toBe('');
    });

    it('should handle different Kind values (FLAC, MP3, WAV, AIFF)', () => {
      expect(library.tracks.get('101')!.kind).toBe('FLAC File');
      expect(library.tracks.get('102')!.kind).toBe('MP3 File');
      expect(library.tracks.get('103')!.kind).toBe('WAV File');
      expect(library.tracks.get('104')!.kind).toBe('AIFF File');
    });

    // ── Playlist Parsing ──

    it('should parse playlists', () => {
      expect(library.playlists.length).toBeGreaterThan(0);
    });

    it('should parse playlist tracks', () => {
      const deepHouse = library.playlists.find(p => p.name === 'Deep House');
      expect(deepHouse).toBeDefined();
      expect(deepHouse!.tracks).toEqual(['101', '103']);
    });

    it('should parse nested folder structure', () => {
      const folders = library.playlists.find(p => p.name === 'Folders');
      expect(folders).toBeDefined();
      expect(folders!.type).toBe('FOLDER');
      expect(folders!.children).toHaveLength(1);
      expect(folders!.children![0].name).toBe('Ambient');
      expect(folders!.children![0].tracks).toEqual(['104']);
    });

    it('should assign playlist references to tracks', () => {
      const track = library.tracks.get('101')!;
      expect(track.playlists).toContain('Deep House');
    });
  });

  // ── Roundtrip Tests ───────────────────────────────────────────────────

  describe('roundtrip: parseLibrary → saveLibrary → parseLibrary', () => {
    let originalLibrary: RekordboxLibrary;
    let roundtrippedLibrary: RekordboxLibrary;

    beforeEach(async () => {
      const fsPromises = (await import('fs')).promises;

      // Step 1: Parse the fixture
      vi.mocked(fsPromises.readFile).mockResolvedValue(fixtureXml);
      originalLibrary = await parser.parseLibrary(FIXTURE_PATH);

      // Step 2: Save to XML — capture the written content
      let savedXml = '';
      vi.mocked(fsPromises.writeFile).mockImplementation(async (_path: any, content: any) => {
        savedXml = content as string;
      });
      await parser.saveLibrary(originalLibrary, '/tmp/roundtrip-output.xml');
      expect(savedXml.length).toBeGreaterThan(0);

      // Step 3: Parse the saved XML
      vi.mocked(fsPromises.readFile).mockResolvedValue(savedXml);
      roundtrippedLibrary = await parser.parseLibrary('/tmp/roundtrip-output.xml');
    });

    it('should preserve the same number of tracks', () => {
      expect(roundtrippedLibrary.tracks.size).toBe(originalLibrary.tracks.size);
    });

    it('should preserve track IDs', () => {
      const originalIds = Array.from(originalLibrary.tracks.keys()).sort();
      const roundtrippedIds = Array.from(roundtrippedLibrary.tracks.keys()).sort();
      expect(roundtrippedIds).toEqual(originalIds);
    });

    it('should preserve all basic metadata after roundtrip', () => {
      for (const [id, original] of originalLibrary.tracks) {
        const roundtripped = roundtrippedLibrary.tracks.get(id)!;
        expect(roundtripped, `Track ${id} missing after roundtrip`).toBeDefined();

        expect(roundtripped.name).toBe(original.name);
        expect(roundtripped.artist).toBe(original.artist);
        expect(roundtripped.album).toBe(original.album || '');
        expect(roundtripped.genre).toBe(original.genre);
        expect(roundtripped.bpm).toBe(original.bpm);
        expect(roundtripped.key).toBe(original.key);
        expect(roundtripped.comments).toBe(original.comments);
        expect(roundtripped.playCount).toBe(original.playCount);
        expect(roundtripped.rating).toBe(original.rating);
        expect(roundtripped.duration).toBe(original.duration);
      }
    });

    it('should preserve required Rekordbox fields after roundtrip', () => {
      for (const [id, original] of originalLibrary.tracks) {
        const roundtripped = roundtrippedLibrary.tracks.get(id)!;

        expect(roundtripped.composer).toBe(original.composer);
        expect(roundtripped.grouping).toBe(original.grouping);
        expect(roundtripped.kind).toBe(original.kind);
        expect(roundtripped.discNumber).toBe(original.discNumber);
        expect(roundtripped.trackNumber).toBe(original.trackNumber);
        expect(roundtripped.year).toBe(original.year);
        expect(roundtripped.sampleRate).toBe(original.sampleRate);
        expect(roundtripped.remixer).toBe(original.remixer);
        expect(roundtripped.label).toBe(original.label);
        expect(roundtripped.mix).toBe(original.mix);
      }
    });

    it('should preserve Kind field for all format types', () => {
      expect(roundtrippedLibrary.tracks.get('101')!.kind).toBe('FLAC File');
      expect(roundtrippedLibrary.tracks.get('102')!.kind).toBe('MP3 File');
      expect(roundtrippedLibrary.tracks.get('103')!.kind).toBe('WAV File');
      expect(roundtrippedLibrary.tracks.get('104')!.kind).toBe('AIFF File');
    });

    it('should preserve size and bitrate after roundtrip', () => {
      for (const [id, original] of originalLibrary.tracks) {
        const roundtripped = roundtrippedLibrary.tracks.get(id)!;
        expect(roundtripped.size).toBe(original.size);
        expect(roundtripped.bitrate).toBe(original.bitrate);
      }
    });

    it('should preserve cue points after roundtrip', () => {
      const original = originalLibrary.tracks.get('101')!;
      const roundtripped = roundtrippedLibrary.tracks.get('101')!;

      expect(roundtripped.cues).toHaveLength(original.cues!.length);
      for (let i = 0; i < original.cues!.length; i++) {
        expect(roundtripped.cues![i].type).toBe(original.cues![i].type);
        expect(roundtripped.cues![i].start).toBe(original.cues![i].start);
        expect(roundtripped.cues![i].name).toBe(original.cues![i].name);
        expect(roundtripped.cues![i].hotcue).toBe(original.cues![i].hotcue);
      }
    });

    it('should preserve loop points after roundtrip', () => {
      const original = originalLibrary.tracks.get('101')!;
      const roundtripped = roundtrippedLibrary.tracks.get('101')!;

      expect(roundtripped.loops).toHaveLength(original.loops!.length);
      for (let i = 0; i < original.loops!.length; i++) {
        expect(roundtripped.loops![i].start).toBe(original.loops![i].start);
        expect(roundtripped.loops![i].end).toBe(original.loops![i].end);
        expect(roundtripped.loops![i].name).toBe(original.loops![i].name);
      }
    });

    it('should preserve all TEMPO elements after roundtrip', () => {
      for (const [id, original] of originalLibrary.tracks) {
        const roundtripped = roundtrippedLibrary.tracks.get(id)!;
        expect(roundtripped.tempos).toHaveLength(original.tempos!.length);

        for (let i = 0; i < original.tempos!.length; i++) {
          expect(roundtripped.tempos![i].bpm).toBe(original.tempos![i].bpm);
          expect(roundtripped.tempos![i].inizio).toBe(original.tempos![i].inizio);
          expect(roundtripped.tempos![i].metro).toBe(original.tempos![i].metro);
          expect(roundtripped.tempos![i].battito).toBe(original.tempos![i].battito);
        }
      }
    });

    it('should preserve Location paths after roundtrip (including special chars)', () => {
      for (const [id, original] of originalLibrary.tracks) {
        const roundtripped = roundtrippedLibrary.tracks.get(id)!;
        expect(roundtripped.location).toBe(original.location);
      }
    });

    it('should preserve playlist structure after roundtrip', () => {
      expect(roundtrippedLibrary.playlists.length).toBe(originalLibrary.playlists.length);

      const originalNames = originalLibrary.playlists.map(p => p.name).sort();
      const roundtrippedNames = roundtrippedLibrary.playlists.map(p => p.name).sort();
      expect(roundtrippedNames).toEqual(originalNames);
    });

    it('should preserve playlist track assignments after roundtrip', () => {
      const findPlaylist = (playlists: Playlist[], name: string): Playlist | undefined => {
        for (const p of playlists) {
          if (p.name === name) return p;
          if (p.children) {
            const found = findPlaylist(p.children, name);
            if (found) return found;
          }
        }
        return undefined;
      };

      const originalDeepHouse = findPlaylist(originalLibrary.playlists, 'Deep House')!;
      const roundtrippedDeepHouse = findPlaylist(roundtrippedLibrary.playlists, 'Deep House')!;
      expect(roundtrippedDeepHouse.tracks).toEqual(originalDeepHouse.tracks);

      const originalTechno = findPlaylist(originalLibrary.playlists, 'Techno')!;
      const roundtrippedTechno = findPlaylist(roundtrippedLibrary.playlists, 'Techno')!;
      expect(roundtrippedTechno.tracks).toEqual(originalTechno.tracks);
    });

    it('should preserve nested playlist folders after roundtrip', () => {
      const findPlaylist = (playlists: Playlist[], name: string): Playlist | undefined => {
        for (const p of playlists) {
          if (p.name === name) return p;
          if (p.children) {
            const found = findPlaylist(p.children, name);
            if (found) return found;
          }
        }
        return undefined;
      };

      const folders = findPlaylist(roundtrippedLibrary.playlists, 'Folders')!;
      expect(folders.type).toBe('FOLDER');
      expect(folders.children).toHaveLength(1);
      expect(folders.children![0].name).toBe('Ambient');
      expect(folders.children![0].tracks).toEqual(['104']);
    });
  });

  // ── XML Output Format Tests ───────────────────────────────────────────

  describe('saveLibrary XML output format', () => {
    let savedXml: string;

    beforeEach(async () => {
      const fsPromises = (await import('fs')).promises;
      vi.mocked(fsPromises.readFile).mockResolvedValue(fixtureXml);
      const library = await parser.parseLibrary(FIXTURE_PATH);

      vi.mocked(fsPromises.writeFile).mockImplementation(async (_path: any, content: any) => {
        savedXml = content as string;
      });
      await parser.saveLibrary(library, '/tmp/output.xml');
    });

    it('should include XML declaration', () => {
      expect(savedXml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    });

    it('should include DJ_PLAYLISTS root element', () => {
      expect(savedXml).toContain('<DJ_PLAYLISTS');
      expect(savedXml).toContain('</DJ_PLAYLISTS>');
    });

    it('should include COLLECTION with correct Entries count', () => {
      expect(savedXml).toContain('Entries="4"');
    });

    it('should use file://localhost format for Location URLs', () => {
      expect(savedXml).toContain('Location="file://localhost/');
      // Should NOT have double-encoded slashes
      expect(savedXml).not.toContain('file://localhost%2F');
    });

    it('should URL-encode spaces in Location paths', () => {
      expect(savedXml).toContain('Deep%20House%20Groove');
    });

    it('should URL-encode hash (#) characters in Location paths', () => {
      expect(savedXml).toContain('%23Hash');
    });

    it('should include Kind attribute in TRACK elements', () => {
      expect(savedXml).toContain('Kind="FLAC File"');
      expect(savedXml).toContain('Kind="MP3 File"');
      expect(savedXml).toContain('Kind="WAV File"');
      expect(savedXml).toContain('Kind="AIFF File"');
    });

    it('should include TEMPO elements with Metro and Battito attributes', () => {
      expect(savedXml).toContain('Metro="4/4"');
      expect(savedXml).toContain('Battito="1"');
      expect(savedXml).toContain('Battito="3"');
    });

    it('should include all required Rekordbox track attributes', () => {
      // These are mandatory for Rekordbox import compatibility
      const requiredAttrs = [
        'TrackID', 'Name', 'Artist', 'Composer', 'Album', 'Grouping',
        'Genre', 'Kind', 'Size', 'TotalTime', 'DiscNumber', 'TrackNumber',
        'Year', 'AverageBpm', 'DateAdded', 'BitRate', 'SampleRate',
        'Comments', 'PlayCount', 'Rating', 'Location', 'Remixer',
        'Tonality', 'Label', 'Mix',
      ];
      for (const attr of requiredAttrs) {
        expect(savedXml, `Missing attribute: ${attr}`).toContain(`${attr}="`);
      }
    });

    it('should include POSITION_MARK elements for cues and loops', () => {
      expect(savedXml).toContain('POSITION_MARK');
      expect(savedXml).toContain('Type="CUE"');
      expect(savedXml).toContain('Type="LOOP"');
    });

    it('should include NODE elements for playlists', () => {
      expect(savedXml).toContain('Name="ROOT"');
      expect(savedXml).toContain('Name="Deep House"');
      expect(savedXml).toContain('Name="Techno"');
      expect(savedXml).toContain('Name="Ambient"');
    });
  });
});
