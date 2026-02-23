#!/usr/bin/env node

/**
 * Seed (or update) the Firestore `guests` collection from guests.json.
 *
 * Usage:
 *   1. Place your Firebase service-account key at seed/serviceAccountKey.json
 *   2. npm run seed
 *
 * The script upserts: if a guest with the same name + groupId already exists,
 * it updates aliases; otherwise it creates a new document.
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'serviceAccountKey.json');
const GUESTS_PATH = path.join(__dirname, 'guests.json');

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error(
    'Missing service account key.\n' +
    'Download it from Firebase Console → Project Settings → Service Accounts → Generate New Private Key\n' +
    'Save it as: seed/serviceAccountKey.json'
  );
  process.exit(1);
}

const serviceAccount = require(SERVICE_ACCOUNT_PATH);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function seed() {
  const data = JSON.parse(fs.readFileSync(GUESTS_PATH, 'utf-8'));
  const existingSnap = await db.collection('guests').get();
  const existingByKey = new Map();
  existingSnap.forEach(doc => {
    const d = doc.data();
    existingByKey.set(`${d.name}::${d.groupId}`, doc.id);
  });

  const batch = db.batch();
  let created = 0;
  let updated = 0;

  for (const group of data.groups) {
    for (const member of group.members) {
      const key = `${member.name}::${group.groupId}`;
      const guestData = {
        name: member.name,
        aliases: member.aliases || [],
        groupId: group.groupId,
      };

      if (existingByKey.has(key)) {
        const docRef = db.collection('guests').doc(existingByKey.get(key));
        batch.update(docRef, { aliases: guestData.aliases });
        updated++;
      } else {
        const docRef = db.collection('guests').doc();
        batch.set(docRef, {
          ...guestData,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        created++;
      }
    }
  }

  await batch.commit();
  console.log(`Seed complete: ${created} created, ${updated} updated.`);
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
