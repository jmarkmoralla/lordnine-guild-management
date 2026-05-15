const admin = require('firebase-admin');
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');

admin.initializeApp();

const ocrSpaceApiKey = defineSecret('OCR_SPACE_API_KEY');
const OCR_SPACE_ENDPOINT = 'https://api.ocr.space/parse/image';
const MAX_IMAGE_DATA_URL_LENGTH = 10 * 1024 * 1024;

const setCorsHeaders = (request, response) => {
  const origin = request.get('origin');
  if (origin) {
    response.set('Access-Control-Allow-Origin', origin);
    response.set('Vary', 'Origin');
  }

  response.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  response.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
};

const getBearerToken = (request) => {
  const authorizationHeader = request.get('authorization') || '';
  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
};

const hasAdminAccess = async (decodedToken) => {
  const adminDoc = await admin.firestore().collection('admins').doc(decodedToken.uid).get();
  return adminDoc.exists && adminDoc.data()?.enabled === true;
};

exports.ocrSpaceProxy = onRequest(
  {
    region: 'asia-southeast1',
    timeoutSeconds: 60,
    memory: '256MiB',
    cors: false,
    secrets: [ocrSpaceApiKey],
  },
  async (request, response) => {
    setCorsHeaders(request, response);

    if (request.method === 'OPTIONS') {
      response.status(204).send('');
      return;
    }

    if (request.method !== 'POST') {
      response.status(405).json({ error: 'Method not allowed.' });
      return;
    }

    try {
      const idToken = getBearerToken(request);
      if (!idToken) {
        response.status(401).json({ error: 'Missing authorization token.' });
        return;
      }

      const decodedToken = await admin.auth().verifyIdToken(idToken);
      if (!(await hasAdminAccess(decodedToken))) {
        response.status(403).json({ error: 'Only admin users can use the OCR proxy.' });
        return;
      }

      const { imageDataUrl, language = 'eng' } = request.body || {};
      if (typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image/')) {
        response.status(400).json({ error: 'A valid image data URL is required.' });
        return;
      }

      if (imageDataUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
        response.status(413).json({ error: 'Image is too large to process.' });
        return;
      }

      const upstreamBody = new URLSearchParams({
        base64Image: imageDataUrl,
        language,
        OCREngine: '2',
        isOverlayRequired: 'false',
        scale: 'true',
        detectOrientation: 'true',
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
      response.status(500).json({ error: 'OCR proxy request failed.' });
    }
  }
);
