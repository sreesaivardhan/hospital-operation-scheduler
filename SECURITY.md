# Security Notice

The Firebase service account key was accidentally committed to this repository and has been rotated.

**Never commit `serviceAccountKey.json`.**  
Add it to `.gitignore` before generating or placing any key file in the project directory.

For local admin scripts (e.g., `scripts/create-test-users.js`), obtain the service account key  
from the Firebase Console and keep it **only on your local machine** — never push it to version control.

## What was done

- `serviceAccountKey.json` has been removed from the working directory.
- `serviceAccountKey.json` is listed in `.gitignore`.
- The key has been rotated in the GCP console (revoked and re-issued).
- Git history cleanup should be performed separately using `git filter-repo` or BFG Repo Cleaner.

## Recommended `.gitignore` entries for Firebase projects

```
serviceAccountKey.json
*.json.key
.env
.env.local
firebase-debug.log
.firebase/
```
