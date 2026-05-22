import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ClipboardEvent } from 'react';
import Fuse from 'fuse.js';
import { Check, ChevronDown, Clipboard, CloudBackup, Eye, EyeOff, ImageUp, Loader, Plus, Search, Trash2, X } from 'lucide-react';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { collection, deleteDoc, doc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import '../styles/Attendance.css';
import { auth, db } from '../config/firebase';
import { useFirestoreMembers } from '../hooks/useFirestoreMembers';
import { type AttendanceStatus, useFirestoreAttendance } from '../hooks/useFirestoreAttendance';
import { useFirestoreAttendanceSummary } from '../hooks/useFirestoreAttendanceSummary';
import { useFirestoreBossInfo } from '../hooks/useFirestoreBossInfo';
import { useFirestoreGuildInfo } from '../hooks/useFirestoreGuildInfo';
import { getAttendancePoints, getAttendancePointsForBossSelection } from '../utils/attendancePoints.ts';
import { getCombatPowerMultiplier, MINIMUM_ATTENDANCE_COMBAT_POWER } from '../utils/combatPowerMultiplier.ts';
import { getPhilippinesNowParts } from '../utils/philippinesTime';

interface AttendancePageProps {
  userType: 'guest' | 'admin';
  mode?: 'view' | 'manage';
}

type CreateAttendanceTab = 'ocr' | 'manual';

type OcrMatchReason = 'exact' | 'variant' | 'token' | 'fuzzy' | 'manual' | 'none';
type OcrRowStatus = 'matched' | 'review' | 'unmatched';
type OcrSourceKind = 'overlay' | 'parsed';
type OcrRowNotice = 'not_registered' | 'below_minimum_combat_power' | null;

interface OcrSuggestedMember {
  memberId: string;
  memberName: string;
  combatPower: number;
  multiplier: number;
  confidence: number;
  reason: OcrMatchReason;
}

interface OcrAttendanceRow {
  id: string;
  detectedName: string;
  displayName: string;
  matchedMemberId: string | null;
  matchedMemberName: string | null;
  suggestedMembers: OcrSuggestedMember[];
  combatPower: number | null;
  multiplier: number | null;
  status: OcrRowStatus;
  matchConfidence: number;
  matchReason: OcrMatchReason;
  notice: OcrRowNotice;
  autoApplied: boolean;
  source: OcrSourceKind;
}

const DEFAULT_OCR_PROXY_PATH = '/api/ocr-space';
const OCR_SPACE_ENDPOINT = import.meta.env.VITE_OCR_SPACE_ENDPOINT?.trim() || 'https://api.ocr.space/parse/image';
const OCR_SPACE_API_KEY = import.meta.env.VITE_OCR_SPACE_API_KEY?.trim() || '';
const OCR_SPACE_ENGINE = ['1', '2', '3'].includes(import.meta.env.VITE_OCR_SPACE_ENGINE?.trim() || '')
  ? (import.meta.env.VITE_OCR_SPACE_ENGINE?.trim() as '1' | '2' | '3')
  : '2';
const OCR_SPACE_LANGUAGE = import.meta.env.VITE_OCR_SPACE_LANGUAGE?.trim() || (OCR_SPACE_ENGINE === '1' ? 'eng' : 'auto');
const SHORT_OCR_NAME_MAX_LENGTH = 4;
const SHORT_OCR_FUSE_THRESHOLD = 0.18;
const OCR_REVIEW_MATCH_THRESHOLD = 0.72;
const OCR_AUTO_APPLY_MATCH_THRESHOLD = 0.9;
const OCR_SUGGESTION_THRESHOLD = 0.62;
const OCR_MAX_IMAGE_DIMENSION = 2600;
const OCR_RALLY_ROW_START_RATIO = 0.47;
const OCR_RALLY_FOCUS_SIDE_INSET_RATIO = 0.012;
const OCR_RALLY_FOCUS_BOTTOM_INSET_RATIO = 0.015;
const OCR_LAYOUT_HEADER_SCAN_RATIO = 0.28;
const OCR_LAYOUT_HEADER_ACTIVE_DENSITY = 0.02;
const OCR_LAYOUT_HEADER_MIN_HEIGHT_RATIO = 0.04;
const OCR_LAYOUT_NUMBER_LANE_WIDTH_RATIO = 0.12;
const OCR_LAYOUT_NUMBER_LANE_ACTIVE_DENSITY = 0.09;
const OCR_LAYOUT_NUMBER_LANE_MIN_HEIGHT_RATIO = 0.025;
const OCR_LAYOUT_GRID_SCAN_START_RATIO = 0.08;
const OCR_LAYOUT_GRID_DARK_THRESHOLD = 62;
const OCR_LAYOUT_GRID_EDGE_THRESHOLD = 20;
const OCR_LAYOUT_GRID_ROW_SCORE_THRESHOLD = 0.24;
const OCR_LAYOUT_GRID_MIN_BAND_RATIO = 0.035;
const OCR_LAYOUT_PANEL_DARK_THRESHOLD = 58;
const OCR_LAYOUT_PANEL_MIN_DARK_DENSITY = 0.55;
const OCR_LAYOUT_PANEL_MIN_HEIGHT_RATIO = 0.08;
const OCR_LAYOUT_PANEL_TOP_DARK_DENSITY = 0.42;
const OCR_LAYOUT_PANEL_TOP_SCAN_PADDING_RATIO = 0.18;
const OCR_LAYOUT_NAMES_ONLY_TOP_TRIM_RATIO = 0.015;
const OCR_LAYOUT_SAFE_TOP_RATIO = 0.35;
const OCR_LAYOUT_ROW_ANCHOR_PADDING_RATIO = 0.01;
const OCR_NAME_BAND_HEIGHT_RATIO = 0.68;
const OCR_FAST_PASS_MAX_IMAGE_DIMENSION = 1800;
const OCR_FALLBACK_PASS_MAX_IMAGE_DIMENSION = OCR_MAX_IMAGE_DIMENSION;
const OCR_MAX_REQUEST_VARIANTS = 6;
const OCR_CHAR_VARIANTS: Record<string, string[]> = {
  '0': ['o'],
  '1': ['i', 'l'],
  '2': ['z'],
  '5': ['s'],
  '6': ['g'],
  '8': ['b'],
  i: ['i', 'l'],
  l: ['l', 'i'],
};
const OCR_COMBINING_MARKS = /[\u0300-\u036f]/g;
const OCR_NON_ALPHANUMERIC = /[^\p{L}\p{N}]/gu;
const OCR_NAME_TOKEN_SPLITTER = /[^\p{L}\p{N}]+/u;
const OCR_WHITESPACE = /\s+/g;
const OCR_UI_NOISE_PATTERNS = [
  /manage\s*rally/i,
  /gathering\s*point/i,
  /not\s*registered/i,
  /^\?+$/,
  /human\s*hunter/i,
  /blacksmith/i,
  /lucky\s*guy/i,
  /combat\s*medalist/i,
  /secreta/i,
];

const getDefaultOcrProxyEndpoint = () => {
  const configuredEndpoint = import.meta.env.VITE_OCR_PROXY_ENDPOINT?.trim();
  if (configuredEndpoint) {
    return configuredEndpoint;
  }

  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim();
  const isBrowser = typeof window !== 'undefined';
  const hostname = isBrowser ? window.location.hostname : '';
  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';

  if (projectId && isLocalHost) {
    return `https://asia-southeast1-${projectId}.cloudfunctions.net/ocrSpaceProxy`;
  }

  return DEFAULT_OCR_PROXY_PATH;
};

const OCR_PROXY_ENDPOINT = getDefaultOcrProxyEndpoint();
const isAttendanceEligibleByCombatPower = (combatPower: number) => Number(combatPower || 0) >= MINIMUM_ATTENDANCE_COMBAT_POWER;
const getCreateAttendanceMultiplier = (combatPower: number) => {
  const normalizedCombatPower = Number(combatPower || 0);

  return isAttendanceEligibleByCombatPower(normalizedCombatPower)
    ? getCombatPowerMultiplier(normalizedCombatPower)
    : 0;
};

interface OcrSpaceParsedResult {
  ParsedText?: string;
  TextOverlay?: {
    Lines?: Array<{
      MinTop?: number;
      Words?: Array<{
        WordText?: string;
        Left?: number;
        Top?: number;
        Height?: number;
        Width?: number;
      }>;
    }>;
    HasOverlay?: boolean;
  } | null;
  FileParseExitCode?: string | number;
  ErrorMessage?: string[] | string | null;
  ErrorDetails?: string | null;
}

interface OcrSpaceResponse {
  IsErroredOnProcessing?: boolean;
  ErrorMessage?: string[] | string;
  ErrorDetails?: string;
  ParsedResults?: OcrSpaceParsedResult[];
  error?: string;
}

interface OcrRequestOptions {
  language: string;
  ocrEngine: '1' | '2' | '3';
  isOverlayRequired: boolean;
  scale: boolean;
  detectOrientation: boolean;
  isTable: boolean;
}

interface OcrPreparedImageVariant {
  cropKind: OcrCropKind;
  kind: 'source' | 'enhanced' | 'threshold';
  label: string;
  imageDataUrl: string;
  minimumLineTop?: number;
  wave: number;
}

interface OcrVariantPlanStep {
  kind: OcrPreparedImageVariant['kind'];
  labelSuffix: string;
  maxDimension: number;
  wave: number;
  textBand?: boolean;
  contrast?: number;
  threshold?: number;
}

interface OcrNameCandidate {
  text: string;
  source: OcrSourceKind;
  top: number;
}

interface OcrImageBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

type OcrCropKind = 'content' | 'header-anchor' | 'number-lane' | 'names-only' | 'panel-body' | 'rally-fallback';

interface OcrCropCandidate {
  kind: OcrCropKind;
  label: string;
  bounds: OcrImageBounds;
  minimumLineTop?: number;
}

interface OcrCandidateExtractionOptions {
  minimumLineTop?: number;
}

interface OcrRowBuildResult {
  rows: OcrAttendanceRow[];
  autoMatchedMemberIds: string[];
  score: number;
}

const DEFAULT_OCR_REQUEST_OPTIONS: OcrRequestOptions = {
  language: OCR_SPACE_LANGUAGE,
  ocrEngine: OCR_SPACE_ENGINE,
  isOverlayRequired: OCR_SPACE_ENGINE !== '3',
  scale: true,
  detectOrientation: true,
  isTable: true,
};

const getOcrErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return 'Failed to process the image. Please try another upload or paste a clearer screenshot.';
};

const canUseDirectOcrSpaceFallback = () => {
  if (!OCR_SPACE_API_KEY) {
    return false;
  }

  if (typeof window === 'undefined') {
    return false;
  }

  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
};

const parseOcrResponse = async (response: Response) => {
  const responseText = await response.text();

  if (!responseText.trim()) {
    return {
      payload: null,
      rawText: responseText,
    };
  }

  try {
    return {
      payload: JSON.parse(responseText) as OcrSpaceResponse,
      rawText: responseText,
    };
  } catch {
    return {
      payload: null,
      rawText: responseText,
    };
  }
};

const normalizeOcrDisplayText = (value: string) => value
  .normalize('NFKC')
  .replace(OCR_WHITESPACE, ' ')
  .trim();

const stripOcrDiacritics = (value: string) => value
  .normalize('NFKD')
  .replace(OCR_COMBINING_MARKS, '');

const replaceCommonOcrVariants = (value: string) => value
  .replace(/[0]/g, 'o')
  .replace(/[2]/g, 'z')
  .replace(/[5]/g, 's')
  .replace(/[6]/g, 'g')
  .replace(/[8]/g, 'b')
  .replace(/[1]/g, 'i');

const normalizeOcrName = (value: string) => value
  ? replaceCommonOcrVariants(stripOcrDiacritics(normalizeOcrDisplayText(value).toLowerCase()))
    .replace(OCR_NON_ALPHANUMERIC, '')
  : '';

const normalizeOcrAlphaNumericName = (value: string) => value
  ? stripOcrDiacritics(normalizeOcrDisplayText(value).toLowerCase())
    .replace(OCR_NON_ALPHANUMERIC, '')
  : '';

const getNormalizedOcrVariants = (value: string) => {
  const sanitized = normalizeOcrAlphaNumericName(value);
  const normalized = normalizeOcrName(sanitized);

  if (!normalized) return [] as string[];
  if (normalized.length > SHORT_OCR_NAME_MAX_LENGTH) return [normalized];

  let variants = [''];

  for (const character of sanitized) {
    const options = OCR_CHAR_VARIANTS[character] ?? [character];
    const nextVariants = [] as string[];

    variants.forEach((prefix) => {
      options.forEach((option) => {
        nextVariants.push(prefix + option);
      });
    });

    variants = nextVariants.slice(0, 32);
  }

  return Array.from(new Set(variants.map((variant) => normalizeOcrName(variant)).filter(Boolean)));
};

const getOcrRowKey = (row: Pick<OcrAttendanceRow, 'matchedMemberId' | 'detectedName'>) => {
  if (row.matchedMemberId) {
    return `member:${row.matchedMemberId}`;
  }

  const detectedNameKey = getOcrDetectedNameKey(row.detectedName);
  return detectedNameKey ? `detected:${detectedNameKey}` : '';
};

const getOcrDetectedNameKey = (detectedName: string) =>
  normalizeOcrAlphaNumericName(detectedName) || normalizeOcrName(detectedName);

const tokenizeOcrName = (value: string) =>
  value
    .toLowerCase()
    .split(OCR_NAME_TOKEN_SPLITTER)
    .map((token) => normalizeOcrName(token))
    .filter((token) => token.length >= 2);

const isKnownOcrUiNoise = (value: string) => {
  const normalizedValue = normalizeOcrDisplayText(value);
  if (!normalizedValue) return true;

  return OCR_UI_NOISE_PATTERNS.some((pattern) => pattern.test(normalizedValue));
};

const isLikelyShortAlphaNumericOcrName = (value: string) => {
  const normalizedValue = normalizeOcrDisplayText(value);
  if (!normalizedValue) return false;

  return /^[a-z]{1,3}[0-9]{1,3}$/i.test(normalizedValue) || /^[0-9]{1,3}[a-z]{1,3}$/i.test(normalizedValue);
};

const isLikelyOcrNameCandidate = (value: string) => {
  const normalizedValue = normalizeOcrDisplayText(value);
  const letterCount = (normalizedValue.match(/\p{L}/gu) ?? []).length;
  const digitCount = (normalizedValue.match(/\p{N}/gu) ?? []).length;
  const tokenCount = normalizedValue.split(OCR_WHITESPACE).filter(Boolean).length;

  if (!normalizedValue || isKnownOcrUiNoise(normalizedValue)) {
    return false;
  }

  if (isLikelyShortAlphaNumericOcrName(normalizedValue)) {
    return true;
  }

  if (letterCount === 0 || digitCount > letterCount || tokenCount > 5) {
    return false;
  }

  return normalizeOcrName(normalizedValue).length >= 3 || normalizeOcrAlphaNumericName(normalizedValue).length >= 3;
};

const extractParsedTextCandidates = (rawText: string) => rawText
  .split(/\r?\n/)
  .map((line, index) => ({
    text: normalizeOcrDisplayText(line),
    source: 'parsed' as const,
    top: index * 100,
  }))
  .filter((candidate) => isLikelyOcrNameCandidate(candidate.text));

const extractOcrNameCandidates = (ocrResult: OcrSpaceResponse, options: OcrCandidateExtractionOptions = {}) => {
  const seenCandidateKeys = new Set<string>();
  const minimumLineTop = Number.isFinite(options.minimumLineTop) ? Number(options.minimumLineTop) : null;
  const overlayCandidates = (ocrResult.ParsedResults ?? [])
    .flatMap((parsedResult, pageIndex) => (
      parsedResult.TextOverlay?.Lines?.map((line, lineIndex) => ({
        text: normalizeOcrDisplayText(
          (line.Words ?? [])
            .map((word) => normalizeOcrDisplayText(word.WordText || ''))
            .filter(Boolean)
            .join(' ')
        ),
        source: 'overlay' as const,
        top: Number(line.MinTop ?? ((pageIndex + 1) * 10000) + lineIndex),
      })) ?? []
    ))
    .filter((candidate) => (
      (minimumLineTop === null || candidate.top >= minimumLineTop)
      && isLikelyOcrNameCandidate(candidate.text)
    ));

  const parsedCandidates = overlayCandidates.length > 0
    ? []
    : (ocrResult.ParsedResults ?? [])
      .flatMap((parsedResult) => extractParsedTextCandidates(parsedResult.ParsedText || ''));

  return [...overlayCandidates, ...parsedCandidates]
    .filter((candidate) => {
      const candidateKey = getOcrDetectedNameKey(candidate.text);
      if (!candidateKey || seenCandidateKeys.has(candidateKey)) {
        return false;
      }

      seenCandidateKeys.add(candidateKey);
      return true;
    })
    .sort((first, second) => first.top - second.top);
};

const readBlobAsDataUrl = (imageSource: Blob | File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();

  reader.onload = () => {
    if (typeof reader.result === 'string') {
      resolve(reader.result);
      return;
    }

    reject(new Error('Failed to read the image for OCR.'));
  };

  reader.onerror = () => {
    reject(reader.error || new Error('Failed to read the image for OCR.'));
  };

  reader.readAsDataURL(imageSource);
});

const loadImageFromDataUrl = (imageDataUrl: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('Failed to load the image for OCR.'));
  image.src = imageDataUrl;
});

const getCanvas2DContext = (canvas: HTMLCanvasElement) => {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error('Unable to prepare the image for OCR.');
  }

  return context;
};

const clampColorChannel = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

const getAverageCornerBrightness = (imageData: ImageData) => {
  const { data, width, height } = imageData;
  const sampleOffsets = [
    0,
    (width - 1) * 4,
    ((height - 1) * width) * 4,
    (((height - 1) * width) + (width - 1)) * 4,
  ];

  return sampleOffsets.reduce((sum, offset) => (
    sum + ((data[offset] + data[offset + 1] + data[offset + 2]) / 3)
  ), 0) / sampleOffsets.length;
};

const detectImageContentBounds = (imageData: ImageData): OcrImageBounds => {
  const { data, width, height } = imageData;
  const backgroundBrightness = getAverageCornerBrightness(imageData);
  const brightnessThreshold = 18;
  const densityThreshold = 0.015;

  const rowHasContent = (rowIndex: number) => {
    let activePixels = 0;
    for (let columnIndex = 0; columnIndex < width; columnIndex += 1) {
      const offset = (rowIndex * width + columnIndex) * 4;
      const brightness = (data[offset] + data[offset + 1] + data[offset + 2]) / 3;
      if (Math.abs(brightness - backgroundBrightness) >= brightnessThreshold) {
        activePixels += 1;
      }
    }

    return activePixels / width >= densityThreshold;
  };

  const columnHasContent = (columnIndex: number, top: number, bottom: number) => {
    let activePixels = 0;
    const heightSample = Math.max(1, bottom - top + 1);

    for (let rowIndex = top; rowIndex <= bottom; rowIndex += 1) {
      const offset = (rowIndex * width + columnIndex) * 4;
      const brightness = (data[offset] + data[offset + 1] + data[offset + 2]) / 3;
      if (Math.abs(brightness - backgroundBrightness) >= brightnessThreshold) {
        activePixels += 1;
      }
    }

    return activePixels / heightSample >= densityThreshold;
  };

  let top = 0;
  while (top < height - 1 && !rowHasContent(top)) top += 1;

  let bottom = height - 1;
  while (bottom > top && !rowHasContent(bottom)) bottom -= 1;

  let left = 0;
  while (left < width - 1 && !columnHasContent(left, top, bottom)) left += 1;

  let right = width - 1;
  while (right > left && !columnHasContent(right, top, bottom)) right -= 1;

  const paddingX = Math.max(8, Math.round((right - left + 1) * 0.02));
  const paddingY = Math.max(8, Math.round((bottom - top + 1) * 0.02));

  return {
    left: Math.max(0, left - paddingX),
    top: Math.max(0, top - paddingY),
    width: Math.min(width, right - left + 1 + (paddingX * 2)),
    height: Math.min(height, bottom - top + 1 + (paddingY * 2)),
  };
};

const clampBoundsToImage = (bounds: OcrImageBounds, imageWidth: number, imageHeight: number): OcrImageBounds => {
  const left = Math.max(0, Math.min(imageWidth - 1, bounds.left));
  const top = Math.max(0, Math.min(imageHeight - 1, bounds.top));
  const right = Math.max(left + 1, Math.min(imageWidth, bounds.left + bounds.width));
  const bottom = Math.max(top + 1, Math.min(imageHeight, bounds.top + bounds.height));

  return {
    left,
    top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  };
};

const getPixelBrightness = (data: Uint8ClampedArray, imageWidth: number, rowIndex: number, columnIndex: number) => {
  const offset = (rowIndex * imageWidth + columnIndex) * 4;
  return (data[offset] + data[offset + 1] + data[offset + 2]) / 3;
};

const findHeaderBandBottom = (imageData: ImageData, contentBounds: OcrImageBounds) => {
  const { data, width } = imageData;
  const scanHeight = Math.max(12, Math.round(contentBounds.height * OCR_LAYOUT_HEADER_SCAN_RATIO));
  const scanTop = contentBounds.top;
  const scanBottom = Math.min(contentBounds.top + scanHeight, contentBounds.top + contentBounds.height - 1);
  const rowWidth = Math.max(1, contentBounds.width);
  const minimumHeaderHeight = Math.max(10, Math.round(contentBounds.height * OCR_LAYOUT_HEADER_MIN_HEIGHT_RATIO));
  let activeBandStart = -1;

  for (let rowIndex = scanTop; rowIndex <= scanBottom; rowIndex += 1) {
    let activePixels = 0;

    for (let columnIndex = contentBounds.left; columnIndex < contentBounds.left + contentBounds.width; columnIndex += 1) {
      const brightness = getPixelBrightness(data, width, rowIndex, columnIndex);
      if (brightness >= 70 || brightness <= 34) {
        activePixels += 1;
      }
    }

    const density = activePixels / rowWidth;
    const isHeaderLike = density >= OCR_LAYOUT_HEADER_ACTIVE_DENSITY;

    if (isHeaderLike) {
      if (activeBandStart === -1) {
        activeBandStart = rowIndex;
      }
      continue;
    }

    if (activeBandStart !== -1) {
      const bandHeight = rowIndex - activeBandStart;
      if (bandHeight >= minimumHeaderHeight) {
        return rowIndex;
      }
      activeBandStart = -1;
    }
  }

  if (activeBandStart !== -1) {
    const bandHeight = (scanBottom + 1) - activeBandStart;
    if (bandHeight >= minimumHeaderHeight) {
      return scanBottom;
    }
  }

  return null;
};

const findFirstNumberLaneAnchor = (imageData: ImageData, contentBounds: OcrImageBounds) => {
  const { data, width, height } = imageData;
  const laneWidth = Math.max(16, Math.round(contentBounds.width * OCR_LAYOUT_NUMBER_LANE_WIDTH_RATIO));
  const laneLeft = contentBounds.left;
  const laneRight = Math.min(width - 1, laneLeft + laneWidth - 1);
  const lanePixelWidth = Math.max(1, laneRight - laneLeft + 1);
  const searchTop = contentBounds.top;
  const searchBottom = Math.min(height - 1, contentBounds.top + contentBounds.height - 1);
  const minimumBandHeight = Math.max(10, Math.round(contentBounds.height * OCR_LAYOUT_NUMBER_LANE_MIN_HEIGHT_RATIO));
  let activeBandStart = -1;

  for (let rowIndex = searchTop; rowIndex <= searchBottom; rowIndex += 1) {
    let bluePixels = 0;
    let contrastPixels = 0;

    for (let columnIndex = laneLeft; columnIndex <= laneRight; columnIndex += 1) {
      const offset = (rowIndex * width + columnIndex) * 4;
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      const brightness = (red + green + blue) / 3;

      if (blue >= 80 && blue >= green + 16 && blue >= red + 16) {
        bluePixels += 1;
      }

      if (brightness >= 64 || brightness <= 38) {
        contrastPixels += 1;
      }
    }

    const density = ((bluePixels / lanePixelWidth) * 0.7) + ((contrastPixels / lanePixelWidth) * 0.3);
    const isBadgeBand = density >= OCR_LAYOUT_NUMBER_LANE_ACTIVE_DENSITY;

    if (isBadgeBand) {
      if (activeBandStart === -1) {
        activeBandStart = rowIndex;
      }
      continue;
    }

    if (activeBandStart !== -1) {
      const bandHeight = rowIndex - activeBandStart;
      if (bandHeight >= minimumBandHeight) {
        return activeBandStart;
      }
      activeBandStart = -1;
    }
  }

  if (activeBandStart !== -1) {
    const bandHeight = (searchBottom + 1) - activeBandStart;
    if (bandHeight >= minimumBandHeight) {
      return activeBandStart;
    }
  }

  return null;
};

const findFirstGridRowStart = (
  imageData: ImageData,
  contentBounds: OcrImageBounds,
  startTop?: number | null,
) => {
  const { data, width, height } = imageData;
  const scanLeft = Math.max(0, contentBounds.left + Math.round(contentBounds.width * 0.1));
  const scanRight = Math.min(width - 1, contentBounds.left + contentBounds.width - Math.round(contentBounds.width * 0.04));
  const scanWidth = Math.max(1, scanRight - scanLeft + 1);
  const minimumBandHeight = Math.max(12, Math.round(contentBounds.height * OCR_LAYOUT_GRID_MIN_BAND_RATIO));
  const initialTop = startTop ?? (contentBounds.top + Math.round(contentBounds.height * OCR_LAYOUT_GRID_SCAN_START_RATIO));
  const scanTop = Math.max(contentBounds.top, Math.min(height - 1, initialTop));
  const scanBottom = Math.min(height - 1, contentBounds.top + contentBounds.height - 1);
  let activeBandStart = -1;
  let activeBandDarkDensity = 0;

  for (let rowIndex = scanTop; rowIndex <= scanBottom; rowIndex += 1) {
    let darkPixels = 0;
    let edgePixels = 0;
    let previousBrightness: number | null = null;

    for (let columnIndex = scanLeft; columnIndex <= scanRight; columnIndex += 1) {
      const brightness = getPixelBrightness(data, width, rowIndex, columnIndex);

      if (brightness <= OCR_LAYOUT_GRID_DARK_THRESHOLD) {
        darkPixels += 1;
      }

      if (
        previousBrightness !== null
        && Math.abs(brightness - previousBrightness) >= OCR_LAYOUT_GRID_EDGE_THRESHOLD
      ) {
        edgePixels += 1;
      }

      previousBrightness = brightness;
    }

    const darkDensity = darkPixels / scanWidth;
    const edgeDensity = edgePixels / Math.max(1, scanWidth - 1);
    const rowScore = (darkDensity * 0.65) + (edgeDensity * 0.35);
    const isGridBand = rowScore >= OCR_LAYOUT_GRID_ROW_SCORE_THRESHOLD && darkDensity >= 0.2;

    if (isGridBand) {
      if (activeBandStart === -1) {
        activeBandStart = rowIndex;
        activeBandDarkDensity = 0;
      }

      activeBandDarkDensity += darkDensity;
      continue;
    }

    if (activeBandStart !== -1) {
      const bandHeight = rowIndex - activeBandStart;
      const averageDarkDensity = activeBandDarkDensity / Math.max(1, bandHeight);
      if (bandHeight >= minimumBandHeight && averageDarkDensity >= 0.24) {
        return activeBandStart;
      }

      activeBandStart = -1;
      activeBandDarkDensity = 0;
    }
  }

  if (activeBandStart !== -1) {
    const bandHeight = (scanBottom + 1) - activeBandStart;
    const averageDarkDensity = activeBandDarkDensity / Math.max(1, bandHeight);
    if (bandHeight >= minimumBandHeight && averageDarkDensity >= 0.24) {
      return activeBandStart;
    }
  }

  return null;
};

const findManageRallyPanelBodyTop = (
  imageData: ImageData,
  contentBounds: OcrImageBounds,
  headerBottom?: number | null,
) => {
  if (headerBottom === null || headerBottom === undefined) {
    return null;
  }

  const { data, width, height } = imageData;
  const scanLeft = Math.max(0, contentBounds.left + Math.round(contentBounds.width * 0.03));
  const scanRight = Math.min(width - 1, contentBounds.left + contentBounds.width - Math.round(contentBounds.width * 0.03));
  const scanWidth = Math.max(1, scanRight - scanLeft + 1);
  const scanTop = Math.max(contentBounds.top, headerBottom);
  const scanBottom = Math.min(height - 1, contentBounds.top + contentBounds.height - 1);
  const minimumBandHeight = Math.max(14, Math.round(contentBounds.height * OCR_LAYOUT_PANEL_MIN_HEIGHT_RATIO));
  let activeBandStart = -1;
  let activeBandDarkDensity = 0;

  for (let rowIndex = scanTop; rowIndex <= scanBottom; rowIndex += 1) {
    let darkPixels = 0;

    for (let columnIndex = scanLeft; columnIndex <= scanRight; columnIndex += 1) {
      const brightness = getPixelBrightness(data, width, rowIndex, columnIndex);
      if (brightness <= OCR_LAYOUT_PANEL_DARK_THRESHOLD) {
        darkPixels += 1;
      }
    }

    const darkDensity = darkPixels / scanWidth;

    if (darkDensity >= OCR_LAYOUT_PANEL_MIN_DARK_DENSITY) {
      if (activeBandStart === -1) {
        activeBandStart = rowIndex;
        activeBandDarkDensity = 0;
      }

      activeBandDarkDensity += darkDensity;
      continue;
    }

    if (activeBandStart !== -1) {
      const bandHeight = rowIndex - activeBandStart;
      const averageDarkDensity = activeBandDarkDensity / Math.max(1, bandHeight);
      if (bandHeight >= minimumBandHeight && averageDarkDensity >= OCR_LAYOUT_PANEL_MIN_DARK_DENSITY) {
        return activeBandStart;
      }

      activeBandStart = -1;
      activeBandDarkDensity = 0;
    }
  }

  if (activeBandStart !== -1) {
    const bandHeight = (scanBottom + 1) - activeBandStart;
    const averageDarkDensity = activeBandDarkDensity / Math.max(1, bandHeight);
    if (bandHeight >= minimumBandHeight && averageDarkDensity >= OCR_LAYOUT_PANEL_MIN_DARK_DENSITY) {
      return activeBandStart;
    }
  }

  return null;
};

const findManageRallyPanelBounds = (
  imageData: ImageData,
  contentBounds: OcrImageBounds,
  panelBodyTop?: number | null,
) => {
  if (panelBodyTop === null || panelBodyTop === undefined) {
    return null;
  }

  const { data, width, height } = imageData;
  const scanLeft = Math.max(0, contentBounds.left + Math.round(contentBounds.width * 0.02));
  const scanRight = Math.min(width - 1, contentBounds.left + contentBounds.width - Math.round(contentBounds.width * 0.02));
  const scanWidth = Math.max(1, scanRight - scanLeft + 1);
  const upwardScanPadding = Math.max(24, Math.round(contentBounds.height * OCR_LAYOUT_PANEL_TOP_SCAN_PADDING_RATIO));
  const scanTop = Math.max(contentBounds.top, panelBodyTop - upwardScanPadding);
  let panelTop = panelBodyTop;
  let insidePanel = false;

  for (let rowIndex = panelBodyTop; rowIndex >= scanTop; rowIndex -= 1) {
    let darkPixels = 0;

    for (let columnIndex = scanLeft; columnIndex <= scanRight; columnIndex += 1) {
      const brightness = getPixelBrightness(data, width, rowIndex, columnIndex);
      if (brightness <= OCR_LAYOUT_PANEL_DARK_THRESHOLD) {
        darkPixels += 1;
      }
    }

    const darkDensity = darkPixels / scanWidth;

    if (darkDensity >= OCR_LAYOUT_PANEL_TOP_DARK_DENSITY) {
      insidePanel = true;
      panelTop = rowIndex;
      continue;
    }

    if (insidePanel) {
      break;
    }
  }

  const clampedTop = Math.max(contentBounds.top, panelTop);
  const clampedBounds = clampBoundsToImage({
    left: contentBounds.left,
    top: clampedTop,
    width: contentBounds.width,
    height: (contentBounds.top + contentBounds.height) - clampedTop,
  }, width, height);

  if (clampedBounds.height < Math.max(120, Math.round(contentBounds.height * 0.22))) {
    return null;
  }

  return clampedBounds;
};

const buildOcrCropCandidates = (imageData: ImageData, contentBounds: OcrImageBounds): OcrCropCandidate[] => {
  const { width, height } = imageData;
  const sideInset = Math.round(contentBounds.width * OCR_RALLY_FOCUS_SIDE_INSET_RATIO);
  const bottomInset = Math.round(contentBounds.height * OCR_RALLY_FOCUS_BOTTOM_INSET_RATIO);
  const numberLaneAnchor = findFirstNumberLaneAnchor(imageData, contentBounds);
  const headerBottom = findHeaderBandBottom(imageData, contentBounds);
  const panelBodyTop = findManageRallyPanelBodyTop(imageData, contentBounds, headerBottom);
  const panelBounds = findManageRallyPanelBounds(imageData, contentBounds, panelBodyTop);
  const gridRowStart = findFirstGridRowStart(imageData, contentBounds, numberLaneAnchor ?? panelBodyTop ?? headerBottom);
  const anchorPadding = Math.round(contentBounds.height * OCR_LAYOUT_ROW_ANCHOR_PADDING_RATIO);
  const candidates = new Map<OcrCropKind, OcrCropCandidate>();

  const addCandidate = (kind: OcrCropKind, label: string, nextBounds: OcrImageBounds) => {
    const clamped = clampBoundsToImage(nextBounds, width, height);
    if (clamped.width < Math.max(120, Math.round(contentBounds.width * 0.35))) return;
    if (clamped.height < Math.max(80, Math.round(contentBounds.height * 0.2))) return;
    candidates.set(kind, { kind, label, bounds: clamped });
  };

  const strictPanelTop = panelBodyTop ?? gridRowStart ?? numberLaneAnchor ?? headerBottom ?? undefined;

  if (panelBounds === null) {
    const contentMinimumTop = strictPanelTop;
    candidates.set('content', {
      kind: 'content',
      label: 'content',
      bounds: clampBoundsToImage(contentBounds, width, height),
      minimumLineTop: contentMinimumTop === undefined ? undefined : Math.max(0, contentMinimumTop - contentBounds.top),
    });
  }

  addCandidate('rally-fallback', 'rally-focus', {
    left: contentBounds.left + sideInset,
    top: contentBounds.top + Math.round(contentBounds.height * OCR_LAYOUT_SAFE_TOP_RATIO),
    width: contentBounds.width - (sideInset * 2),
    height: contentBounds.height - Math.round(contentBounds.height * OCR_LAYOUT_SAFE_TOP_RATIO) - bottomInset,
  });

  if (numberLaneAnchor !== null) {
    const anchoredTop = Math.max(contentBounds.top, numberLaneAnchor - anchorPadding);
    addCandidate('number-lane', 'number-lane', {
      left: contentBounds.left + sideInset,
      top: anchoredTop,
      width: contentBounds.width - (sideInset * 2),
      height: (contentBounds.top + contentBounds.height) - anchoredTop - bottomInset,
    });
  }

  if (panelBounds !== null) {
    const anchoredTop = Math.max(panelBounds.top, (gridRowStart ?? panelBodyTop ?? panelBounds.top) - anchorPadding);
    const clampedBounds = clampBoundsToImage({
      left: panelBounds.left + sideInset,
      top: panelBounds.top,
      width: panelBounds.width - (sideInset * 2),
      height: panelBounds.height - bottomInset,
    }, width, height);

    if (
      clampedBounds.width >= Math.max(120, Math.round(contentBounds.width * 0.35))
      && clampedBounds.height >= Math.max(80, Math.round(contentBounds.height * 0.2))
    ) {
      candidates.set('panel-body', {
        kind: 'panel-body',
        label: 'panel-body',
        bounds: clampedBounds,
        minimumLineTop: Math.max(0, anchoredTop - clampedBounds.top),
      });
    }
  }

  if (headerBottom !== null && panelBounds === null) {
    const anchoredTop = Math.max(contentBounds.top, (gridRowStart ?? headerBottom) - anchorPadding);
    addCandidate('header-anchor', 'header-anchor', {
      left: contentBounds.left + sideInset,
      top: anchoredTop,
      width: contentBounds.width - (sideInset * 2),
      height: (contentBounds.top + contentBounds.height) - anchoredTop - bottomInset,
    });
  }

  if (numberLaneAnchor === null) {
    const namesTop = contentBounds.top + Math.round(contentBounds.height * OCR_LAYOUT_NAMES_ONLY_TOP_TRIM_RATIO);
    addCandidate('names-only', 'names-only', {
      left: contentBounds.left,
      top: namesTop,
      width: contentBounds.width,
      height: contentBounds.height - Math.round(contentBounds.height * OCR_LAYOUT_NAMES_ONLY_TOP_TRIM_RATIO),
    });
  }

  return ['panel-body', 'number-lane', 'header-anchor', 'names-only', 'rally-fallback', 'content']
    .map((kind) => candidates.get(kind as OcrCropKind))
    .filter((candidate): candidate is OcrCropCandidate => Boolean(candidate));
};

const getRallyTableFocusBounds = (contentBounds: OcrImageBounds, imageWidth: number, imageHeight: number): OcrImageBounds => {
  const isLandscape = imageWidth >= imageHeight;
  const isWideContent = contentBounds.width >= contentBounds.height;

  if (!isLandscape || !isWideContent) {
    return contentBounds;
  }

  const topInset = Math.round(contentBounds.height * OCR_RALLY_ROW_START_RATIO);
  const sideInset = Math.round(contentBounds.width * OCR_RALLY_FOCUS_SIDE_INSET_RATIO);
  const bottomInset = Math.round(contentBounds.height * OCR_RALLY_FOCUS_BOTTOM_INSET_RATIO);
  const availableHeight = Math.max(1, contentBounds.height - topInset - bottomInset);
  const focusedBounds = {
    left: Math.max(0, contentBounds.left + sideInset),
    top: Math.max(0, contentBounds.top + topInset),
    width: Math.max(1, contentBounds.width - (sideInset * 2)),
    height: availableHeight,
  };

  if (focusedBounds.height < Math.round(contentBounds.height * 0.45)) {
    return contentBounds;
  }

  return focusedBounds;
};

const applyImageContrast = (imageData: ImageData, contrast = 1.35) => {
  const nextImageData = new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);

  for (let index = 0; index < nextImageData.data.length; index += 4) {
    const grayscale = (
      (nextImageData.data[index] * 0.299)
      + (nextImageData.data[index + 1] * 0.587)
      + (nextImageData.data[index + 2] * 0.114)
    );
    const contrasted = clampColorChannel(((grayscale - 128) * contrast) + 128);

    nextImageData.data[index] = contrasted;
    nextImageData.data[index + 1] = contrasted;
    nextImageData.data[index + 2] = contrasted;
  }

  return nextImageData;
};

const applyImageThreshold = (imageData: ImageData, threshold = 148) => {
  const nextImageData = new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);

  for (let index = 0; index < nextImageData.data.length; index += 4) {
    const value = nextImageData.data[index] >= threshold ? 255 : 0;
    nextImageData.data[index] = value;
    nextImageData.data[index + 1] = value;
    nextImageData.data[index + 2] = value;
  }

  return nextImageData;
};

const getOcrVariantPlanForCrop = (cropKind: OcrCropKind): OcrVariantPlanStep[] => {
  switch (cropKind) {
    case 'panel-body':
      return [
        { kind: 'source', labelSuffix: '', maxDimension: OCR_FAST_PASS_MAX_IMAGE_DIMENSION, wave: 1 },
        { kind: 'enhanced', labelSuffix: 'enhanced', maxDimension: OCR_FAST_PASS_MAX_IMAGE_DIMENSION, wave: 1, contrast: 1.35 },
        { kind: 'source', labelSuffix: 'name-band', maxDimension: OCR_FAST_PASS_MAX_IMAGE_DIMENSION, wave: 2, textBand: true },
        { kind: 'enhanced', labelSuffix: 'name-band enhanced', maxDimension: OCR_FAST_PASS_MAX_IMAGE_DIMENSION, wave: 2, textBand: true, contrast: 1.45 },
      ];
    case 'number-lane':
      return [
        { kind: 'source', labelSuffix: '', maxDimension: OCR_FAST_PASS_MAX_IMAGE_DIMENSION, wave: 1 },
        { kind: 'threshold', labelSuffix: 'high-contrast', maxDimension: OCR_FAST_PASS_MAX_IMAGE_DIMENSION, wave: 1, contrast: 1.55, threshold: 148 },
        { kind: 'enhanced', labelSuffix: 'enhanced', maxDimension: OCR_FALLBACK_PASS_MAX_IMAGE_DIMENSION, wave: 2, contrast: 1.35 },
      ];
    case 'names-only':
      return [
        { kind: 'source', labelSuffix: '', maxDimension: OCR_FAST_PASS_MAX_IMAGE_DIMENSION, wave: 1 },
        { kind: 'enhanced', labelSuffix: 'enhanced', maxDimension: OCR_FAST_PASS_MAX_IMAGE_DIMENSION, wave: 1, contrast: 1.35 },
        { kind: 'source', labelSuffix: 'name-band', maxDimension: OCR_FAST_PASS_MAX_IMAGE_DIMENSION, wave: 2, textBand: true },
      ];
    case 'header-anchor':
      return [
        { kind: 'source', labelSuffix: '', maxDimension: OCR_FAST_PASS_MAX_IMAGE_DIMENSION, wave: 1 },
        { kind: 'enhanced', labelSuffix: 'enhanced', maxDimension: OCR_FAST_PASS_MAX_IMAGE_DIMENSION, wave: 2, contrast: 1.35 },
      ];
    case 'content':
      return [
        { kind: 'source', labelSuffix: '', maxDimension: 1600, wave: 2 },
        { kind: 'enhanced', labelSuffix: 'enhanced', maxDimension: OCR_FAST_PASS_MAX_IMAGE_DIMENSION, wave: 3, contrast: 1.35 },
      ];
    case 'rally-fallback':
      return [
        { kind: 'source', labelSuffix: '', maxDimension: OCR_FAST_PASS_MAX_IMAGE_DIMENSION, wave: 2 },
        { kind: 'threshold', labelSuffix: 'high-contrast', maxDimension: OCR_FALLBACK_PASS_MAX_IMAGE_DIMENSION, wave: 3, contrast: 1.55, threshold: 148 },
      ];
    default:
      return [
        { kind: 'source', labelSuffix: '', maxDimension: OCR_FAST_PASS_MAX_IMAGE_DIMENSION, wave: 1 },
      ];
  }
};

const prepareOcrImageVariants = async (imageSource: Blob | File): Promise<OcrPreparedImageVariant[]> => {
  const sourceDataUrl = await readBlobAsDataUrl(imageSource);
  const image = await loadImageFromDataUrl(sourceDataUrl);
  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = image.naturalWidth || image.width;
  sourceCanvas.height = image.naturalHeight || image.height;

  const sourceContext = getCanvas2DContext(sourceCanvas);
  sourceContext.drawImage(image, 0, 0, sourceCanvas.width, sourceCanvas.height);

  const sourceImageData = sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const contentBounds = detectImageContentBounds(sourceImageData);
  const cropCandidates = buildOcrCropCandidates(sourceImageData, contentBounds);
  const prioritizedCropCandidates = cropCandidates.some((candidate) => candidate.kind === 'panel-body')
    ? cropCandidates.filter((candidate) => candidate.kind === 'panel-body' || candidate.kind === 'number-lane').slice(0, 2)
    : cropCandidates.some((candidate) => candidate.kind === 'number-lane')
      ? cropCandidates.slice(0, 2)
      : cropCandidates.slice(0, 3);
  const preparedVariants: OcrPreparedImageVariant[] = [];

  [1, 2, 3].forEach((wave) => {
    prioritizedCropCandidates.forEach((cropCandidate) => {
      if (preparedVariants.length >= OCR_MAX_REQUEST_VARIANTS) {
        return;
      }

      const bounds = cropCandidate.kind === 'rally-fallback'
        ? getRallyTableFocusBounds(contentBounds, sourceCanvas.width, sourceCanvas.height)
        : cropCandidate.bounds;
      const planSteps = getOcrVariantPlanForCrop(cropCandidate.kind).filter((step) => step.wave === wave);

      planSteps.forEach((step) => {
        if (preparedVariants.length >= OCR_MAX_REQUEST_VARIANTS) {
          return;
        }

        if (step.textBand && bounds.height < 120) {
          return;
        }

        const longestSide = Math.max(bounds.width, bounds.height);
        const scaleFactor = Math.min(2, step.maxDimension / Math.max(1, longestSide));
        const targetWidth = Math.max(1, Math.round(bounds.width * scaleFactor));
        const sourceHeight = step.textBand
          ? Math.max(1, Math.round(bounds.height * OCR_NAME_BAND_HEIGHT_RATIO))
          : bounds.height;
        const targetHeight = Math.max(1, Math.round(sourceHeight * scaleFactor));
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const context = getCanvas2DContext(canvas);
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        context.drawImage(
          sourceCanvas,
          bounds.left,
          bounds.top,
          bounds.width,
          sourceHeight,
          0,
          0,
          targetWidth,
          targetHeight,
        );

        if (step.kind === 'enhanced') {
          context.putImageData(
            applyImageContrast(context.getImageData(0, 0, targetWidth, targetHeight), step.contrast ?? 1.35),
            0,
            0,
          );
        }

        if (step.kind === 'threshold') {
          context.putImageData(
            applyImageThreshold(
              applyImageContrast(context.getImageData(0, 0, targetWidth, targetHeight), step.contrast ?? 1.55),
              step.threshold ?? 148,
            ),
            0,
            0,
          );
        }

        preparedVariants.push({
          cropKind: cropCandidate.kind,
          kind: step.kind,
          label: step.labelSuffix ? `${cropCandidate.label} (${step.labelSuffix})` : cropCandidate.label,
          imageDataUrl: canvas.toDataURL('image/png'),
          minimumLineTop: cropCandidate.minimumLineTop,
          wave,
        });
      });
    });
  });

  return preparedVariants;
};

const requestOcrViaDirectApi = async (imageDataUrl: string, options: OcrRequestOptions) => {
  const response = await fetch(OCR_SPACE_ENDPOINT, {
    method: 'POST',
    headers: {
      apikey: OCR_SPACE_API_KEY,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      base64Image: imageDataUrl,
      language: options.language,
      OCREngine: options.ocrEngine,
      isOverlayRequired: String(options.isOverlayRequired),
      scale: String(options.scale),
      detectOrientation: String(options.detectOrientation),
      isTable: String(options.isTable),
    }).toString(),
  });

  const { payload: result, rawText } = await parseOcrResponse(response);

  if (!response.ok) {
    throw new Error(rawText.trim() || `OCR.space request failed with status ${response.status}`);
  }

  if (!result) {
    throw new Error('OCR.space returned an empty response.');
  }

  return result;
};

const AttendancePage: React.FC<AttendancePageProps> = ({ userType, mode = 'view' }) => {
  const canManage = userType === 'admin' && mode === 'manage';
  const { year, month, day } = getPhilippinesNowParts();
  const todayInPhilippines = `${year}-${month}-${day}`;
  const [selectedDate, setSelectedDate] = useState(todayInPhilippines);
  const [attendanceType, setAttendanceType] = useState('Field Boss');
  const [bossName, setBossName] = useState('Metus');
  const [searchQuery, setSearchQuery] = useState('');
  const [manageSearchQuery, setManageSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AttendanceStatus | 'unmarked'>('all');
  const [isCreateAttendanceOpen, setIsCreateAttendanceOpen] = useState(false);
  const [isResetAttendanceConfirmOpen, setIsResetAttendanceConfirmOpen] = useState(false);
  const [resetAdminPassword, setResetAdminPassword] = useState('');
  const [showResetAdminPassword, setShowResetAdminPassword] = useState(false);
  const [resetConfirmError, setResetConfirmError] = useState<string | null>(null);
  const [isConfirmingResetAttendance, setIsConfirmingResetAttendance] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [isSavingAttendanceData, setIsSavingAttendanceData] = useState(false);
  const [isSyncingAttendanceSummary, setIsSyncingAttendanceSummary] = useState(false);
  const [createAttendanceError, setCreateAttendanceError] = useState<string | null>(null);
  const [draftAttendanceByMemberId, setDraftAttendanceByMemberId] = useState<Record<string, AttendanceStatus | 'unmarked'>>({});
  const [createAttendanceTab, setCreateAttendanceTab] = useState<CreateAttendanceTab>('ocr');
  const [ocrRows, setOcrRows] = useState<OcrAttendanceRow[]>([]);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrSourceLabel, setOcrSourceLabel] = useState('');
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [selectedBossNames, setSelectedBossNames] = useState<string[]>([]);
  const [isBossDropdownOpen, setIsBossDropdownOpen] = useState(false);
  const [editingMetric, setEditingMetric] = useState<'totalFund' | null>(null);
  const [editingMetricValue, setEditingMetricValue] = useState('');
  const [isSavingMetric, setIsSavingMetric] = useState(false);
  const [viewingMemberName, setViewingMemberName] = useState<string | null>(null);
  const [memberAttendanceDetails, setMemberAttendanceDetails] = useState<Array<{
    id: string;
    attendanceType: string;
    bossName: string;
    attendanceDate: string;
    status: AttendanceStatus;
    multiplier: number;
  }>>([]);
  const [isLoadingMemberDetails, setIsLoadingMemberDetails] = useState(false);
  const [memberDetailsError, setMemberDetailsError] = useState<string | null>(null);
  const [deletingAttendanceId, setDeletingAttendanceId] = useState<string | null>(null);
  const bossDropdownRef = useRef<HTMLDivElement | null>(null);
  const ocrFileInputRef = useRef<HTMLInputElement | null>(null);

  const { members, loading: membersLoading, error: membersError } = useFirestoreMembers();
  const { bosses, loading: bossesLoading, error: bossesError } = useFirestoreBossInfo();
  const {
    guildInfo,
    loading: guildInfoLoading,
    error: guildInfoError,
    updateGuildInfoFields,
  } = useFirestoreGuildInfo();
  const {
    summaryRows,
    loading: summaryLoading,
    error: summaryError,
    syncPresentMembersToSummary,
    refreshSummaryForMember,
  } = useFirestoreAttendanceSummary();
  const {
    records,
    loading: attendanceLoading,
    error: attendanceError,
    upsertAttendance,
  } = useFirestoreAttendance(selectedDate, attendanceType, bossName);

  const forceDashBossName = attendanceType === 'Guild vs. Guild';
  const activeStatusFilter = canManage ? 'all' : statusFilter;

  const bossNameOptions = useMemo(() => {
    const filteredBosses = attendanceType === 'Guild Boss'
      ? bosses.filter((boss) => boss.bossType === 'Guild Boss')
      : bosses;

    const uniqueBossesByName = new Map<string, (typeof filteredBosses)[number]>();
    filteredBosses.forEach((boss) => {
      if (!boss.name) return;

      const existingBoss = uniqueBossesByName.get(boss.name);
      if (!existingBoss || boss.level > existingBoss.level) {
        uniqueBossesByName.set(boss.name, boss);
      }
    });

    const uniqueBosses = Array.from(uniqueBossesByName.values());

    if (attendanceType === 'Guild Boss') {
      return uniqueBosses
        .sort((first, second) => {
          const levelDiff = second.level - first.level;
          if (levelDiff !== 0) return levelDiff;
          return first.name.localeCompare(second.name);
        })
        .map((boss) => boss.name);
    }

    return uniqueBosses
      .map((boss) => boss.name)
      .sort((first, second) => first.localeCompare(second));
  }, [bosses, attendanceType]);

  useEffect(() => {
    if (forceDashBossName) {
      if (bossName !== '-') {
        setBossName('-');
      }
      return;
    }

    if (bossNameOptions.length === 0) {
      if (bossName !== '') {
        setBossName('');
      }
      return;
    }
    if (!bossName || !bossNameOptions.includes(bossName)) {
      setBossName(bossNameOptions[0]);
    }
  }, [attendanceType, bossName, bossNameOptions, forceDashBossName]);

  useEffect(() => {
    if (!canManage || !isCreateAttendanceOpen) return;

    const nextDraft: Record<string, AttendanceStatus | 'unmarked'> = {};
    members.forEach((member) => {
      if (!member.id) return;
      nextDraft[member.id] = 'unmarked';
    });

    setDraftAttendanceByMemberId(nextDraft);
  }, [canManage, isCreateAttendanceOpen, members]);

  useEffect(() => {
    if (!canManage || !isCreateAttendanceOpen) return;

    if (forceDashBossName) {
      setSelectedBossNames(['-']);
      return;
    }

    if (bossNameOptions.length === 0) {
      setSelectedBossNames([]);
      return;
    }

    setSelectedBossNames((current) => {
      const stillAvailable = current.filter((name) => bossNameOptions.includes(name));
      if (stillAvailable.length > 0) return stillAvailable;

      if (bossName && bossNameOptions.includes(bossName)) {
        return [bossName];
      }

      return [bossNameOptions[0]];
    });
  }, [canManage, isCreateAttendanceOpen, forceDashBossName, bossNameOptions, bossName]);

  useEffect(() => {
    if (!isCreateAttendanceOpen || !isBossDropdownOpen) return;

    const handleOutsideClick = (event: MouseEvent) => {
      if (!bossDropdownRef.current) return;
      if (!bossDropdownRef.current.contains(event.target as Node)) {
        setIsBossDropdownOpen(false);
      }
    };

    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [isCreateAttendanceOpen, isBossDropdownOpen]);

  const recordsByMemberId = useMemo(() => {
    const entries = records.map((record) => [record.memberId, record.status] as const);
    return new Map<string, AttendanceStatus>(entries);
  }, [records]);

  const membersWithAttendance = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return members
      .map((member) => ({
        ...member,
        attendanceStatus: (() => {
          const memberId = member.id || '';
          if (!memberId) return undefined;

          if (canManage && isCreateAttendanceOpen) {
            const draftStatus = draftAttendanceByMemberId[memberId];
            return draftStatus === 'unmarked' ? undefined : draftStatus;
          }

          return recordsByMemberId.get(memberId);
        })(),
      }))
      .filter((member) => {
        const matchesSearch = member.name.toLowerCase().includes(normalizedSearch);
        if (!matchesSearch) return false;

          if (activeStatusFilter === 'all') return true;
          if (activeStatusFilter === 'unmarked') return !member.attendanceStatus;
          return member.attendanceStatus === activeStatusFilter;
      })
      .sort((first, second) => first.rank - second.rank);
        }, [members, recordsByMemberId, searchQuery, activeStatusFilter, canManage, isCreateAttendanceOpen, draftAttendanceByMemberId]);

  const comparableMembers = useMemo(
    () => members
      .filter((member): member is typeof member & { id: string } => Boolean(member.id))
      .filter((member) => isAttendanceEligibleByCombatPower(member.combatPower))
      .map((member) => ({
      ...member,
      normalizedName: normalizeOcrName(member.name),
      normalizedAlphaNumericName: normalizeOcrAlphaNumericName(member.name),
      nameTokens: tokenizeOcrName(member.name),
    })),
    [members]
  );

  const registeredComparableMembers = useMemo(
    () => members
      .filter((member): member is typeof member & { id: string } => Boolean(member.id))
      .map((member) => ({
        ...member,
        normalizedName: normalizeOcrName(member.name),
        normalizedAlphaNumericName: normalizeOcrAlphaNumericName(member.name),
        nameTokens: tokenizeOcrName(member.name),
      })),
    [members]
  );

  const displayLookupMembers = useMemo(
    () => members
      .filter((member) => member.name.trim().length > 0)
      .map((member) => ({
        ...member,
        displayName: normalizeOcrDisplayText(member.name),
        normalizedName: normalizeOcrName(member.name),
        normalizedAlphaNumericName: normalizeOcrAlphaNumericName(member.name),
      })),
    [members]
  );

  const displayLookupMembersByAlphaNumericName = useMemo(() => {
    const nextMap = new Map<string, typeof displayLookupMembers>();

    displayLookupMembers.forEach((member) => {
      if (!member.normalizedAlphaNumericName) {
        return;
      }

      const existingMembers = nextMap.get(member.normalizedAlphaNumericName) ?? [];
      nextMap.set(member.normalizedAlphaNumericName, [...existingMembers, member]);
    });

    return nextMap;
  }, [displayLookupMembers]);

  const displayLookupMembersByNormalizedName = useMemo(() => {
    const nextMap = new Map<string, typeof displayLookupMembers>();

    displayLookupMembers.forEach((member) => {
      if (!member.normalizedName) {
        return;
      }

      const existingMembers = nextMap.get(member.normalizedName) ?? [];
      nextMap.set(member.normalizedName, [...existingMembers, member]);
    });

    return nextMap;
  }, [displayLookupMembers]);

  const comparableMembersByAlphaNumericName = useMemo(() => {
    const nextMap = new Map<string, typeof comparableMembers>();

    comparableMembers.forEach((member) => {
      if (!member.normalizedAlphaNumericName) {
        return;
      }

      const existingMembers = nextMap.get(member.normalizedAlphaNumericName) ?? [];
      nextMap.set(member.normalizedAlphaNumericName, [...existingMembers, member]);
    });

    return nextMap;
  }, [comparableMembers]);

  const registeredComparableMembersByAlphaNumericName = useMemo(() => {
    const nextMap = new Map<string, typeof registeredComparableMembers>();

    registeredComparableMembers.forEach((member) => {
      if (!member.normalizedAlphaNumericName) {
        return;
      }

      const existingMembers = nextMap.get(member.normalizedAlphaNumericName) ?? [];
      nextMap.set(member.normalizedAlphaNumericName, [...existingMembers, member]);
    });

    return nextMap;
  }, [registeredComparableMembers]);

  const comparableMembersByNormalizedName = useMemo(() => {
    const nextMap = new Map<string, typeof comparableMembers>();

    comparableMembers.forEach((member) => {
      if (!member.normalizedName) {
        return;
      }

      const existingMembers = nextMap.get(member.normalizedName) ?? [];
      nextMap.set(member.normalizedName, [...existingMembers, member]);
    });

    return nextMap;
  }, [comparableMembers]);

  const registeredComparableMembersByNormalizedName = useMemo(() => {
    const nextMap = new Map<string, typeof registeredComparableMembers>();

    registeredComparableMembers.forEach((member) => {
      if (!member.normalizedName) {
        return;
      }

      const existingMembers = nextMap.get(member.normalizedName) ?? [];
      nextMap.set(member.normalizedName, [...existingMembers, member]);
    });

    return nextMap;
  }, [registeredComparableMembers]);

  const comparableMembersByToken = useMemo(() => {
    const nextMap = new Map<string, typeof comparableMembers>();

    comparableMembers.forEach((member) => {
      member.nameTokens.forEach((token) => {
        const existingMembers = nextMap.get(token) ?? [];
        nextMap.set(token, [...existingMembers, member]);
      });
    });

    return nextMap;
  }, [comparableMembers]);

  const registeredComparableMembersByToken = useMemo(() => {
    const nextMap = new Map<string, typeof registeredComparableMembers>();

    registeredComparableMembers.forEach((member) => {
      member.nameTokens.forEach((token) => {
        const existingMembers = nextMap.get(token) ?? [];
        nextMap.set(token, [...existingMembers, member]);
      });
    });

    return nextMap;
  }, [registeredComparableMembers]);

  const ocrMemberFuse = useMemo(
    () => new Fuse(comparableMembers, {
      includeScore: true,
      shouldSort: true,
      threshold: 0.34,
      ignoreLocation: true,
      minMatchCharLength: 3,
      keys: [
        { name: 'name', weight: 0.7 },
        { name: 'normalizedName', weight: 0.3 },
      ],
    }),
    [comparableMembers]
  );

  const registeredOcrMemberFuse = useMemo(
    () => new Fuse(registeredComparableMembers, {
      includeScore: true,
      shouldSort: true,
      threshold: 0.34,
      ignoreLocation: true,
      minMatchCharLength: 3,
      keys: [
        { name: 'name', weight: 0.7 },
        { name: 'normalizedName', weight: 0.3 },
      ],
    }),
    [registeredComparableMembers]
  );

  const filteredOcrRows = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    if (!normalizedSearch) return ocrRows;

    return ocrRows.filter((row) => {
      const searchableText = [
        row.displayName,
        row.detectedName,
        row.matchedMemberName ?? '',
        row.suggestedMembers.map((suggestion) => suggestion.memberName).join(' '),
      ].join(' ').toLowerCase();
      return searchableText.includes(normalizedSearch);
    });
  }, [ocrRows, searchQuery]);

  const matchedOcrMemberIds = useMemo(
    () => Array.from(new Set(ocrRows.map((row) => row.matchedMemberId).filter((memberId): memberId is string => Boolean(memberId)))),
    [ocrRows]
  );

  const ocrMatchSummary = useMemo(() => ({
    matchedMembers: matchedOcrMemberIds.length,
    detectedRows: ocrRows.length,
    manualRows: comparableMembers.length,
  }), [matchedOcrMemberIds, comparableMembers.length, ocrRows.length]);

  const handleAttendanceCheckboxChange = (
    memberId: string,
    _memberName: string,
    checked: boolean
  ) => {
    if (createAttendanceError) {
      setCreateAttendanceError(null);
    }

    setDraftAttendanceByMemberId((current) => ({
      ...current,
      [memberId]: checked ? 'present' : 'unmarked',
    }));
  };

  const handleRemoveOcrAttendanceRow = (row: OcrAttendanceRow) => {
    const label = row.displayName || row.detectedName || 'this OCR row';
    const shouldRemove = window.confirm(`Remove ${label} from OCR attendance?`);
    if (!shouldRemove) {
      return;
    }

    if (createAttendanceError) {
      setCreateAttendanceError(null);
    }

    if (row.matchedMemberId) {
      setDraftAttendanceByMemberId((current) => ({
        ...current,
        [row.matchedMemberId as string]: 'unmarked',
      }));
    }

    setOcrRows((current) => current.filter((currentRow) => currentRow.id !== row.id));
  };

  const closeCreateAttendanceModal = () => {
    setIsCreateAttendanceOpen(false);
    setIsBossDropdownOpen(false);
    setCreateAttendanceError(null);
    setCreateAttendanceTab('ocr');
    setOcrRows([]);
    setOcrError(null);
    setOcrSourceLabel('');
    setIsProcessingOcr(false);
    if (ocrFileInputRef.current) {
      ocrFileInputRef.current.value = '';
    }
  };

  const buildSuggestedMember = (
    member: typeof comparableMembers[number],
    confidence: number,
    reason: OcrMatchReason
  ): OcrSuggestedMember => ({
    memberId: member.id,
    memberName: member.name,
    combatPower: Number(member.combatPower || 0),
    multiplier: getCombatPowerMultiplier(Number(member.combatPower || 0)),
    confidence,
    reason,
  });

  const getOcrRowStatus = (reason: OcrMatchReason, confidence: number): OcrRowStatus => {
    if ((reason === 'exact' || reason === 'variant') && confidence >= OCR_AUTO_APPLY_MATCH_THRESHOLD) {
      return 'matched';
    }

    if (confidence >= OCR_REVIEW_MATCH_THRESHOLD) {
      return 'review';
    }

    return 'unmatched';
  };

  const getUniqueDisplayLookupMember = (candidateName: string) => {
    const normalizedCandidateAlphaNumeric = normalizeOcrAlphaNumericName(candidateName);
    const exactAlphaNumericMatches = Array.from(new Map(
      (displayLookupMembersByAlphaNumericName.get(normalizedCandidateAlphaNumeric) ?? [])
        .map((member) => [member.displayName, member] as const)
    ).values());

    if (exactAlphaNumericMatches.length === 1) {
      return exactAlphaNumericMatches[0];
    }

    const exactVariantMatches = Array.from(new Map(
      getNormalizedOcrVariants(candidateName).flatMap((variant) => (
        (displayLookupMembersByNormalizedName.get(variant) ?? [])
          .map((member) => [member.displayName, member] as const)
      ))
    ).values());

    if (exactVariantMatches.length === 1) {
      return exactVariantMatches[0];
    }

    return null;
  };

  const findBestRegisteredOcrMemberLookup = (candidateName: string) => {
    const normalizedCandidate = normalizeOcrName(candidateName);
    const normalizedCandidateAlphaNumeric = normalizeOcrAlphaNumericName(candidateName);
    if (!normalizedCandidate && !normalizedCandidateAlphaNumeric) return null;

    const candidateTokens = tokenizeOcrName(candidateName);
    const candidateVariants = getNormalizedOcrVariants(candidateName);
    const isShortCandidate = Math.max(normalizedCandidate.length, normalizedCandidateAlphaNumeric.length) <= SHORT_OCR_NAME_MAX_LENGTH;

    const exactAlphaNumericMatches = Array.from(new Map(
      (registeredComparableMembersByAlphaNumericName.get(normalizedCandidateAlphaNumeric) ?? [])
        .map((member) => [member.id, member] as const)
    ).values());

    if (exactAlphaNumericMatches.length === 1) {
      return exactAlphaNumericMatches[0];
    }

    const exactVariantMatches = Array.from(new Map(
      candidateVariants.flatMap((variant) => (
        (registeredComparableMembersByNormalizedName.get(variant) ?? [])
          .map((member) => [member.id, member] as const)
      ))
    ).values());

    if (exactVariantMatches.length === 1) {
      return exactVariantMatches[0];
    }

    const exactTokenMatches = Array.from(new Map(
      candidateVariants.flatMap((variant) => (
        (registeredComparableMembersByToken.get(variant) ?? [])
          .map((member) => [member.id, member] as const)
      ))
    ).values());

    if (exactTokenMatches.length === 1) {
      return exactTokenMatches[0];
    }

    const fuseThreshold = isShortCandidate ? SHORT_OCR_FUSE_THRESHOLD : 0.34;
    const fuseResults = registeredOcrMemberFuse.search(candidateName, { limit: isShortCandidate ? 3 : 2 });
    const bestFuseResult = fuseResults[0];
    const secondFuseResult = fuseResults[1];

    if (
      bestFuseResult
      && (bestFuseResult.score ?? 1) <= fuseThreshold
      && (!isShortCandidate || !secondFuseResult || (secondFuseResult.score ?? 1) - (bestFuseResult.score ?? 1) >= 0.04)
    ) {
      return bestFuseResult.item;
    }

    let bestTokenMatch = null as (typeof registeredComparableMembers)[number] | null;
    let bestTokenScore = 0;

    registeredComparableMembers.forEach((member) => {
      if (!member.normalizedName) return;

      let score = 0;
      if (normalizedCandidate === member.normalizedName) {
        score = 1;
      } else if (
        normalizedCandidate.includes(member.normalizedName)
        || member.normalizedName.includes(normalizedCandidate)
      ) {
        score = 0.92;
      } else {
        const sharedTokens = candidateTokens.filter((token) => member.nameTokens.includes(token)).length;
        if (sharedTokens > 0) {
          score = sharedTokens / Math.max(candidateTokens.length, member.nameTokens.length);
        }
      }

      if (score > bestTokenScore) {
        bestTokenScore = score;
        bestTokenMatch = member;
      }
    });

    if (bestTokenScore < (isShortCandidate ? 0.9 : 0.65) || !bestTokenMatch) {
      return null;
    }

    return bestTokenMatch;
  };

  const getOcrRowNotice = (
    candidateName: string,
    matchedMember: ReturnType<typeof findBestOcrMemberMatch>
  ): OcrRowNotice => {
    if (matchedMember) {
      return null;
    }

    const registeredLookupMember = findBestRegisteredOcrMemberLookup(candidateName) ?? getUniqueDisplayLookupMember(candidateName);
    if (!registeredLookupMember) {
      return 'not_registered';
    }

    if (!isAttendanceEligibleByCombatPower(Number(registeredLookupMember.combatPower || 0))) {
      return 'below_minimum_combat_power';
    }

    return null;
  };

  const getOcrRowNoticeMessage = (notice: OcrRowNotice) => {
    if (notice === 'not_registered') {
      return 'Not registered in members list.';
    }

    if (notice === 'below_minimum_combat_power') {
      return `Registered member is below ${MINIMUM_ATTENDANCE_COMBAT_POWER.toLocaleString()} combat power.`;
    }

    return null;
  };

  const resolveCounterCheckedDisplayName = (candidateName: string, matchedMemberName?: string | null) => {
    if (matchedMemberName) {
      return matchedMemberName;
    }

    const normalizedCandidate = normalizeOcrDisplayText(candidateName);
    const displayLookupMember = findBestRegisteredOcrMemberLookup(candidateName) ?? getUniqueDisplayLookupMember(candidateName);

    if (displayLookupMember) {
      return normalizeOcrDisplayText(displayLookupMember.name);
    }

    return normalizedCandidate;
  };

  const findBestOcrMemberMatch = (candidateName: string, reservedMemberIds: Set<string>) => {
    const normalizedCandidate = normalizeOcrName(candidateName);
    const normalizedCandidateAlphaNumeric = normalizeOcrAlphaNumericName(candidateName);
    if (!normalizedCandidate && !normalizedCandidateAlphaNumeric) return null;

    const candidateTokens = tokenizeOcrName(candidateName);
    const candidateVariants = getNormalizedOcrVariants(candidateName);
    const isShortCandidate = Math.max(normalizedCandidate.length, normalizedCandidateAlphaNumeric.length) <= SHORT_OCR_NAME_MAX_LENGTH;

    const exactAlphaNumericMatches = Array.from(new Map(
      (comparableMembersByAlphaNumericName.get(normalizedCandidateAlphaNumeric) ?? [])
        .filter((member) => !reservedMemberIds.has(member.id))
        .map((member) => [member.id, member] as const)
    ).values());

    if (exactAlphaNumericMatches.length === 1) {
      return {
        member: exactAlphaNumericMatches[0],
        confidence: 1,
        reason: 'exact' as const,
      };
    }

    const exactVariantMatches = Array.from(new Map(
      candidateVariants.flatMap((variant) => (
        (comparableMembersByNormalizedName.get(variant) ?? [])
          .filter((member) => !reservedMemberIds.has(member.id))
          .map((member) => [member.id, member] as const)
      ))
    ).values());

    if (exactVariantMatches.length === 1) {
      return {
        member: exactVariantMatches[0],
        confidence: 0.97,
        reason: 'variant' as const,
      };
    }

    const exactTokenMatches = Array.from(new Map(
      candidateVariants.flatMap((variant) => (
        (comparableMembersByToken.get(variant) ?? [])
          .filter((member) => !reservedMemberIds.has(member.id))
          .map((member) => [member.id, member] as const)
      ))
    ).values());

    if (exactTokenMatches.length === 1) {
      return {
        member: exactTokenMatches[0],
        confidence: 0.88,
        reason: 'token' as const,
      };
    }

    const fuseThreshold = isShortCandidate ? SHORT_OCR_FUSE_THRESHOLD : 0.34;
    const fuseResults = ocrMemberFuse.search(candidateName, { limit: isShortCandidate ? 3 : 1 });
    const bestFuseResult = fuseResults[0];
    const secondFuseResult = fuseResults[1];

    if (
      bestFuseResult
      && (bestFuseResult.score ?? 1) <= fuseThreshold
      && (!isShortCandidate || !secondFuseResult || (secondFuseResult.score ?? 1) - (bestFuseResult.score ?? 1) >= 0.04)
    ) {
      if (reservedMemberIds.has(bestFuseResult.item.id)) {
        return null;
      }

      return {
        member: bestFuseResult.item,
        confidence: Math.max(0, 1 - (bestFuseResult.score ?? 1)),
        reason: 'fuzzy' as const,
      };
    }

    let bestTokenMatch = null as (typeof comparableMembers)[number] | null;
    let bestTokenScore = 0;

    comparableMembers.forEach((member) => {
      if (!member.normalizedName) return;

      let score = 0;
      if (normalizedCandidate === member.normalizedName) {
        score = 1;
      } else if (
        normalizedCandidate.includes(member.normalizedName)
        || member.normalizedName.includes(normalizedCandidate)
      ) {
        score = 0.92;
      } else {
        const sharedTokens = candidateTokens.filter((token) => member.nameTokens.includes(token)).length;
        if (sharedTokens > 0) {
          score = sharedTokens / Math.max(candidateTokens.length, member.nameTokens.length);
        }
      }

      if (score > bestTokenScore) {
        bestTokenScore = score;
        bestTokenMatch = member;
      }
    });

    if (bestTokenScore < (isShortCandidate ? 0.9 : 0.65) || !bestTokenMatch) {
      return null;
    }

    if (reservedMemberIds.has(bestTokenMatch.id)) {
      return null;
    }

    return {
      member: bestTokenMatch,
      confidence: bestTokenScore,
      reason: 'token' as const,
    };
  };

  const getSuggestedOcrMembers = (
    candidateName: string,
    reservedMemberIds: Set<string>,
    selectedMemberId?: string | null
  ) => {
    const normalizedCandidate = normalizeOcrName(candidateName);
    const normalizedCandidateAlphaNumeric = normalizeOcrAlphaNumericName(candidateName);
    if (!normalizedCandidate && !normalizedCandidateAlphaNumeric) return [] as OcrSuggestedMember[];

    const candidateVariants = getNormalizedOcrVariants(candidateName);
    const suggestions = new Map<string, OcrSuggestedMember>();

    (comparableMembersByAlphaNumericName.get(normalizedCandidateAlphaNumeric) ?? []).forEach((member) => {
      if (reservedMemberIds.has(member.id) || member.id === selectedMemberId || suggestions.has(member.id)) return;
      suggestions.set(member.id, buildSuggestedMember(member, 0.94, 'exact'));
    });

    candidateVariants.forEach((variant) => {
      (comparableMembersByNormalizedName.get(variant) ?? []).forEach((member) => {
        if (reservedMemberIds.has(member.id) || member.id === selectedMemberId || suggestions.has(member.id)) return;
        suggestions.set(member.id, buildSuggestedMember(member, 0.9, 'variant'));
      });

      (comparableMembersByToken.get(variant) ?? []).forEach((member) => {
        if (reservedMemberIds.has(member.id) || member.id === selectedMemberId || suggestions.has(member.id)) return;
        suggestions.set(member.id, buildSuggestedMember(member, 0.8, 'token'));
      });
    });

    if (suggestions.size < 3) {
      ocrMemberFuse.search(candidateName, { limit: 5 }).forEach((result) => {
        const confidence = Math.max(0, 1 - (result.score ?? 1));
        if (confidence < OCR_SUGGESTION_THRESHOLD) return;
        if (reservedMemberIds.has(result.item.id) || result.item.id === selectedMemberId || suggestions.has(result.item.id)) return;
        suggestions.set(result.item.id, buildSuggestedMember(result.item, confidence, 'fuzzy'));
      });
    }

    return [...suggestions.values()]
      .sort((first, second) => second.confidence - first.confidence)
      .slice(0, 3);
  };

  const buildOcrRowsFromCandidates = (candidates: OcrNameCandidate[]): OcrRowBuildResult => {
    const seenRowKeys = new Set<string>();
    const seenDetectedNameKeys = new Set<string>();
    const reservedMemberIds = new Set(
      ocrRows
        .filter((row) => row.autoApplied)
        .map((row) => row.matchedMemberId)
        .filter((memberId): memberId is string => Boolean(memberId))
    );
    const existingDetectedNameKeys = new Set(
      ocrRows
        .map((row) => getOcrDetectedNameKey(row.detectedName))
        .filter(Boolean)
    );
    const nextRows: OcrAttendanceRow[] = [];
    const autoMatchedMemberIds = [] as string[];

    candidates.forEach((candidate, index) => {
      const candidateName = candidate.text;
      const detectedNameKey = getOcrDetectedNameKey(candidateName);
      if (!detectedNameKey || seenDetectedNameKeys.has(detectedNameKey) || existingDetectedNameKeys.has(detectedNameKey)) {
        return;
      }

      const matchedMember = findBestOcrMemberMatch(candidateName, reservedMemberIds);
      const registeredLookupMember = matchedMember?.member
        ?? findBestRegisteredOcrMemberLookup(candidateName)
        ?? getUniqueDisplayLookupMember(candidateName);
      const registeredLookupMemberId = registeredLookupMember?.id ?? null;
      const rowNotice = getOcrRowNotice(candidateName, matchedMember);
      const belowMinimumRegisteredMatch = !matchedMember
        && rowNotice === 'below_minimum_combat_power'
        && registeredLookupMember
        && registeredLookupMemberId !== null
        && !reservedMemberIds.has(registeredLookupMemberId);
      const resolvedMatchedMember = matchedMember?.member ?? (belowMinimumRegisteredMatch ? registeredLookupMember : null);
      const rowStatus = matchedMember
        ? getOcrRowStatus(matchedMember.reason, matchedMember.confidence)
        : belowMinimumRegisteredMatch
          ? 'matched'
          : 'unmatched';
      const autoApplied = rowStatus === 'matched';
      const resolvedMatchConfidence = matchedMember?.confidence ?? (belowMinimumRegisteredMatch ? 1 : 0);
      const resolvedMatchReason = matchedMember?.reason ?? (belowMinimumRegisteredMatch ? 'exact' : 'none');
      const rowKey = getOcrRowKey({
        matchedMemberId: autoApplied ? resolvedMatchedMember?.id ?? null : null,
        detectedName: candidateName,
      });

      if (!rowKey || seenRowKeys.has(rowKey)) {
        return;
      }

      seenRowKeys.add(rowKey);
      seenDetectedNameKeys.add(detectedNameKey);
      if (resolvedMatchedMember?.id && autoApplied) {
        reservedMemberIds.add(resolvedMatchedMember.id);
        autoMatchedMemberIds.push(resolvedMatchedMember.id);
      }

      const resolvedCombatPower = registeredLookupMember ? Number(registeredLookupMember.combatPower || 0) : null;
      const resolvedMultiplier = resolvedCombatPower === null
        ? null
        : getCreateAttendanceMultiplier(resolvedCombatPower);

      nextRows.push({
        id: `${index}-${normalizeOcrName(candidateName)}`,
        detectedName: candidateName,
        displayName: resolveCounterCheckedDisplayName(candidateName, resolvedMatchedMember?.name ?? null),
        matchedMemberId: resolvedMatchedMember?.id ?? null,
        matchedMemberName: resolvedMatchedMember?.name ?? null,
        suggestedMembers: getSuggestedOcrMembers(candidateName, reservedMemberIds, resolvedMatchedMember?.id ?? null),
        combatPower: resolvedCombatPower,
        multiplier: resolvedMultiplier,
        status: rowStatus,
        matchConfidence: resolvedMatchConfidence,
        matchReason: resolvedMatchReason,
        notice: rowNotice,
        autoApplied,
        source: candidate.source,
      });
    });

    const score = nextRows.reduce((total, row) => {
      const statusWeight = row.status === 'matched' ? 140 : row.status === 'review' ? 70 : 15;
      return total + statusWeight + Math.round(row.matchConfidence * 20);
    }, 0);

    return {
      rows: nextRows,
      autoMatchedMemberIds,
      score,
    };
  };

  const applyBuiltOcrRows = (rowBuildResult: OcrRowBuildResult, sourceLabel: string) => {
    const { rows: nextRows, autoMatchedMemberIds } = rowBuildResult;

    setCreateAttendanceTab('ocr');

    if (nextRows.length === 0) {
      setOcrError('No names were detected from the provided image.');
      return;
    }

    const existingRowKeys = new Set(ocrRows.map((row) => getOcrRowKey(row)).filter(Boolean));
    const mergedRows = [...ocrRows];

    nextRows.forEach((row) => {
      const rowKey = getOcrRowKey(row);
      if (!rowKey || existingRowKeys.has(rowKey)) {
        return;
      }

      existingRowKeys.add(rowKey);
      mergedRows.push(row);
    });

    setOcrSourceLabel((current) => {
      if (!current || current === sourceLabel) {
        return sourceLabel;
      }

      return 'Multiple images';
    });
    setOcrRows(mergedRows);

    setDraftAttendanceByMemberId((current) => {
      const nextDraft = { ...current };
      autoMatchedMemberIds.forEach((memberId) => {
        nextDraft[memberId] = 'present';
      });
      return nextDraft;
    });

    setOcrError(
      autoMatchedMemberIds.length > 0
        ? null
        : 'OCR completed, but no high-confidence matches were auto-applied. Review the suggested names before saving.'
    );
  };

  const handleApplySuggestedOcrMember = (rowId: string, suggestion: OcrSuggestedMember) => {
    setOcrRows((current) => current.map((row) => {
      if (row.id !== rowId) {
        return row;
      }

      return {
        ...row,
        displayName: suggestion.memberName,
        matchedMemberId: suggestion.memberId,
        matchedMemberName: suggestion.memberName,
        combatPower: suggestion.combatPower,
        multiplier: suggestion.multiplier,
        status: 'matched',
        matchConfidence: Math.max(row.matchConfidence, suggestion.confidence),
        matchReason: 'manual',
        autoApplied: true,
        suggestedMembers: row.suggestedMembers.filter((candidate) => candidate.memberId !== suggestion.memberId),
      };
    }));

    setDraftAttendanceByMemberId((current) => ({
      ...current,
      [suggestion.memberId]: 'present',
    }));

    setOcrError(null);
  };

  const isGoodEnoughOcrResult = (result: OcrRowBuildResult) => {
    const matchedCount = result.rows.filter((row) => row.status === 'matched').length;
    const reviewCount = result.rows.filter((row) => row.status === 'review').length;
    const actionableCount = matchedCount + reviewCount;
    const totalRows = result.rows.length;

    if (matchedCount >= 2) return true;
    if (actionableCount >= 3) return true;
    if (totalRows >= 4 && actionableCount / totalRows >= 0.6) return true;

    return false;
  };

  const scoreOcrResult = (result: OcrRowBuildResult) => {
    const matchedCount = result.rows.filter((row) => row.status === 'matched').length;
    const reviewCount = result.rows.filter((row) => row.status === 'review').length;
    const unmatchedCount = result.rows.filter((row) => row.status === 'unmatched').length;
    const confidenceSum = result.rows.reduce((sum, row) => sum + row.matchConfidence, 0);

    return (
      matchedCount * 100
      + reviewCount * 40
      + confidenceSum * 10
      - unmatchedCount * 5
    );
  };

  const scoreOcrResultForVariant = (result: OcrRowBuildResult, variant: OcrPreparedImageVariant) => {
    const matchedCount = result.rows.filter((row) => row.status === 'matched').length;
    const reviewCount = result.rows.filter((row) => row.status === 'review').length;
    const unmatchedCount = result.rows.filter((row) => row.status === 'unmatched').length;
    let score = scoreOcrResult(result);

    if (variant.cropKind === 'panel-body') {
      score += 20;
    }

    if (variant.cropKind === 'content' || variant.cropKind === 'header-anchor') {
      score -= unmatchedCount * 12;

      if (matchedCount === 0 && reviewCount < 2) {
        score -= 35;
      }
    }

    if (variant.cropKind === 'rally-fallback') {
      score -= 12;
    }

    if (variant.cropKind === 'number-lane') {
      score += 8;
    }

    return score;
  };

  const requestOcrVariant = async (idToken: string, imageDataUrl: string): Promise<OcrSpaceResponse> => {
    try {
      const response = await fetch(OCR_PROXY_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageDataUrl,
          ...DEFAULT_OCR_REQUEST_OPTIONS,
        }),
      });

      const parsedResponse = await parseOcrResponse(response);

      if (!response.ok) {
        const fallbackMessage = parsedResponse.rawText.trim()
          ? parsedResponse.rawText.trim().slice(0, 200)
          : `OCR proxy request failed with status ${response.status}`;
        throw new Error(parsedResponse.payload?.error || fallbackMessage);
      }

      if (!parsedResponse.payload) {
        throw new Error(
          OCR_PROXY_ENDPOINT === DEFAULT_OCR_PROXY_PATH
            ? 'OCR proxy is unavailable on this server. Set VITE_OCR_PROXY_ENDPOINT or run the app through Firebase Hosting.'
            : 'OCR proxy returned an empty response.'
        );
      }

      return parsedResponse.payload;
    } catch (proxyError) {
      if (!canUseDirectOcrSpaceFallback()) {
        throw proxyError;
      }

      return requestOcrViaDirectApi(imageDataUrl, DEFAULT_OCR_REQUEST_OPTIONS);
    }
  };

  const processOcrImage = async (imageSource: Blob | File, sourceLabel: string) => {
    setIsProcessingOcr(true);
    setOcrError(null);
    setCreateAttendanceError(null);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setOcrError('You must be signed in as an admin to use OCR.');
        setOcrRows([]);
        return;
      }

      const idToken = await currentUser.getIdToken();
      const preparedVariants = await prepareOcrImageVariants(imageSource);
      let bestResult: OcrRowBuildResult | null = null;
      let bestVariantLabel = sourceLabel;
      let bestScore = -Infinity;
      let lastRequestError: unknown = null;

      for (const variant of preparedVariants) {
        try {
          const result = await requestOcrVariant(idToken, variant.imageDataUrl);

        if (result.IsErroredOnProcessing) {
          const errorMessage = Array.isArray(result.ErrorMessage)
            ? result.ErrorMessage.join(' ')
            : result.ErrorMessage;
            throw new Error(errorMessage || result.ErrorDetails || 'OCR.space failed to process the image.');
        }

        const builtRows = buildOcrRowsFromCandidates(extractOcrNameCandidates(result, {
          minimumLineTop: variant.minimumLineTop,
        }));
          const score = scoreOcrResultForVariant(builtRows, variant);

          if (score > bestScore) {
            bestScore = score;
          bestResult = builtRows;
            bestVariantLabel = variant.label.startsWith('grayscale-contrast')
              ? sourceLabel
              : `${sourceLabel} (${variant.label})`;
          }

          if (isGoodEnoughOcrResult(builtRows)) {
            applyBuiltOcrRows(builtRows, bestVariantLabel);
            return;
          }
        } catch (variantError) {
          lastRequestError = variantError;
        }
      }

      if (bestResult) {
        applyBuiltOcrRows(bestResult, bestVariantLabel);
        return;
      }

      throw lastRequestError instanceof Error
        ? lastRequestError
        : new Error('OCR did not return any usable results.');
    } catch (ocrProcessingError) {
      console.error('Failed to process OCR image:', ocrProcessingError);
      setOcrError(getOcrErrorMessage(ocrProcessingError));
      setOcrRows([]);
    } finally {
      setIsProcessingOcr(false);
    }
  };

  const handleOcrFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    await processOcrImage(selectedFile, selectedFile.name);
    event.target.value = '';
  };

  const handleOcrPaste = async (event: ClipboardEvent<HTMLDivElement>) => {
    const imageItem = Array.from(event.clipboardData.items).find((item) => item.type.startsWith('image/'));
    if (!imageItem) return;

    const imageFile = imageItem.getAsFile();
    if (!imageFile) return;

    event.preventDefault();
    await processOcrImage(imageFile, 'Pasted image');
  };

  const clearAllAttendance = async () => {
    if (!canManage) return;

    if (createAttendanceError) {
      setCreateAttendanceError(null);
    }

    setIsClearingAll(true);
    setOcrRows([]);
    setOcrError(null);
    setOcrSourceLabel('');
    if (ocrFileInputRef.current) {
      ocrFileInputRef.current.value = '';
    }
    setDraftAttendanceByMemberId((current) => {
      const nextDraft = { ...current };
      members
        .filter((member) => member.id)
        .forEach((member) => {
          nextDraft[member.id as string] = 'unmarked';
        });
      return nextDraft;
    });
    setIsClearingAll(false);
  };

  const selectAllBosses = () => {
    if (forceDashBossName) {
      setSelectedBossNames(['-']);
      return;
    }

    setSelectedBossNames([...bossNameOptions]);
    if (createAttendanceError) {
      setCreateAttendanceError(null);
    }
  };

  const clearSelectedBosses = () => {
    if (forceDashBossName) {
      setSelectedBossNames(['-']);
      return;
    }

    setSelectedBossNames([]);
  };

  const toggleBossSelection = (bossOptionName: string) => {
    if (forceDashBossName) {
      setSelectedBossNames(['-']);
      return;
    }

    setSelectedBossNames((current) => {
      if (current.includes(bossOptionName)) {
        return current.filter((name) => name !== bossOptionName);
      }

      return [...current, bossOptionName];
    });

    if (createAttendanceError) {
      setCreateAttendanceError(null);
    }
  };

  const resetAttendanceToolbarState = () => {
    if (!canManage) return;

    setSelectedDate(todayInPhilippines);
    setAttendanceType('Field Boss');
    setBossName('');
    setSearchQuery('');
    setStatusFilter('all');
    setDraftAttendanceByMemberId({});
    setCreateAttendanceTab('ocr');
    setOcrRows([]);
    setOcrError(null);
    setOcrSourceLabel('');
  };

  const closeResetAttendanceConfirm = () => {
    setIsResetAttendanceConfirmOpen(false);
    setResetAdminPassword('');
    setShowResetAdminPassword(false);
    setResetConfirmError(null);
    setIsConfirmingResetAttendance(false);
  };

  const openResetAttendanceConfirm = () => {
    setIsResetAttendanceConfirmOpen(true);
    setResetAdminPassword('');
    setShowResetAdminPassword(false);
    setResetConfirmError(null);
    setIsConfirmingResetAttendance(false);
  };

  const deleteCollectionDocuments = async (collectionName: 'guildAttendance' | 'guildAttendanceSummary') => {
    const snapshot = await getDocs(collection(db, collectionName));
    if (snapshot.empty) return;

    const docs = snapshot.docs;
    const batchSize = 400;

    for (let start = 0; start < docs.length; start += batchSize) {
      const batch = writeBatch(db);
      docs.slice(start, start + batchSize).forEach((snapshotDoc) => {
        batch.delete(snapshotDoc.ref);
      });
      await batch.commit();
    }
  };

  const deleteAllAttendanceRecords = async () => {
    await deleteCollectionDocuments('guildAttendance');
    await deleteCollectionDocuments('guildAttendanceSummary');
  };

  const confirmResetAttendance = async () => {
    const trimmedPassword = resetAdminPassword.trim();
    if (!trimmedPassword) {
      setResetConfirmError('Enter admin password to continue.');
      return;
    }

    const currentUser = auth.currentUser;
    const currentUserEmail = currentUser?.email;

    if (!currentUser || !currentUserEmail) {
      setResetConfirmError('Admin session not found. Please sign in again.');
      return;
    }

    try {
      setIsConfirmingResetAttendance(true);
      setResetConfirmError(null);

      const credential = EmailAuthProvider.credential(currentUserEmail, trimmedPassword);
      await reauthenticateWithCredential(currentUser, credential);

      await deleteAllAttendanceRecords();

      resetAttendanceToolbarState();
      closeResetAttendanceConfirm();
    } catch (error) {
      console.error('Failed to confirm reset attendance:', error);
      const errorCode =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: unknown }).code)
          : '';

      if (
        errorCode === 'auth/wrong-password'
        || errorCode === 'auth/invalid-credential'
        || errorCode === 'auth/invalid-login-credentials'
      ) {
        setResetConfirmError('Incorrect admin password. Please try again.');
      } else {
        setResetConfirmError('Failed to reset attendance records. Please try again.');
      }
    } finally {
      setIsConfirmingResetAttendance(false);
    }
  };

  const saveAttendanceFromModal = async () => {
    if (!canManage) return;

    const selectedBossesToPersist = forceDashBossName
      ? ['-']
      : selectedBossNames.filter((selectedBossName) => bossNameOptions.includes(selectedBossName));

    const membersToPersist = members
      .filter((member): member is typeof member & { id: string } => Boolean(member.id));

    const presentMembersForSummary = membersToPersist
      .filter((member) => draftAttendanceByMemberId[member.id] === 'present')
      .map((member) => ({
        name: member.name,
        multiplier: getCreateAttendanceMultiplier(Number(member.combatPower || 0)),
      }))
      .filter((member) => Boolean(member.name));

    if (presentMembersForSummary.length === 0) {
      setCreateAttendanceError('Select atleast 1 member before creating attendance.');
      return;
    }

    if (selectedBossesToPersist.length === 0) {
      setCreateAttendanceError('Select atleast 1 boss before creating attendance.');
      return;
    }

    const selectedAttendancePoints = getAttendancePointsForBossSelection(
      attendanceType,
      selectedBossesToPersist
    );

    try {
      setCreateAttendanceError(null);
      setIsSavingAttendanceData(true);
      setIsSyncingAttendanceSummary(true);

      await Promise.all(
        selectedBossesToPersist.flatMap((selectedBossName) => (
          membersToPersist.map(async (member) => {
            const draftStatus = draftAttendanceByMemberId[member.id] || 'unmarked';

            if (draftStatus === 'present') {
              const multiplier = getCreateAttendanceMultiplier(Number(member.combatPower || 0));
              await upsertAttendance(member.id, member.name, 'present', multiplier, selectedBossName);
            }
          })
        ))
      );

      if (presentMembersForSummary.length > 0) {
        await syncPresentMembersToSummary(
          attendanceType,
          presentMembersForSummary,
          selectedAttendancePoints
        );
      }

      closeCreateAttendanceModal();
    } catch (error) {
      console.error('Failed to sync attendance summary:', error);
    } finally {
      setIsSavingAttendanceData(false);
      setIsSyncingAttendanceSummary(false);
    }
  };

  const getStatusBadge = (status?: AttendanceStatus) => {
    if (!status) {
      return <span className="badge badge-unmarked">Unmarked</span>;
    }

    if (status === 'present') return <span className="badge badge-present">Present</span>;
    if (status === 'late') return <span className="badge badge-late">Late</span>;
    return <span className="badge badge-absent">Absent</span>;
  };

  const loading = membersLoading || attendanceLoading || summaryLoading || bossesLoading || guildInfoLoading;
  const pageError = membersError || attendanceError || summaryError || bossesError || guildInfoError;
  const isSaveAttendanceDisabled =
    isClearingAll || loading || isSyncingAttendanceSummary || isSavingAttendanceData;
  const displayedAttendancePoints = isCreateAttendanceOpen
    ? getAttendancePointsForBossSelection(attendanceType, selectedBossNames)
    : getAttendancePoints(attendanceType, bossName);
  const totalFund = guildInfo?.totalFund ?? 0;
  const attendancePercentage = totalFund * 0.9;
  const managementPercentage = totalFund * 0.1;
  const monthAbbreviations = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May.', 'Jun.', 'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.'];
  const currentDateLabel = `${monthAbbreviations[Math.max(0, Math.min(11, Number(month) - 1))]} ${Number(day)}`;
  const summaryRowsComputed = useMemo(() => {
    const memberMultiplierByName = new Map(
      members.map((member) => {
        const normalizedName = member.name.trim().toLowerCase();
        const combatPower = Number(member.combatPower || 0);

        const computedMultiplier = getCreateAttendanceMultiplier(combatPower);

        return [normalizedName, computedMultiplier] as const;
      })
    );
    const memberCombatPowerByName = new Map(
      members.map((member) => [member.name.trim().toLowerCase(), Number(member.combatPower || 0)] as const)
    );

    const rowsWithMemberTotals = summaryRows.map((row) => {
      const computedTotalAttendance =
        Number(row.kransia || 0)
        + Number(row.fieldBoss || 0)
        + Number(row.guildBoss || 0)
        + Number(row.guildvsguild || 0);
      const normalizedRowName = row.name.trim().toLowerCase();
      const computedMultiplier = memberMultiplierByName.get(normalizedRowName) ?? 1.0;
      const memberCombatPower = memberCombatPowerByName.get(normalizedRowName) ?? null;

      return {
        ...row,
        computedTotalAttendance,
        computedMultiplier,
        memberCombatPower,
      };
    });

    const computedGrandTotalAttendance = rowsWithMemberTotals.reduce(
      (sum, row) => sum + row.computedTotalAttendance,
      0
    );

    return rowsWithMemberTotals
      .map((row) => {
        const computedPercentage = computedGrandTotalAttendance > 0
          ? (row.computedTotalAttendance / computedGrandTotalAttendance) * 100
          : 0;
        const computedUsdtShare = attendancePercentage * (computedPercentage / 100);

        return {
          ...row,
          computedPercentage,
          computedUsdtShare,
        };
      })
      .sort((first, second) => {
        const attendanceDifference = second.computedTotalAttendance - first.computedTotalAttendance;
        if (attendanceDifference !== 0) return attendanceDifference;
        return first.name.localeCompare(second.name);
      });
  }, [summaryRows, attendancePercentage, members]);

  const totalAttendanceAsOfCurrentDate = useMemo(
    () => summaryRowsComputed.reduce((sum, row) => sum + row.computedTotalAttendance, 0),
    [summaryRowsComputed]
  );

  const guestSummaryRowsComputed = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    if (!normalizedSearch) return summaryRowsComputed;

    return summaryRowsComputed.filter((row) => row.name.toLowerCase().includes(normalizedSearch));
  }, [summaryRowsComputed, searchQuery]);

  const manageSummaryRowsComputed = useMemo(() => {
    const normalizedSearch = manageSearchQuery.trim().toLowerCase();
    if (!normalizedSearch) return summaryRowsComputed;

    return summaryRowsComputed.filter((row) => row.name.toLowerCase().includes(normalizedSearch));
  }, [summaryRowsComputed, manageSearchQuery]);
  const isResetAttendanceDisabled = isClearingAll || loading || manageSummaryRowsComputed.length === 0;
  const hasDraftAttendanceSelections = useMemo(
    () => Object.values(draftAttendanceByMemberId).some((status) => status !== 'unmarked'),
    [draftAttendanceByMemberId]
  );
  const isModalClearAllDisabled = isClearingAll || loading || (!hasDraftAttendanceSelections && ocrRows.length === 0);

  const startMetricEdit = (currentValue: number) => {
    setEditingMetric('totalFund');
    setEditingMetricValue(String(currentValue));
  };

  const cancelMetricEdit = () => {
    setEditingMetric(null);
    setEditingMetricValue('');
    setIsSavingMetric(false);
  };

  const saveMetricEdit = async () => {
    if (!editingMetric || !guildInfo?.id) return;

    const parsedValue = Math.max(0, Number(editingMetricValue || 0));
    if (Number.isNaN(parsedValue)) return;

    try {
      setIsSavingMetric(true);
      await updateGuildInfoFields(guildInfo.id, {
        totalFund: parsedValue,
        attendancePercentage: Number((parsedValue * 0.9).toFixed(1)),
        managementPercentage: Number((parsedValue * 0.1).toFixed(1)),
      });
      setEditingMetric(null);
      setEditingMetricValue('');
    } catch (error) {
      console.error('Failed to update guild metric:', error);
    } finally {
      setIsSavingMetric(false);
    }
  };

  const viewMemberAttendanceDetails = async (memberName: string) => {
    setViewingMemberName(memberName);
    setIsLoadingMemberDetails(true);
    setMemberDetailsError(null);
    setMemberAttendanceDetails([]);

    try {
      const memberAttendanceQuery = query(
        collection(db, 'guildAttendance'),
        where('name', '==', memberName)
      );
      const snapshot = await getDocs(memberAttendanceQuery);
      const details = snapshot.docs
        .map((attendanceDoc) => {
          const data = attendanceDoc.data() as {
            attendanceType?: string;
            bossName?: string;
            attendanceDate?: string;
            status?: string;
            multiplier?: number;
          };

          const status: AttendanceStatus =
            data.status === 'Present'
              ? 'present'
              : data.status === 'Late'
                ? 'late'
                : 'absent';

          return {
            id: attendanceDoc.id,
            attendanceType: data.attendanceType || '-',
            bossName: data.bossName || '-',
            attendanceDate: data.attendanceDate || '',
            status,
            multiplier: Number(data.multiplier ?? 1),
          };
        })
        .sort((first, second) => {
          const firstDate = Date.parse(first.attendanceDate);
          const secondDate = Date.parse(second.attendanceDate);

          if (Number.isNaN(firstDate) || Number.isNaN(secondDate)) {
            return second.attendanceDate.localeCompare(first.attendanceDate);
          }

          return secondDate - firstDate;
        });

      setMemberAttendanceDetails(details);
    } catch (detailsError) {
      console.error('Failed to load member attendance details:', detailsError);
      setMemberDetailsError('Failed to load attendance details. Please try again.');
    } finally {
      setIsLoadingMemberDetails(false);
    }
  };

  const closeMemberAttendanceDetails = () => {
    setViewingMemberName(null);
    setMemberAttendanceDetails([]);
    setMemberDetailsError(null);
    setIsLoadingMemberDetails(false);
    setDeletingAttendanceId(null);
  };

  const formatAttendanceDateOnly = (attendanceDate: string) => {
    if (!attendanceDate) return '-';
    const [datePart] = attendanceDate.split('T');
    return datePart || '-';
  };

  const deleteAttendanceDetail = async (attendance: {
    id: string;
    attendanceType: string;
    bossName: string;
    attendanceDate: string;
  }) => {
    const attendanceDateLabel = formatAttendanceDateOnly(attendance.attendanceDate);
    const confirmationMessage = [
      'Delete this attendance record?',
      '',
      `Type: ${attendance.attendanceType || '-'}`,
      `Boss: ${attendance.bossName || '-'}`,
      `Date: ${attendanceDateLabel}`,
    ].join('\n');

    const isConfirmed = window.confirm(confirmationMessage);
    if (!isConfirmed) return;

    try {
      setDeletingAttendanceId(attendance.id);
      await deleteDoc(doc(db, 'guildAttendance', attendance.id));
      setMemberAttendanceDetails((current) => current.filter((currentAttendance) => currentAttendance.id !== attendance.id));
      if (viewingMemberName) {
        await refreshSummaryForMember(viewingMemberName);
      }
    } catch (deleteError) {
      console.error('Failed to delete attendance detail:', deleteError);
      setMemberDetailsError('Failed to delete attendance record. Please try again.');
    } finally {
      setDeletingAttendanceId(null);
    }
  };

  const memberAttendanceTable = (
    <div className="attendance-table-container">
      <table className="attendance-table">
        <thead>
          <tr>
            <th>No.</th>
            <th>Name</th>
            <th className="col-combat-power">Combat Power</th>
            <th className="col-pts">PTS</th>
            <th className="col-multiplier">Multiplier</th>
            <th>Date</th>
            <th className="col-status">Status</th>
            {canManage && <th className="col-action">Action</th>}
          </tr>
        </thead>
        <tbody>
          {membersWithAttendance.map((member, index) => (
            <tr key={member.id}>
              <td className="member-rank">
                {canManage && isCreateAttendanceOpen ? index + 1 : member.rank}
              </td>
              <td className="member-name">
                <div className="attendance-member-name-cell">
                  <div className="attendance-member-name-primary">{member.name}</div>
                  {!isAttendanceEligibleByCombatPower(Number(member.combatPower || 0)) && (
                    <div className="attendance-member-name-warning">
                      Below {MINIMUM_ATTENDANCE_COMBAT_POWER.toLocaleString()} combat power
                    </div>
                  )}
                </div>
              </td>
              <td className="member-date member-combat-power">{Number(member.combatPower || 0).toLocaleString()}</td>
              <td className="member-date member-pts">{displayedAttendancePoints}</td>
              <td className="member-date member-multiplier">{getCreateAttendanceMultiplier(Number(member.combatPower || 0)).toFixed(1)}</td>
              <td className="member-date">{selectedDate}</td>
              <td className="member-status">
                {getStatusBadge(member.attendanceStatus)}
              </td>
              {canManage && (
                <td className="member-action">
                  <label className="attendance-checkbox-toggle">
                    <input
                      type="checkbox"
                      checked={member.attendanceStatus === 'present'}
                      onChange={(event) =>
                        handleAttendanceCheckboxChange(
                          member.id as string,
                          member.name,
                          event.target.checked
                        )
                      }
                      disabled={!member.id}
                    />
                  </label>
                </td>
              )}
            </tr>
          ))}
          {!loading && membersWithAttendance.length === 0 && (
            <tr>
              <td colSpan={canManage ? 8 : 7} className="attendance-empty-row">
                No members found for the selected filter.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className={`page-container ${canManage ? 'attendance-manage-page' : 'attendance-guest-page'}`}>
      <div className="page-header">
        <h2>{canManage ? 'Manage Attendance' : 'Attendance'}</h2>
        <p className="page-subtitle">
          {canManage ? 'Attendance recording for all guild members' : 'Guild member attendance records'}
        </p>
      </div>

      {loading && (
        <div className="loading-state attendance-loading">
          <p>Loading attendance... <Loader size={16} strokeWidth={1.8} /></p>
        </div>
      )}

      {pageError && (
        <div className="error-state">
          <p>{pageError}</p>
        </div>
      )}

      {!canManage && (
        <>
          <div className="guild-metrics-grid">
            <div className="guild-metric-card" tabIndex={0}>
              <div className="guild-metric-header">
                <p className="guild-metric-label">Total Guild Fund</p>
              </div>
              <p className="guild-metric-value">${totalFund.toLocaleString(undefined, { maximumFractionDigits: 1 })}</p>
            </div>

            <div className="guild-metric-card" tabIndex={0}>
              <div className="guild-metric-header">
                <p className="guild-metric-label">Attendance Share (90%)</p>
              </div>
              <p className="guild-metric-value">${attendancePercentage.toLocaleString(undefined, { maximumFractionDigits: 1 })}</p>
            </div>

            <div className="guild-metric-card" tabIndex={0}>
              <div className="guild-metric-header">
                <p className="guild-metric-label">Management Share (10%)</p>
              </div>
              <p className="guild-metric-value">${managementPercentage.toLocaleString(undefined, { maximumFractionDigits: 1 })}</p>
            </div>
          </div>

          <div className="attendance-guest-search-row">
            <div className="attendance-guest-search-box">
              <input
                type="text"
                className="attendance-guest-search-input"
                placeholder="Search member name"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                aria-label="Search member name"
              />
              {searchQuery.trim().length > 0 && (
                <button
                  type="button"
                  className="attendance-guest-search-clear"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  <X size={14} strokeWidth={2} />
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {canManage && (
        <>
          <div className="guild-metrics-grid">
            <div className="guild-metric-card" tabIndex={0}>
              <div className="guild-metric-header">
                <p className="guild-metric-label">Total Guild Fund</p>
                {editingMetric !== 'totalFund' ? (
                  <button
                    type="button"
                    className="guild-metric-edit-btn"
                    onClick={() => startMetricEdit(totalFund)}
                    aria-label="Edit Total Guild Fund"
                    disabled={isSavingMetric}
                  >
                    ✎
                  </button>
                ) : (
                  <div className="guild-metric-actions">
                    <button type="button" className="guild-metric-save-btn" onClick={saveMetricEdit} disabled={isSavingMetric}>✓</button>
                    <button type="button" className="guild-metric-cancel-btn" onClick={cancelMetricEdit} disabled={isSavingMetric}>✕</button>
                  </div>
                )}
              </div>
              {editingMetric === 'totalFund' ? (
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  className="guild-metric-input"
                  value={editingMetricValue}
                  onChange={(event) => setEditingMetricValue(event.target.value)}
                />
              ) : (
                <p className="guild-metric-value">${totalFund.toLocaleString(undefined, { maximumFractionDigits: 1 })}</p>
              )}
            </div>

            <div className="guild-metric-card" tabIndex={0}>
              <div className="guild-metric-header">
                <p className="guild-metric-label">Attendance Share (90%)</p>
              </div>
              <p className="guild-metric-value">${attendancePercentage.toLocaleString(undefined, { maximumFractionDigits: 1 })}</p>
            </div>

            <div className="guild-metric-card" tabIndex={0}>
              <div className="guild-metric-header">
                <p className="guild-metric-label">Management Share (10%)</p>
              </div>
              <p className="guild-metric-value">${managementPercentage.toLocaleString(undefined, { maximumFractionDigits: 1 })}</p>
            </div>
          </div>

          <div className="attendance-toolbar attendance-toolbar-below-metrics">
            <div className="attendance-guest-search-box attendance-manage-search-box">
              <span className="attendance-guest-search-icon" aria-hidden="true">
                <Search size={14} strokeWidth={1.9} />
              </span>
              <input
                type="text"
                className="attendance-guest-search-input attendance-manage-search-input"
                placeholder="Search member name"
                value={manageSearchQuery}
                onChange={(event) => setManageSearchQuery(event.target.value)}
                aria-label="Search member name"
              />
              {manageSearchQuery.trim().length > 0 && (
                <button
                  type="button"
                  className="attendance-guest-search-clear"
                  onClick={() => setManageSearchQuery('')}
                  aria-label="Clear search"
                >
                  <X size={14} strokeWidth={2} />
                </button>
              )}
            </div>
            <button
              type="button"
              className="reset-attendance-btn"
              onClick={openResetAttendanceConfirm}
              title="Reset Attendance"
              aria-label="Reset Attendance"
              disabled={isResetAttendanceDisabled}
            >
              <CloudBackup size={16} strokeWidth={1.8} />
            </button>
            <button
              type="button"
              className="create-attendance-btn"
              onClick={() => {
                setCreateAttendanceError(null);
                setCreateAttendanceTab('ocr');
                setOcrRows([]);
                setOcrError(null);
                setOcrSourceLabel('');
                setIsCreateAttendanceOpen(true);
              }}
              title="Create Attendance"
              aria-label="Create Attendance"
            >
              <Plus size={16} strokeWidth={1.8} />
            </button>
          </div>

          <div className="attendance-table-container attendance-summary-main">
          <table className="attendance-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Kransia</th>
                <th>Field Boss</th>
                <th>Guild Boss</th>
                <th>Guild vs Guild</th>
                <th>Total Pts</th>
                <th>%</th>
                <th>USDT Share</th>
                <th>Multiplier</th>
                <th className="summary-action-col">View</th>
              </tr>
            </thead>
            <tbody>
              {manageSummaryRowsComputed.map((row) => (
                <tr key={row.id}>
                  <td className="member-name">
                    <div className="attendance-summary-member-name-cell">
                      <div className="attendance-summary-member-name-primary">{row.name}</div>
                      {row.memberCombatPower !== null && !isAttendanceEligibleByCombatPower(row.memberCombatPower) && (
                        <div className="attendance-summary-member-name-warning">
                          Below {MINIMUM_ATTENDANCE_COMBAT_POWER.toLocaleString()} combat power
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="member-date">{row.kransia}</td>
                  <td className="member-date">{row.fieldBoss}</td>
                  <td className="member-date">{row.guildBoss}</td>
                  <td className="member-date">{row.guildvsguild}</td>
                  <td className="member-date">{row.computedTotalAttendance}</td>
                  <td className="member-date">{row.computedPercentage.toFixed(2)}%</td>
                  <td className="member-date">${row.computedUsdtShare.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                  <td className="member-date">{row.computedMultiplier.toFixed(1)}</td>
                  <td className="summary-action-cell">
                    <div className="summary-action-buttons">
                      <button
                        className="summary-view-btn"
                        type="button"
                        aria-label={`View attendance details for ${row.name}`}
                        onClick={() => viewMemberAttendanceDetails(row.name)}
                      >
                        View Details
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && manageSummaryRowsComputed.length === 0 && (
                <tr>
                  <td colSpan={10} className="attendance-empty-row">
                    No guild attendance summary records found.
                  </td>
                </tr>
              )}
            </tbody>
            {!loading && summaryRowsComputed.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={5} className="summary-footer-label">Total Points (as of {currentDateLabel})</td>
                  <td className="summary-footer-value">{totalAttendanceAsOfCurrentDate.toLocaleString()}</td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        </>
      )}

      {!canManage && (
        <div className="attendance-table-container attendance-summary-main">
          <table className="attendance-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Kransia</th>
                <th>Field Boss</th>
                <th>Guild Boss</th>
                <th>Guild vs Guild</th>
                <th>Total Pts</th>
                <th>%</th>
                <th>USDT Share</th>
                <th>Multiplier</th>
                <th className="summary-action-col">View</th>
              </tr>
            </thead>
            <tbody>
              {guestSummaryRowsComputed.map((row) => (
                <tr key={row.id}>
                  <td className="member-name">
                    <div className="attendance-summary-member-name-cell">
                      <div className="attendance-summary-member-name-primary">{row.name}</div>
                      {row.memberCombatPower !== null && !isAttendanceEligibleByCombatPower(row.memberCombatPower) && (
                        <div className="attendance-summary-member-name-warning">
                          Below {MINIMUM_ATTENDANCE_COMBAT_POWER.toLocaleString()} combat power
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="member-date">{row.kransia}</td>
                  <td className="member-date">{row.fieldBoss}</td>
                  <td className="member-date">{row.guildBoss}</td>
                  <td className="member-date">{row.guildvsguild}</td>
                  <td className="member-date">{row.computedTotalAttendance}</td>
                  <td className="member-date">{row.computedPercentage.toFixed(2)}%</td>
                  <td className="member-date">${row.computedUsdtShare.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                  <td className="member-date">{row.computedMultiplier.toFixed(1)}</td>
                  <td className="summary-action-cell">
                    <div className="summary-action-buttons">
                      <button
                        className="summary-view-btn"
                        type="button"
                        aria-label={`View attendance details for ${row.name}`}
                        onClick={() => viewMemberAttendanceDetails(row.name)}
                      >
                        View Details
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && guestSummaryRowsComputed.length === 0 && (
                <tr>
                  <td colSpan={10} className="attendance-empty-row">
                    No guild attendance summary records found.
                  </td>
                </tr>
              )}
            </tbody>
            {!loading && summaryRowsComputed.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={5} className="summary-footer-label">Total Points (as of {currentDateLabel})</td>
                  <td className="summary-footer-value">{totalAttendanceAsOfCurrentDate.toLocaleString()}</td>
                  <td></td>
                  <td></td>
                  <td></td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {canManage && isResetAttendanceConfirmOpen && (
        <div className="attendance-modal-overlay" onClick={closeResetAttendanceConfirm}>
          <div className="attendance-modal-content attendance-reset-confirm-modal" onClick={(event) => event.stopPropagation()}>
            <div className="attendance-modal-header">
              <h3>Reset Attendance</h3>
              <button
                className="attendance-modal-close"
                onClick={closeResetAttendanceConfirm}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="attendance-reset-confirm-body">
              <p>
                This action will delete the attendance record in the database and cannot be undone.
              </p>

              <div className="attendance-reset-password-wrapper">
                <input
                  type={showResetAdminPassword ? 'text' : 'password'}
                  className="attendance-reset-password-input"
                  placeholder="Enter admin password"
                  value={resetAdminPassword}
                  onChange={(event) => {
                    setResetAdminPassword(event.target.value);
                    if (resetConfirmError) {
                      setResetConfirmError(null);
                    }
                  }}
                  disabled={isConfirmingResetAttendance}
                />
                {resetAdminPassword.length > 0 && (
                  <button
                    type="button"
                    className="attendance-reset-password-toggle"
                    onClick={() => setShowResetAdminPassword((current) => !current)}
                    aria-label={showResetAdminPassword ? 'Hide password' : 'Show password'}
                    disabled={isConfirmingResetAttendance}
                  >
                    {showResetAdminPassword ? (
                      <EyeOff size={16} strokeWidth={1.8} />
                    ) : (
                      <Eye size={16} strokeWidth={1.8} />
                    )}
                  </button>
                )}
              </div>

              {resetConfirmError && <p className="attendance-reset-confirm-error">{resetConfirmError}</p>}
            </div>

            <div className="attendance-modal-footer">
              <div className="attendance-modal-footer-right">
                <button
                  className="action-btn attendance-save-btn"
                  onClick={confirmResetAttendance}
                  disabled={isConfirmingResetAttendance || !resetAdminPassword.trim()}
                >
                  {isConfirmingResetAttendance ? 'Verifying...' : 'Confirm Reset'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {canManage && isCreateAttendanceOpen && (
        <div className="attendance-modal-overlay">
          <div className="attendance-modal-content" onClick={(event) => event.stopPropagation()}>
            <div className="attendance-modal-header">
              <h3>Create Attendance</h3>
              <button
                className="attendance-modal-close"
                onClick={closeCreateAttendanceModal}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="attendance-filters">
              <input
                type="date"
                className="filter-input"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
              />
              <select
                className="filter-select"
                value={attendanceType}
                onChange={(event) => setAttendanceType(event.target.value)}
              >
                <option value="Field Boss">Field Boss</option>
                <option value="Guild Boss">Guild Boss</option>
                <option value="Kransia">Kransia</option>
                <option value="Guild vs. Guild">Guild vs. Guild</option>
              </select>
              <div className="boss-multi-dropdown" ref={bossDropdownRef}>
                <button
                  type="button"
                  className="boss-multi-dropdown-trigger"
                  onClick={() => setIsBossDropdownOpen((current) => !current)}
                  disabled={bossNameOptions.length === 0}
                >
                  <span className="boss-multi-dropdown-label">Bosses</span>
                  <span className="boss-multi-dropdown-value">
                    {forceDashBossName
                      ? '-'
                      : selectedBossNames.length === 0
                        ? 'Select boss'
                        : `${selectedBossNames.length} selected`}
                  </span>
                  <ChevronDown
                    size={15}
                    strokeWidth={2}
                    className={`boss-multi-dropdown-icon ${isBossDropdownOpen ? 'open' : ''}`}
                  />
                </button>

                {isBossDropdownOpen && (
                  <div className="boss-multi-dropdown-menu">
                    {!forceDashBossName && bossNameOptions.length > 0 && (
                      <div className="boss-multi-dropdown-actions">
                        <button
                          type="button"
                          className="boss-multi-dropdown-action"
                          onClick={selectAllBosses}
                          disabled={selectedBossNames.length === bossNameOptions.length}
                        >
                          Select all
                        </button>
                        <button
                          type="button"
                          className="boss-multi-dropdown-action muted"
                          onClick={clearSelectedBosses}
                          disabled={selectedBossNames.length === 0}
                        >
                          Clear
                        </button>
                        <button
                          type="button"
                          className="boss-multi-dropdown-close"
                          onClick={() => setIsBossDropdownOpen(false)}
                          aria-label="Close boss dropdown"
                          title="Close"
                        >
                          <X size={14} strokeWidth={2.4} />
                        </button>
                      </div>
                    )}

                    <div className="boss-multi-dropdown-options">
                      {(forceDashBossName ? ['-'] : bossNameOptions).map((nameOption) => {
                        const isChecked = selectedBossNames.includes(nameOption);
                        return (
                          <button
                            key={nameOption}
                            type="button"
                            className="boss-multi-dropdown-option"
                            aria-checked={isChecked}
                            role="menuitemcheckbox"
                            onClick={() => toggleBossSelection(nameOption)}
                            disabled={forceDashBossName}
                          >
                            <span className="boss-multi-dropdown-checkbox" aria-hidden="true">
                              {isChecked && <Check size={12} strokeWidth={3} />}
                            </span>
                            <span className="boss-multi-dropdown-option-name">{nameOption}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              <input
                type="text"
                className="filter-input create-attendance-search-input"
                placeholder="Search member name"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
            <div className="attendance-create-tabs" role="tablist" aria-label="Attendance mode">
              <button
                type="button"
                role="tab"
                className={`attendance-create-tab ${createAttendanceTab === 'ocr' ? 'active' : ''}`}
                aria-selected={createAttendanceTab === 'ocr'}
                onClick={() => setCreateAttendanceTab('ocr')}
              >
                <span className="attendance-create-tab-title">OCR Attendance</span>
              </button>
              <button
                type="button"
                role="tab"
                className={`attendance-create-tab ${createAttendanceTab === 'manual' ? 'active' : ''}`}
                aria-selected={createAttendanceTab === 'manual'}
                onClick={() => setCreateAttendanceTab('manual')}
              >
                <span className="attendance-create-tab-title">Manual Attendance</span>
              </button>
            </div>

            {createAttendanceTab === 'ocr' ? (
              <div className="attendance-ocr-panel">
                <input
                  ref={ocrFileInputRef}
                  type="file"
                  accept="image/*"
                  className="attendance-ocr-file-input"
                  onChange={handleOcrFileChange}
                />

                <div
                  className="attendance-ocr-paste-zone"
                  tabIndex={0}
                  role="region"
                  aria-label="Paste OCR image here"
                  onPaste={handleOcrPaste}
                  onClick={(event) => event.currentTarget.focus()}
                >
                  <div className="attendance-ocr-paste-icons" aria-hidden="true">
                    <span className="attendance-ocr-paste-icon-card">
                      <Clipboard size={22} strokeWidth={1.9} />
                    </span>
                    <span className="attendance-ocr-paste-icon-card accent">
                      <ImageUp size={20} strokeWidth={1.9} />
                    </span>
                  </div>

                  <p>Click this area, then paste your screenshot here.</p>
                  <span>New pasted images are added to the OCR results table instead of replacing the current data.</span>

                  <button
                    type="button"
                    className="attendance-ocr-inline-upload-btn"
                    onClick={(event) => {
                      event.stopPropagation();
                      ocrFileInputRef.current?.click();
                    }}
                    disabled={isProcessingOcr}
                  >
                    Upload image
                  </button>

                  <span className="attendance-ocr-paste-hint">Supported file types: PNG, JPG, JPEG, WEBP</span>
                </div>

                {(isProcessingOcr || ocrError || ocrSourceLabel) && (
                  <div className="attendance-ocr-feedback">
                    {isProcessingOcr && (
                      <p className="attendance-ocr-status">
                        Reading image... <Loader size={14} strokeWidth={1.8} />
                      </p>
                    )}
                    {ocrError && <p className="attendance-ocr-error">{ocrError}</p>}
                    {ocrSourceLabel && !isProcessingOcr && (
                      <p className="attendance-ocr-source">Source: {ocrSourceLabel}</p>
                    )}
                    {!isProcessingOcr && ocrRows.length > 0 && (
                      <p className="attendance-ocr-counter">
                        Showing {filteredOcrRows.length} OCR rows from {ocrMatchSummary.detectedRows} detected names against {ocrMatchSummary.manualRows} eligible members.
                      </p>
                    )}
                  </div>
                )}

                <div className="attendance-table-container attendance-ocr-table-container">
                  <table className="attendance-table attendance-ocr-table">
                    <thead>
                      <tr>
                        <th>No.</th>
                        <th>Member Name</th>
                        <th className="col-combat-power">Combat Power</th>
                        <th className="col-pts">PTS</th>
                        <th className="col-multiplier">Multiplier</th>
                        <th className="col-status">Status</th>
                        <th className="col-action">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOcrRows.map((row, index) => (
                        <tr key={row.id}>
                          <td className="member-rank">{index + 1}</td>
                          <td className="member-name attendance-ocr-member-name-cell">
                            <div className="attendance-ocr-member-name-primary">
                              {row.displayName}
                            </div>
                            {row.detectedName !== row.displayName && (
                              <div className="attendance-ocr-member-name-secondary">Detected: {row.detectedName}</div>
                            )}
                            <div className="attendance-ocr-member-name-secondary">
                              Confidence: {Math.round(row.matchConfidence * 100)}%
                            </div>
                            {getOcrRowNoticeMessage(row.notice) && (
                              <div className="attendance-ocr-member-name-secondary">
                                {getOcrRowNoticeMessage(row.notice)}
                              </div>
                            )}
                          </td>
                          <td className="member-date member-combat-power">
                            {row.combatPower !== null ? row.combatPower.toLocaleString() : '—'}
                          </td>
                          <td className="member-date member-pts">{displayedAttendancePoints}</td>
                          <td className="member-date member-multiplier">
                            {row.multiplier !== null ? row.multiplier.toFixed(1) : '—'}
                          </td>
                          <td className="member-status">
                            <span className={`attendance-ocr-status-badge attendance-ocr-status-${row.status}`}>
                              {row.status === 'matched' ? 'Present' : row.status === 'review' ? 'Review' : 'Unmatched'}
                            </span>
                          </td>
                          <td className="member-action">
                            {row.status === 'review' && row.matchedMemberId && row.matchedMemberName && (
                              <button
                                type="button"
                                className="attendance-ocr-inline-upload-btn attendance-ocr-approve-btn"
                                onClick={() => handleApplySuggestedOcrMember(row.id, {
                                  memberId: row.matchedMemberId as string,
                                  memberName: row.matchedMemberName as string,
                                  combatPower: Number(row.combatPower || 0),
                                  multiplier: Number(row.multiplier ?? 1),
                                  confidence: row.matchConfidence,
                                  reason: row.matchReason,
                                })}
                                aria-label={`Approve ${row.displayName} OCR match`}
                                title="Approve OCR match"
                              >
                                <Check size={16} strokeWidth={2.2} />
                              </button>
                            )}
                            <button
                              type="button"
                              className="details-delete-btn attendance-ocr-remove-btn"
                              onClick={() => handleRemoveOcrAttendanceRow(row)}
                              aria-label={`Remove ${row.displayName} from OCR attendance`}
                              title="Remove from OCR attendance"
                            >
                              <X className="details-delete-icon" size={16} strokeWidth={2.2} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {!isProcessingOcr && filteredOcrRows.length === 0 && (
                        <tr>
                          <td colSpan={7} className="attendance-empty-row">
                            Upload or paste an attendance screenshot to extract member names.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <p className="attendance-ocr-reminder-note">
                  Reminder: Double check whether all names in the screenshot were included.
                </p>
              </div>
            ) : (
              memberAttendanceTable
            )}

            <div className="attendance-modal-footer">
              <div className="attendance-modal-footer-left">
                <button
                  className="action-btn action-btn-muted clear-all-btn"
                  onClick={clearAllAttendance}
                  disabled={isModalClearAllDisabled}
                >
                  {isClearingAll ? 'Clearing...' : 'Clear All'}
                </button>
              </div>

              <div className="attendance-modal-footer-right">
                {createAttendanceError && (
                  <p className="attendance-create-error">{createAttendanceError}</p>
                )}
                <button
                  className="action-btn attendance-save-btn"
                  onClick={saveAttendanceFromModal}
                  disabled={isSaveAttendanceDisabled}
                >
                  {isSaveAttendanceDisabled ? 'Please wait...' : 'Save Attendance'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewingMemberName && (
        <div className="attendance-modal-overlay" onClick={closeMemberAttendanceDetails}>
          <div className="attendance-modal-content attendance-details-modal" onClick={(event) => event.stopPropagation()}>
            <div className="attendance-modal-header">
              <div className="attendance-details-heading">
                <h3>{viewingMemberName}</h3>
                <p className="attendance-details-subtitle">Attendance details</p>
              </div>
              <button
                className="attendance-modal-close"
                onClick={closeMemberAttendanceDetails}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {isLoadingMemberDetails && (
              <div className="loading-state attendance-loading">
                <p>Loading attendance details... <Loader size={16} strokeWidth={1.8} /></p>
              </div>
            )}

            {memberDetailsError && (
              <div className="error-state">
                <p>{memberDetailsError}</p>
              </div>
            )}

            {!isLoadingMemberDetails && !memberDetailsError && (
              <div className="attendance-table-container">
                <table className="attendance-table attendance-details-table">
                  <thead>
                    <tr>
                      <th className="details-col-number">No.</th>
                      <th className="details-col-type">Type</th>
                      <th className="details-col-boss">Boss</th>
                      <th className="details-col-pts">PTS</th>
                      <th className="details-col-multiplier">Multiplier</th>
                      <th className="details-col-date">Date</th>
                      <th className="details-col-status">Status</th>
                      {canManage && <th className="details-col-action">Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {memberAttendanceDetails.map((attendance, index) => (
                      <tr key={attendance.id}>
                        <td className="details-cell-number">{index + 1}</td>
                        <td className="details-cell-type">{attendance.attendanceType}</td>
                        <td className="details-cell-boss">{attendance.bossName}</td>
                        <td className="details-cell-pts">
                          {getAttendancePoints(attendance.attendanceType, attendance.bossName)}
                        </td>
                        <td className="details-cell-multiplier">{Number(attendance.multiplier ?? 1).toFixed(1)}</td>
                        <td className="details-cell-date">{formatAttendanceDateOnly(attendance.attendanceDate)}</td>
                        <td className="details-cell-status">{getStatusBadge(attendance.status)}</td>
                        {canManage && (
                          <td className="details-cell-action">
                            <button
                              type="button"
                              className="summary-edit-btn details-delete-btn"
                              aria-label="Delete attendance"
                              onClick={() => deleteAttendanceDetail(attendance)}
                              disabled={deletingAttendanceId === attendance.id}
                              title={deletingAttendanceId === attendance.id ? 'Deleting...' : 'Delete attendance'}
                            >
                              <span className="summary-edit-glyph" aria-hidden="true">
                                {deletingAttendanceId === attendance.id ? (
                                  <Loader className="details-delete-icon" size={16} strokeWidth={2} />
                                ) : (
                                  <Trash2 className="details-delete-icon" size={16} strokeWidth={2} />
                                )}
                              </span>
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    {memberAttendanceDetails.length === 0 && (
                      <tr>
                        <td colSpan={canManage ? 8 : 7} className="attendance-empty-row">
                          No attendance records found for this member.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default AttendancePage;
