const admin = require('firebase-admin');
const { onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');

admin.initializeApp();

const REGION = 'asia-southeast1';
const ocrSpaceApiKey = defineSecret('OCR_SPACE_API_KEY');
const OCR_SPACE_ENDPOINT = 'https://api.ocr.space/parse/image';
const MAX_IMAGE_DATA_URL_LENGTH = 10 * 1024 * 1024;
const ADMIN_ROLE = 'admin';
const SUPER_ADMIN_ROLE = 'super_admin';
const MARKETPLACE_PRICING_DOC_PATH = 'appSettings/marketplacePricing';
const MARKETPLACE_RATE_ENDPOINT = 'https://api.frankfurter.dev/v2/rate/USD/PHP';
const MARKETPLACE_RATE_SOURCE = 'frankfurter';
const SCHEDULER_TIME_ZONE = 'Asia/Manila';
const ADMIN_FUNCTION_OPTIONS = {
  region: REGION,
  timeoutSeconds: 60,
  memory: '256MiB',
  cors: false,
};

const adminCollection = () => admin.firestore().collection('admins');
const adminAuditLogCollection = () => admin.firestore().collection('adminAuditLogs');
const marketplacePricingDocument = () => admin.firestore().doc(MARKETPLACE_PRICING_DOC_PATH);

const setCorsHeaders = (request, response, methods = ['POST', 'OPTIONS']) => {
  const origin = request.get('origin');
  if (origin) {
    response.set('Access-Control-Allow-Origin', origin);
    response.set('Vary', 'Origin');
  }

  response.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  response.set('Access-Control-Allow-Methods', methods.join(', '));
};

const getBearerToken = (request) => {
  const authorizationHeader = request.get('authorization') || '';
  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
};

const normalizeAdminRole = (role, { legacyFallbackToSuperAdmin = false } = {}) => {
  if (role === SUPER_ADMIN_ROLE) return SUPER_ADMIN_ROLE;
  if (role === ADMIN_ROLE) return ADMIN_ROLE;
  return legacyFallbackToSuperAdmin ? SUPER_ADMIN_ROLE : ADMIN_ROLE;
};

const normalizeAdminRecord = (uid, data) => {
  const enabled = data?.enabled === true;
  const role = enabled
    ? normalizeAdminRole(data?.role, { legacyFallbackToSuperAdmin: true })
    : normalizeAdminRole(data?.role);

  return {
    uid,
    email: typeof data?.email === 'string' ? data.email : '',
    displayName: typeof data?.displayName === 'string' ? data.displayName : '',
    enabled,
    authDisabled: data?.authDisabled === true,
    role,
    createdAt: typeof data?.createdAt === 'string' ? data.createdAt : '',
    updatedAt: typeof data?.updatedAt === 'string' ? data.updatedAt : '',
    createdBy: typeof data?.createdBy === 'string' ? data.createdBy : '',
    updatedBy: typeof data?.updatedBy === 'string' ? data.updatedBy : '',
  };
};

const getAdminRecord = async (uid) => {
  const snapshot = await adminCollection().doc(uid).get();
  if (!snapshot.exists) return null;
  return normalizeAdminRecord(uid, snapshot.data());
};

const hasAdminAccess = async (decodedToken) => {
  const adminRecord = await getAdminRecord(decodedToken.uid);
  return Boolean(adminRecord?.enabled);
};

const hasSuperAdminAccess = async (decodedToken) => {
  const adminRecord = await getAdminRecord(decodedToken.uid);
  return Boolean(adminRecord?.enabled && adminRecord.role === SUPER_ADMIN_ROLE);
};

const syncAdminClaims = async (uid, { enabled, role }) => {
  if (!enabled) {
    await admin.auth().setCustomUserClaims(uid, {});
    return;
  }

  await admin.auth().setCustomUserClaims(uid, {
    admin: true,
    role,
    superAdmin: role === SUPER_ADMIN_ROLE,
  });
};

const writeAdminAuditLog = async ({ action, actorUid, targetUid, details = {} }) => {
  await adminAuditLogCollection().add({
    action,
    actorUid,
    targetUid,
    details,
    createdAt: new Date().toISOString(),
  });
};

const fetchUsdPhpExchangeRate = async () => {
  const response = await fetch(MARKETPLACE_RATE_ENDPOINT, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Frankfurter request failed with status ${response.status}.`);
  }

  const payload = await response.json();
  const rate = Number(payload?.rate);

  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error('Frankfurter returned an invalid USD/PHP rate.');
  }

  return {
    phpPerUsd: rate,
    sourceDate: typeof payload?.date === 'string' ? payload.date : '',
  };
};

const sendError = (response, status, error) => {
  response.status(status).json({ error });
};

const parseJsonBody = (request) => {
  if (request.body && typeof request.body === 'object') {
    return request.body;
  }

  return {};
};

const requireMethod = (request, response, expectedMethod) => {
  if (request.method === 'OPTIONS') {
    response.status(204).send('');
    return false;
  }

  if (request.method !== expectedMethod) {
    sendError(response, 405, 'Method not allowed.');
    return false;
  }

  return true;
};

const requireAuthenticatedUser = async (request, response) => {
  const idToken = getBearerToken(request);
  if (!idToken) {
    sendError(response, 401, 'Missing authorization token.');
    return null;
  }

  try {
    return await admin.auth().verifyIdToken(idToken);
  } catch {
    sendError(response, 401, 'Invalid authorization token.');
    return null;
  }
};

const requireAdminUser = async (request, response) => {
  const decodedToken = await requireAuthenticatedUser(request, response);
  if (!decodedToken) return null;

  if (!(await hasAdminAccess(decodedToken))) {
    sendError(response, 403, 'Admin access is required.');
    return null;
  }

  return decodedToken;
};

const requireSuperAdminUser = async (request, response) => {
  const decodedToken = await requireAuthenticatedUser(request, response);
  if (!decodedToken) return null;

  if (!(await hasSuperAdminAccess(decodedToken))) {
    sendError(response, 403, 'Super admin access is required.');
    return null;
  }

  return decodedToken;
};

const countEnabledSuperAdmins = async () => {
  const snapshot = await adminCollection().get();
  return snapshot.docs
    .map((document) => normalizeAdminRecord(document.id, document.data()))
    .filter((record) => record.enabled && record.role === SUPER_ADMIN_ROLE)
    .length;
};

const ensureTargetAdminRecord = async (uid) => {
  const record = await getAdminRecord(uid);
  if (!record) {
    const error = new Error('Admin account not found.');
    error.statusCode = 404;
    throw error;
  }

  return record;
};

const buildFunction = (methods, handler, options = {}) => onRequest(
  {
    ...ADMIN_FUNCTION_OPTIONS,
    ...options,
  },
  async (request, response) => {
    setCorsHeaders(request, response, [...methods, 'OPTIONS']);

    if (request.method === 'OPTIONS') {
      response.status(204).send('');
      return;
    }

    if (!methods.includes(request.method)) {
      sendError(response, 405, 'Method not allowed.');
      return;
    }

    try {
      await handler(request, response);
    } catch (error) {
      const statusCode = Number(error?.statusCode || 500);
      const message = error instanceof Error ? error.message : 'Request failed.';
      logger.error('Admin request failed', { message, error });
      sendError(response, statusCode, message);
    }
  }
);

exports.ocrSpaceProxy = onRequest(
  {
    ...ADMIN_FUNCTION_OPTIONS,
    secrets: [ocrSpaceApiKey],
  },
  async (request, response) => {
    setCorsHeaders(request, response, ['POST', 'OPTIONS']);

    if (!requireMethod(request, response, 'POST')) {
      return;
    }

    try {
      const decodedToken = await requireAuthenticatedUser(request, response);
      if (!decodedToken) {
        return;
      }

      if (!(await hasAdminAccess(decodedToken))) {
        sendError(response, 403, 'Only admin users can use the OCR proxy.');
        return;
      }

      const {
        imageDataUrl,
        language = 'auto',
        ocrEngine = '2',
        isOverlayRequired = true,
        scale = true,
        detectOrientation = true,
        isTable = true,
      } = parseJsonBody(request);
      if (typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image/')) {
        sendError(response, 400, 'A valid image data URL is required.');
        return;
      }

      if (imageDataUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
        sendError(response, 413, 'Image is too large to process.');
        return;
      }

      const upstreamBody = new URLSearchParams({
        base64Image: imageDataUrl,
        language,
        OCREngine: ['1', '2', '3'].includes(String(ocrEngine)) ? String(ocrEngine) : '2',
        isOverlayRequired: String(Boolean(isOverlayRequired) && String(ocrEngine) !== '3'),
        scale: String(Boolean(scale)),
        detectOrientation: String(Boolean(detectOrientation)),
        isTable: String(Boolean(isTable)),
      });

      const upstreamResponse = await fetch(OCR_SPACE_ENDPOINT, {
        method: 'POST',
        headers: {
          apikey: ocrSpaceApiKey.value(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: upstreamBody.toString(),
      });

      const upstreamText = await upstreamResponse.text();

      response.status(upstreamResponse.status);
      response.set('Content-Type', upstreamResponse.headers.get('content-type') || 'application/json');
      response.send(upstreamText);
    } catch (error) {
      logger.error('OCR proxy request failed', error);
      sendError(response, 500, 'OCR proxy request failed.');
    }
  }
);

exports.listAdmins = buildFunction(['GET'], async (request, response) => {
  const decodedToken = await requireSuperAdminUser(request, response);
  if (!decodedToken) return;

  const snapshot = await adminCollection().get();
  const admins = (await Promise.all(snapshot.docs
    .map(async (document) => {
      const baseRecord = normalizeAdminRecord(document.id, document.data());

      try {
        const authUser = await admin.auth().getUser(document.id);
        return {
          ...baseRecord,
          email: authUser.email || baseRecord.email,
          displayName: authUser.displayName || baseRecord.displayName,
          authDisabled: authUser.disabled,
        };
      } catch (error) {
        logger.warn('Failed to hydrate admin auth profile', {
          uid: document.id,
          error: error instanceof Error ? error.message : String(error),
        });
        return baseRecord;
      }
    })))
    .sort((first, second) => {
      if (first.role !== second.role) {
        return first.role === SUPER_ADMIN_ROLE ? -1 : 1;
      }

      const firstLabel = first.displayName || first.email;
      const secondLabel = second.displayName || second.email;
      return firstLabel.localeCompare(secondLabel);
    });

  response.status(200).json({
    admins,
    currentUserUid: decodedToken.uid,
  });
});

exports.createAdmin = buildFunction(['POST'], async (request, response) => {
  const decodedToken = await requireSuperAdminUser(request, response);
  if (!decodedToken) return;

  const { email, password, displayName = '', role } = parseJsonBody(request);
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const normalizedDisplayName = typeof displayName === 'string' ? displayName.trim() : '';
  const normalizedRole = normalizeAdminRole(role);

  if (!normalizedEmail) {
    sendError(response, 400, 'Email is required.');
    return;
  }

  if (typeof password !== 'string' || password.length < 6) {
    sendError(response, 400, 'Password must be at least 6 characters long.');
    return;
  }

  const now = new Date().toISOString();
  let createdUser = null;

  try {
    createdUser = await admin.auth().createUser({
      email: normalizedEmail,
      password,
      displayName: normalizedDisplayName || undefined,
      disabled: false,
    });

    const adminRecord = {
      email: normalizedEmail,
      displayName: normalizedDisplayName,
      enabled: true,
      authDisabled: false,
      role: normalizedRole,
      createdAt: now,
      updatedAt: now,
      createdBy: decodedToken.uid,
      updatedBy: decodedToken.uid,
    };

    await adminCollection().doc(createdUser.uid).set(adminRecord);
    await syncAdminClaims(createdUser.uid, adminRecord);
    await writeAdminAuditLog({
      action: 'create_admin',
      actorUid: decodedToken.uid,
      targetUid: createdUser.uid,
      details: {
        email: normalizedEmail,
        role: normalizedRole,
      },
    });

    response.status(201).json({
      admin: normalizeAdminRecord(createdUser.uid, adminRecord),
    });
  } catch (error) {
    if (createdUser) {
      await admin.auth().deleteUser(createdUser.uid).catch(() => null);
      await adminCollection().doc(createdUser.uid).delete().catch(() => null);
    }

    throw error;
  }
});

exports.updateAdminRole = buildFunction(['POST'], async (request, response) => {
  const decodedToken = await requireSuperAdminUser(request, response);
  if (!decodedToken) return;

  const { uid, role } = parseJsonBody(request);
  const targetUid = typeof uid === 'string' ? uid.trim() : '';
  const normalizedRole = normalizeAdminRole(role);

  if (!targetUid) {
    sendError(response, 400, 'Admin user ID is required.');
    return;
  }

  if (targetUid === decodedToken.uid) {
    sendError(response, 400, 'You cannot change your own admin role.');
    return;
  }

  const existingRecord = await ensureTargetAdminRecord(targetUid);
  if (existingRecord.role === SUPER_ADMIN_ROLE && normalizedRole !== SUPER_ADMIN_ROLE) {
    const enabledSuperAdminCount = await countEnabledSuperAdmins();
    if (enabledSuperAdminCount <= 1) {
      sendError(response, 400, 'At least one enabled super admin must remain.');
      return;
    }
  }

  const updatedRecord = {
    ...existingRecord,
    role: normalizedRole,
    updatedAt: new Date().toISOString(),
    updatedBy: decodedToken.uid,
  };

  await adminCollection().doc(targetUid).set(updatedRecord, { merge: true });
  await syncAdminClaims(targetUid, updatedRecord);
  await writeAdminAuditLog({
    action: 'update_admin_role',
    actorUid: decodedToken.uid,
    targetUid,
    details: {
      previousRole: existingRecord.role,
      nextRole: normalizedRole,
    },
  });

  response.status(200).json({
    admin: normalizeAdminRecord(targetUid, updatedRecord),
  });
});

exports.updateAdminProfile = buildFunction(['POST'], async (request, response) => {
  const decodedToken = await requireSuperAdminUser(request, response);
  if (!decodedToken) return;

  const { uid, email, displayName = '' } = parseJsonBody(request);
  const targetUid = typeof uid === 'string' ? uid.trim() : '';
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const normalizedDisplayName = typeof displayName === 'string' ? displayName.trim() : '';

  if (!targetUid) {
    sendError(response, 400, 'Admin user ID is required.');
    return;
  }

  if (!normalizedEmail) {
    sendError(response, 400, 'Email is required.');
    return;
  }

  const existingRecord = await ensureTargetAdminRecord(targetUid);

  await admin.auth().updateUser(targetUid, {
    email: normalizedEmail,
    displayName: normalizedDisplayName || undefined,
  });

  const updatedRecord = {
    ...existingRecord,
    email: normalizedEmail,
    displayName: normalizedDisplayName,
    updatedAt: new Date().toISOString(),
    updatedBy: decodedToken.uid,
  };

  await adminCollection().doc(targetUid).set(updatedRecord, { merge: true });
  await writeAdminAuditLog({
    action: 'update_admin_profile',
    actorUid: decodedToken.uid,
    targetUid,
    details: {
      previousEmail: existingRecord.email,
      nextEmail: normalizedEmail,
      previousDisplayName: existingRecord.displayName,
      nextDisplayName: normalizedDisplayName,
    },
  });

  response.status(200).json({
    admin: normalizeAdminRecord(targetUid, updatedRecord),
  });
});

exports.disableAdmin = buildFunction(['POST'], async (request, response) => {
  const decodedToken = await requireSuperAdminUser(request, response);
  if (!decodedToken) return;

  const { uid, disabled } = parseJsonBody(request);
  const targetUid = typeof uid === 'string' ? uid.trim() : '';
  const shouldDisable = disabled !== false;

  if (!targetUid) {
    sendError(response, 400, 'Admin user ID is required.');
    return;
  }

  if (targetUid === decodedToken.uid) {
    sendError(response, 400, 'You cannot change your own enabled status.');
    return;
  }

  const existingRecord = await ensureTargetAdminRecord(targetUid);
  if (shouldDisable && existingRecord.role === SUPER_ADMIN_ROLE) {
    const enabledSuperAdminCount = await countEnabledSuperAdmins();
    if (enabledSuperAdminCount <= 1) {
      sendError(response, 400, 'At least one enabled super admin must remain.');
      return;
    }
  }

  await admin.auth().updateUser(targetUid, { disabled: shouldDisable });

  const updatedRecord = {
    ...existingRecord,
    enabled: !shouldDisable,
    authDisabled: shouldDisable,
    updatedAt: new Date().toISOString(),
    updatedBy: decodedToken.uid,
  };

  await adminCollection().doc(targetUid).set(updatedRecord, { merge: true });
  await syncAdminClaims(targetUid, updatedRecord);
  await writeAdminAuditLog({
    action: shouldDisable ? 'disable_admin' : 'enable_admin',
    actorUid: decodedToken.uid,
    targetUid,
    details: {
      disabled: shouldDisable,
    },
  });

  response.status(200).json({
    admin: normalizeAdminRecord(targetUid, updatedRecord),
  });
});

exports.deleteAdmin = buildFunction(['POST'], async (request, response) => {
  const decodedToken = await requireSuperAdminUser(request, response);
  if (!decodedToken) return;

  const { uid } = parseJsonBody(request);
  const targetUid = typeof uid === 'string' ? uid.trim() : '';

  if (!targetUid) {
    sendError(response, 400, 'Admin user ID is required.');
    return;
  }

  if (targetUid === decodedToken.uid) {
    sendError(response, 400, 'You cannot delete your own admin account.');
    return;
  }

  const existingRecord = await ensureTargetAdminRecord(targetUid);
  if (existingRecord.role === SUPER_ADMIN_ROLE) {
    const enabledSuperAdminCount = await countEnabledSuperAdmins();
    if (enabledSuperAdminCount <= 1) {
      sendError(response, 400, 'At least one enabled super admin must remain.');
      return;
    }
  }

  await admin.auth().deleteUser(targetUid);
  await adminCollection().doc(targetUid).delete();
  await writeAdminAuditLog({
    action: 'delete_admin',
    actorUid: decodedToken.uid,
    targetUid,
    details: {
      email: existingRecord.email,
      role: existingRecord.role,
    },
  });

  response.status(200).json({ success: true });
});

exports.syncMarketplaceExchangeRate = onSchedule(
  {
    region: REGION,
    schedule: '5 0 * * *',
    timeZone: SCHEDULER_TIME_ZONE,
    timeoutSeconds: 60,
    memory: '256MiB',
    retryCount: 0,
  },
  async () => {
    const fetchedAt = new Date().toISOString();
    const exchangeRate = await fetchUsdPhpExchangeRate();

    await marketplacePricingDocument().set({
      phpPerUsd: exchangeRate.phpPerUsd,
      source: MARKETPLACE_RATE_SOURCE,
      sourceDate: exchangeRate.sourceDate,
      fetchedAt,
      updatedAt: fetchedAt,
    }, { merge: true });

    logger.info('Marketplace exchange rate synced.', {
      phpPerUsd: exchangeRate.phpPerUsd,
      sourceDate: exchangeRate.sourceDate,
    });
  }
);

const NEXT_MARKET_API_BASE = 'https://api.nextmarket.games/l9asia';
const MARKETPLACE_C2C_ENDPOINT = `${NEXT_MARKET_API_BASE}/v1/sale/c2c`;
const MARKETPLACE_KEYWORD_SUGGESTION_ENDPOINT = `${NEXT_MARKET_API_BASE}/v1/sale/c2c/keyword/suggestion`;
const MAX_C2C_PAGES = 15;

const normalizeSaleName = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

const isNameMatch = (saleName, keyword) => {
  const normalized = normalizeSaleName(saleName);
  const normalizedKeyword = normalizeSaleName(keyword);
  if (normalized === normalizedKeyword) return true;
  if (normalized.includes(normalizedKeyword)) return true;
  if (normalizedKeyword.includes(normalized)) return true;
  return false;
};

const getAppraiseStatus = (name) => {
  const normalized = name.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  if (/not\s+apprai/.test(normalized)) return 'not-appraised';
  if (/apprai/.test(normalized)) return 'appraised';
  return null;
};

const findBestNextMarketMatch = async (items, keyword, desiredStatus) => {
  if (!items || items.length === 0) return null;

  items.sort((a, b) => a.cryptoPriceInfo.price - b.cryptoPriceInfo.price);

  let matches = items.filter((sale) => isNameMatch(sale.item.name, keyword));

  matches = matches.filter((sale) => {
    const status = getAppraiseStatus(sale.item.name);
    return status === null || status === desiredStatus;
  });

  if (matches.length === 0) return null;

  const best = matches[0];

  let fiatPrice = best.fiatPriceInfo.price;
  let fiatCurrency = best.fiatPriceInfo.currencyType;

  try {
    const estimateUrl = `${NEXT_MARKET_API_BASE}/v1/sale/c2c/${best.id}/price/estimate`;
    const params = new URLSearchParams({
      price: String(best.cryptoPriceInfo.price),
      fromCurrencyType: 'USDT',
      toCurrencyType: 'PHP',
    });
    const estimateResponse = await fetch(`${estimateUrl}?${params}`, {
      headers: { Accept: 'application/json' },
    });
    if (estimateResponse.ok) {
      const estimate = await estimateResponse.json();
      if (estimate?.toSettlementPrice?.currencyType === 'PHP') {
        fiatPrice = estimate.toSettlementPrice.totalPrice;
        fiatCurrency = 'PHP';
      }
    }
  } catch {
    // fallback to original fiatPrice/fiatCurrency from API
  }

  return {
    matchedSaleName: best.item.name,
    saleId: best.id,
    usdPrice: best.cryptoPriceInfo.price,
    usdtPrice: best.cryptoPriceInfo.price,
    fiatPrice,
    fiatCurrency,
    quantity: best.displayAmount,
    isExactMatch: true,
  };
};

const fetchNextMarketPage = async (page, keyword, presetId, subPresetId, refPresetId) => {
  const presetIdList = [];
  const primaryId = subPresetId ?? presetId;
  if (primaryId != null) presetIdList.push(primaryId);
  if (refPresetId != null) presetIdList.push(refPresetId);

  const body = {
    sort: 'PRICE_ASC',
    viewType: 'fiat',
    keyword,
    realmCode: 'OLD_REALM',
  };

  if (presetIdList.length > 0) body.presetIdList = presetIdList;

  const upstreamResponse = await fetch(`${MARKETPLACE_C2C_ENDPOINT}?page=${page}&realmCode=OLD_REALM`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!upstreamResponse.ok) {
    const text = await upstreamResponse.text();
    throw new Error(`NEXT Market API returned ${upstreamResponse.status}: ${text}`);
  }

  return upstreamResponse.json();
};

exports.fetchNextMarketPrices = onRequest(
  {
    region: REGION,
    timeoutSeconds: 60,
    memory: '256MiB',
    cors: false,
  },
  async (request, response) => {
    setCorsHeaders(request, response, ['GET', 'OPTIONS']);

    if (!requireMethod(request, response, 'GET')) {
      return;
    }

    const searchUrl = typeof request.query.searchUrl === 'string' ? request.query.searchUrl.trim() : '';
    let keyword, presetId, subPresetId, refPresetId;

    let isAppraised = false;

    if (searchUrl) {
      try {
        const parsed = new URL(searchUrl);
        keyword = parsed.searchParams.get('keyword') || '';
        isAppraised = parsed.searchParams.get('isAppraised') === 'true';
        presetId = parsed.searchParams.get('presetId') ? Number(parsed.searchParams.get('presetId')) : null;
        subPresetId = parsed.searchParams.get('subPresetId') ? Number(parsed.searchParams.get('subPresetId')) : null;
        refPresetId = parsed.searchParams.get('refPresetId') ? Number(parsed.searchParams.get('refPresetId')) : null;
      } catch {
        sendError(response, 400, 'Invalid search URL.');
        return;
      }
    } else {
      keyword = typeof request.query.keyword === 'string' ? request.query.keyword.trim() : '';
      presetId = request.query.presetId ? Number(request.query.presetId) : null;
      subPresetId = request.query.subPresetId ? Number(request.query.subPresetId) : null;
      refPresetId = request.query.refPresetId ? Number(request.query.refPresetId) : null;
    }

    if (!keyword) {
      sendError(response, 400, 'Query parameter "keyword" is required.');
      return;
    }

    try {
      let result = null;

      const desiredStatus = isAppraised ? 'appraised' : 'not-appraised';

      const searchAttempts = [
        { label: 'full presets', presetId, subPresetId, refPresetId },
        { label: 'without subPresetId', presetId, subPresetId: null, refPresetId },
        { label: 'without presets', presetId: null, subPresetId: null, refPresetId: null },
      ];

      const MAX_PAGES = MAX_C2C_PAGES;

      for (const attempt of searchAttempts) {
        let page = 0;
        const attemptItems = [];

        for (; page < MAX_PAGES; page++) {
          const payload = await fetchNextMarketPage(page, keyword, attempt.presetId, attempt.subPresetId, attempt.refPresetId);
          const content = payload.content || [];

          attemptItems.push(...content);

          if (payload.last || content.length === 0) break;
        }

        const match = await findBestNextMarketMatch(attemptItems, keyword, desiredStatus);
        if (match) {
          result = match;
          break;
        }
      }

      if (!result && /\((?:Not\s+)?Apprais(?:e|ed)\)/i.test(keyword)) {
        const baseFallbackKeyword = keyword.replace(/\s*\((?:Not\s+)?Apprais(?:e|ed)\)\s*$/i, '').trim();
        if (baseFallbackKeyword !== keyword) {
          for (const attempt of searchAttempts) {
            let page = 0;
            const attemptItems = [];

            for (; page < MAX_PAGES; page++) {
              const payload = await fetchNextMarketPage(page, baseFallbackKeyword, attempt.presetId, attempt.subPresetId, attempt.refPresetId);
              const content = payload.content || [];

              attemptItems.push(...content);

              if (payload.last || content.length === 0) break;
            }

            const match = await findBestNextMarketMatch(attemptItems, baseFallbackKeyword, desiredStatus);
            if (match) {
              result = match;
              break;
            }
          }
        }
      }

      response.status(200).json(result);
    } catch (error) {
      logger.error('Failed to fetch NEXT Market prices', {
        keyword,
        presetId,
        subPresetId,
        refPresetId,
        error: error instanceof Error ? error.message : String(error),
      });
      sendError(response, 502, 'Failed to fetch prices from NEXT Market.');
    }
  }
);
