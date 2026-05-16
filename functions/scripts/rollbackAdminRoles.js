const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const shouldApply = args.includes('--apply');

const getArgValue = (flagName) => {
  const matchingArg = args.find((arg) => arg.startsWith(`${flagName}=`));
  return matchingArg ? matchingArg.slice(flagName.length + 1) : '';
};

const backupFileArg = getArgValue('--backup-file');

if (!backupFileArg) {
  console.error('Missing required argument: --backup-file=PATH_TO_BACKUP_JSON');
  process.exit(1);
}

const backupFilePath = path.resolve(process.cwd(), backupFileArg);

if (!fs.existsSync(backupFilePath)) {
  console.error(`Backup file not found: ${backupFilePath}`);
  process.exit(1);
}

const backupPayload = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
const entries = Array.isArray(backupPayload.entries) ? backupPayload.entries : [];

if (entries.length === 0) {
  console.error('The backup file does not contain any admin role entries.');
  process.exit(1);
}

admin.initializeApp();

const db = admin.firestore();

const summarizeRollback = (entry) => {
  const previousLabel = entry.previousRole || '(missing)';
  const nextLabel = entry.nextRole || '(unknown)';
  return `- ${entry.uid}: ${nextLabel} -> ${previousLabel}`;
};

const main = async () => {
  console.log(shouldApply ? 'Applying admin role rollback:' : 'Dry run for admin role rollback:');
  entries.forEach((entry) => console.log(summarizeRollback(entry)));

  if (!shouldApply) {
    console.log('No changes written. Re-run with --apply to restore the previous roles.');
    return;
  }

  let batch = db.batch();
  let batchSize = 0;

  for (const entry of entries) {
    const adminRef = db.collection('admins').doc(entry.uid);
    const data = {
      updatedAt: new Date().toISOString(),
      updatedBy: 'rollback-script',
    };

    if (entry.previousRole) {
      data.role = entry.previousRole;
    } else {
      data.role = admin.firestore.FieldValue.delete();
    }

    batch.set(adminRef, data, { merge: true });
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

  console.log(`Rolled back ${entries.length} admin documents.`);
};

main().catch((error) => {
  console.error('Admin role rollback failed.');
  console.error(error);
  process.exit(1);
});