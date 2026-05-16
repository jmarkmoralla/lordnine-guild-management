const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const ADMIN_ROLE = 'admin';
const SUPER_ADMIN_ROLE = 'super_admin';

const args = process.argv.slice(2);
const shouldApply = args.includes('--apply');

const getArgValue = (flagName) => {
  const matchingArg = args.find((arg) => arg.startsWith(`${flagName}=`));
  return matchingArg ? matchingArg.slice(flagName.length + 1) : '';
};

const normalizeUidList = (value) => new Set(
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
);

const superAdminUids = normalizeUidList(getArgValue('--super-admin-uids'));
const backupFileArg = getArgValue('--backup-file');

if (superAdminUids.size === 0) {
  console.error('Missing required argument: --super-admin-uids=UID_1,UID_2');
  process.exit(1);
}

admin.initializeApp();

const db = admin.firestore();
const backupDirectory = path.resolve(__dirname, '../admin-role-backups');

const buildDefaultBackupPath = () => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(backupDirectory, `admin-role-backup-${timestamp}.json`);
};

const resolveBackupPath = () => {
  if (backupFileArg) {
    return path.resolve(process.cwd(), backupFileArg);
  }

  return buildDefaultBackupPath();
};

const ensureDirectoryForFile = (filePath) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
};

const summarizeChange = (uid, previousRole, nextRole, enabled) => {
  const previousLabel = previousRole || '(missing)';
  const enabledLabel = enabled ? 'enabled' : 'disabled';
  return `- ${uid}: ${previousLabel} -> ${nextRole} [${enabledLabel}]`;
};

const main = async () => {
  const snapshot = await db.collection('admins').get();
  if (snapshot.empty) {
    console.log('No admin documents found.');
    return;
  }

  const writes = [];
  const summaries = [];
  const backupEntries = [];

  snapshot.forEach((document) => {
    const data = document.data() || {};
    const enabled = data.enabled === true;
    const nextRole = superAdminUids.has(document.id) ? SUPER_ADMIN_ROLE : ADMIN_ROLE;
    const previousRole = typeof data.role === 'string' ? data.role : '';

    summaries.push(summarizeChange(document.id, previousRole, nextRole, enabled));
    backupEntries.push({
      uid: document.id,
      previousRole,
      nextRole,
      enabled,
      previousUpdatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
      previousUpdatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : '',
    });

    writes.push({
      ref: document.ref,
      data: {
        role: nextRole,
        updatedAt: new Date().toISOString(),
        updatedBy: 'migration-script',
      },
    });
  });

  console.log(shouldApply ? 'Applying admin role migration:' : 'Dry run for admin role migration:');
  summaries.forEach((summary) => console.log(summary));

  if (!shouldApply) {
    console.log('No changes written. Re-run with --apply to persist these role updates.');
    return;
  }

  const backupPath = resolveBackupPath();
  ensureDirectoryForFile(backupPath);
  fs.writeFileSync(backupPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    superAdminUids: Array.from(superAdminUids),
    entries: backupEntries,
  }, null, 2));
  console.log(`Backup written to ${backupPath}`);

  let batch = db.batch();
  let batchSize = 0;

  for (const write of writes) {
    batch.set(write.ref, write.data, { merge: true });
    batchSize += 1;

    if (batchSize === 400) {
      await batch.commit();
      batch = db.batch();
      batchSize = 0;
    }
  }

  if (batchSize > 0) {
    await batch.commit();
  }

  console.log(`Updated ${writes.length} admin documents.`);
};

main().catch((error) => {
  console.error('Admin role migration failed.');
  console.error(error);
  process.exit(1);
});