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

interface OcrAttendanceRow {
  id: string;
  detectedName: string;
  matchedMemberId: string | null;
  matchedMemberName: string | null;
  suggestedMemberNames: string[];
  combatPower: number | null;
  multiplier: number | null;
  status: 'matched' | 'unmatched';
}

const OCR_ENGLISH_ONLY_SANITIZER = /[^A-Za-z0-9\s]/g;
const DEFAULT_OCR_PROXY_PATH = '/api/ocr-space';
const OCR_SPACE_ENDPOINT = import.meta.env.VITE_OCR_SPACE_ENDPOINT?.trim() || 'https://api.ocr.space/parse/image';
const OCR_SPACE_API_KEY = import.meta.env.VITE_OCR_SPACE_API_KEY?.trim() || '';
const SHORT_OCR_NAME_MAX_LENGTH = 4;
const SHORT_OCR_FUSE_THRESHOLD = 0.18;
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

interface OcrSpaceParsedResult {
  ParsedText?: string;
}

interface OcrSpaceResponse {
  IsErroredOnProcessing?: boolean;
  ErrorMessage?: string[] | string;
  ErrorDetails?: string;
  ParsedResults?: OcrSpaceParsedResult[];
  error?: string;
}

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

const normalizeOcrName = (value: string) => value
  .toLowerCase()
  .replace(/[0]/g, 'o')
  .replace(/[2]/g, 'z')
  .replace(/[5]/g, 's')
  .replace(/[6]/g, 'g')
  .replace(/[8]/g, 'b')
  .replace(/[1]/g, 'i')
  .replace(/[^a-z]/g, '');

const normalizeOcrAlphaNumericName = (value: string) => value
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

const getNormalizedOcrVariants = (value: string) => {
  const sanitized = value.toLowerCase().replace(/[^a-z0-9]/g, '');
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
    .split(/[^a-z0-9]+/)
    .map((token) => normalizeOcrName(token))
    .filter((token) => token.length >= 2);

const extractOcrNameCandidates = (rawText: string) => {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.replace(OCR_ENGLISH_ONLY_SANITIZER, ' ').replace(/\s+/g, ' ').trim())
    .filter((line) => /[a-z]/i.test(line))
    .filter((line) => {
      const normalizedLine = normalizeOcrName(line);
      const normalizedAlphaNumericLine = normalizeOcrAlphaNumericName(line);
      return normalizedLine.length >= 3 || normalizedAlphaNumericLine.length >= 3;
    });
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

const requestOcrViaDirectApi = async (imageDataUrl: string) => {
  const response = await fetch(OCR_SPACE_ENDPOINT, {
    method: 'POST',
    headers: {
      apikey: OCR_SPACE_API_KEY,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      base64Image: imageDataUrl,
      language: 'eng',
      OCREngine: '2',
      isOverlayRequired: 'false',
      scale: 'true',
      detectOrientation: 'true',
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

  const filteredOcrRows = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    if (!normalizedSearch) return ocrRows;

    return ocrRows.filter((row) => {
      const searchableText = [
        row.detectedName,
        row.matchedMemberName ?? '',
        row.suggestedMemberNames.join(' '),
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
    const label = row.matchedMemberName ?? row.detectedName ?? 'this OCR row';
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
      return exactAlphaNumericMatches[0];
    }

    const exactVariantMatches = Array.from(new Map(
      candidateVariants.flatMap((variant) => (
        (comparableMembersByNormalizedName.get(variant) ?? [])
          .filter((member) => !reservedMemberIds.has(member.id))
          .map((member) => [member.id, member] as const)
      ))
    ).values());

    if (exactVariantMatches.length === 1) {
      return exactVariantMatches[0];
    }

    const exactTokenMatches = Array.from(new Map(
      candidateVariants.flatMap((variant) => (
        (comparableMembersByToken.get(variant) ?? [])
          .filter((member) => !reservedMemberIds.has(member.id))
          .map((member) => [member.id, member] as const)
      ))
    ).values());

    if (exactTokenMatches.length === 1) {
      return exactTokenMatches[0];
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

      return bestFuseResult.item;
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

    return bestTokenMatch;
  };

  const getSuggestedOcrMemberNames = (candidateName: string, reservedMemberIds: Set<string>) => {
    const normalizedCandidate = normalizeOcrName(candidateName);
    const normalizedCandidateAlphaNumeric = normalizeOcrAlphaNumericName(candidateName);
    if (!normalizedCandidate && !normalizedCandidateAlphaNumeric) return [] as string[];

    const candidateVariants = getNormalizedOcrVariants(candidateName);
    const suggestions = new Map<string, string>();

    (comparableMembersByAlphaNumericName.get(normalizedCandidateAlphaNumeric) ?? []).forEach((member) => {
      if (reservedMemberIds.has(member.id) || suggestions.has(member.id)) return;
      suggestions.set(member.id, member.name);
    });

    candidateVariants.forEach((variant) => {
      (comparableMembersByNormalizedName.get(variant) ?? []).forEach((member) => {
        if (reservedMemberIds.has(member.id) || suggestions.has(member.id)) return;
        suggestions.set(member.id, member.name);
      });

      (comparableMembersByToken.get(variant) ?? []).forEach((member) => {
        if (reservedMemberIds.has(member.id) || suggestions.has(member.id)) return;
        suggestions.set(member.id, member.name);
      });
    });

    if (suggestions.size < 3) {
      ocrMemberFuse.search(candidateName, { limit: 5 }).forEach((result) => {
        if ((result.score ?? 1) > 0.25) return;
        if (reservedMemberIds.has(result.item.id) || suggestions.has(result.item.id)) return;
        suggestions.set(result.item.id, result.item.name);
      });
    }

    return [...suggestions.values()].slice(0, 3);
  };

  const applyOcrTextToAttendance = (rawText: string, sourceLabel: string) => {
    const candidates = extractOcrNameCandidates(rawText);
    const seenRowKeys = new Set<string>();
    const seenDetectedNameKeys = new Set<string>();
    const reservedMemberIds = new Set(
      ocrRows
        .map((row) => row.matchedMemberId)
        .filter((memberId): memberId is string => Boolean(memberId))
    );
    const existingDetectedNameKeys = new Set(
      ocrRows
        .map((row) => getOcrDetectedNameKey(row.detectedName))
        .filter(Boolean)
    );
    const nextRows: OcrAttendanceRow[] = [];

    candidates.forEach((candidateName, index) => {
      const detectedNameKey = getOcrDetectedNameKey(candidateName);
      if (!detectedNameKey || seenDetectedNameKeys.has(detectedNameKey) || existingDetectedNameKeys.has(detectedNameKey)) {
        return;
      }

      const matchedMember = findBestOcrMemberMatch(candidateName, reservedMemberIds);
      const rowKey = getOcrRowKey({
        matchedMemberId: matchedMember?.id ?? null,
        detectedName: candidateName,
      });

      if (!rowKey || seenRowKeys.has(rowKey)) {
        return;
      }

      seenRowKeys.add(rowKey);
      seenDetectedNameKeys.add(detectedNameKey);
      if (matchedMember?.id) {
        reservedMemberIds.add(matchedMember.id);
      }

      nextRows.push({
        id: `${index}-${normalizeOcrName(candidateName)}`,
        detectedName: candidateName,
        matchedMemberId: matchedMember?.id ?? null,
        matchedMemberName: matchedMember?.name ?? null,
        suggestedMemberNames: matchedMember ? [] : getSuggestedOcrMemberNames(candidateName, reservedMemberIds),
        combatPower: matchedMember ? Number(matchedMember.combatPower || 0) : null,
        multiplier: matchedMember ? getCombatPowerMultiplier(Number(matchedMember.combatPower || 0)) : null,
        status: matchedMember ? 'matched' : 'unmatched',
      });
    });

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

    const matchedMemberIds = mergedRows
      .map((row) => row.matchedMemberId)
      .filter((memberId): memberId is string => Boolean(memberId));

    setDraftAttendanceByMemberId((current) => {
      const nextDraft = { ...current };
      matchedMemberIds.forEach((memberId) => {
        nextDraft[memberId] = 'present';
      });
      return nextDraft;
    });

    setOcrError(
      matchedMemberIds.length > 0
        ? null
        : 'OCR completed, but none of the detected names matched the current member list.'
    );
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
      const imageDataUrl = await readBlobAsDataUrl(imageSource);

      let result: OcrSpaceResponse | null = null;

      try {
        const response = await fetch(OCR_PROXY_ENDPOINT, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${idToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            imageDataUrl,
            language: 'eng',
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

        result = parsedResponse.payload;
      } catch (proxyError) {
        if (!canUseDirectOcrSpaceFallback()) {
          throw proxyError;
        }

        result = await requestOcrViaDirectApi(imageDataUrl);
      }

      if (result.IsErroredOnProcessing) {
        const errorMessage = Array.isArray(result.ErrorMessage)
          ? result.ErrorMessage.join(' ')
          : result.ErrorMessage;
        throw new Error(errorMessage || result.ErrorDetails || 'OCR.space failed to process the image.');
      }

      const parsedText = (result.ParsedResults ?? [])
        .map((entry) => entry.ParsedText || '')
        .join('\n');

      applyOcrTextToAttendance(parsedText, sourceLabel);
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
      .filter((member): member is typeof member & { id: string } => Boolean(member.id))
      .filter((member) => isAttendanceEligibleByCombatPower(member.combatPower));

    const presentMembersForSummary = membersToPersist
      .filter((member) => draftAttendanceByMemberId[member.id] === 'present')
      .map((member) => ({
        name: member.name,
        multiplier: getCombatPowerMultiplier(Number(member.combatPower || 0)),
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
              const multiplier = getCombatPowerMultiplier(Number(member.combatPower || 0));
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

      setIsCreateAttendanceOpen(false);
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

        const computedMultiplier = getCombatPowerMultiplier(combatPower);

        return [normalizedName, computedMultiplier] as const;
      })
    );

    const rowsWithMemberTotals = summaryRows.map((row) => {
      const computedTotalAttendance =
        Number(row.kransia || 0)
        + Number(row.fieldBoss || 0)
        + Number(row.guildBoss || 0)
        + Number(row.guildvsguild || 0);
      const computedMultiplier = memberMultiplierByName.get(row.name.trim().toLowerCase()) ?? 1.0;

      return {
        ...row,
        computedTotalAttendance,
        computedMultiplier,
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
              <td className="member-name">{member.name}</td>
              <td className="member-date member-combat-power">{Number(member.combatPower || 0).toLocaleString()}</td>
              <td className="member-date member-pts">{displayedAttendancePoints}</td>
              <td className="member-date member-multiplier">{getCombatPowerMultiplier(Number(member.combatPower || 0)).toFixed(1)}</td>
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
                      disabled={
                        !member.id
                        || (isCreateAttendanceOpen && !isAttendanceEligibleByCombatPower(member.combatPower))
                      }
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
                  <td className="member-name">{row.name}</td>
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
                  <td className="member-name">{row.name}</td>
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
        <div
          className="attendance-modal-overlay"
          onClick={closeCreateAttendanceModal}
        >
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
                              {row.matchedMemberName ?? row.detectedName}
                            </div>
                            {row.matchedMemberName && row.detectedName !== row.matchedMemberName && (
                              <div className="attendance-ocr-member-name-secondary">Detected: {row.detectedName}</div>
                            )}
                            {!row.matchedMemberName && row.suggestedMemberNames.length > 0 && (
                              <div className="attendance-ocr-member-name-secondary">
                                Suggestions: {row.suggestedMemberNames.join(', ')}
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
                              {row.status === 'matched' ? 'Present' : 'Unmatched'}
                            </span>
                          </td>
                          <td className="member-action">
                            <button
                              type="button"
                              className="details-delete-btn attendance-ocr-remove-btn"
                              onClick={() => handleRemoveOcrAttendanceRow(row)}
                              aria-label={`Remove ${row.matchedMemberName ?? row.detectedName} from OCR attendance`}
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
                  Reminder: Double check whether names with 3 letters are included correctly in the OCR read.
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
                        <td className="details-cell-multiplier">{Number(attendance.multiplier || 1).toFixed(1)}</td>
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
