# Engagement Party Evite

A single-page engagement party invitation with an RSVP system. Hosted on GitHub Pages, backed by Google Firebase Firestore.

## Setup

### 1. Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/) and create a new project
2. Enable **Cloud Firestore** (start in test mode)
3. Go to Project Settings > General > Your apps > Add a **Web app**
4. Copy the Firebase config object

### 2. Configure

1. Paste your Firebase config into `public/js/firebase-config.js`
2. Update event details (names, date, time, venue) in `public/index.html`
3. Add your couple photo to `public/images/` and update the `src` in `index.html`

### 3. Install Dependencies

```bash
npm install
```

### 4. Seed Guest List

1. Edit `seed/guests.json` with your guest list, groups, and aliases
2. Place your Firebase service account key at `seed/serviceAccountKey.json`
   - Firebase Console > Project Settings > Service Accounts > Generate New Private Key
3. Run the seed script:

```bash
npm run seed
```

### 5. Deploy to GitHub Pages

1. Create a GitHub repo and push this project
2. Go to Settings > Pages
3. Set source to **GitHub Actions** or **Deploy from a branch** (select `main`, folder `/public`)
4. Your site will be live at `https://yourusername.github.io/repo-name/`

### 6. Deploy Firestore Rules (optional)

If you want to push the security rules to Firebase:

```bash
firebase login
firebase deploy --only firestore:rules
```

### 7. Admin Page

Navigate to `https://your-site.github.io/admin.html` to view RSVPs and manage guests. The admin page is password-protected (default password: `engagement2026` — change this in the admin config).

## Local Development

```bash
npm run dev
```

## Guest List Format

See `seed/guests.json` for the format. Each group contains members who can RSVP together. Aliases enable fuzzy name matching (nicknames, shortened names, etc.).
