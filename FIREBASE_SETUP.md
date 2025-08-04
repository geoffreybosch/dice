# Firebase Configuration Setup

This project uses GitHub Actions secrets to securely manage Firebase configuration for deployment to GitHub Pages.

## Local Development Setup

1. Copy the template configuration file:
   ```bash
   cp firebase-config.template.json firebase-config.json
   ```

2. Edit `firebase-config.json` with your Firebase project details:
   - Get these values from your Firebase Console → Project Settings → General tab
   - The file is gitignored, so your credentials stay local

## GitHub Pages Deployment Setup

To deploy this project to GitHub Pages with Firebase integration, you need to add the following secrets to your GitHub repository:

### Required Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions, then add these secrets:

| Secret Name | Description | Example Value |
|-------------|-------------|---------------|
| `FIREBASE_API_KEY` | Your Firebase API Key | `xxx` |
| `FIREBASE_AUTH_DOMAIN` | Your Firebase Auth Domain | `your-project.firebaseapp.com` |
| `FIREBASE_DATABASE_URL` | Your Firebase Realtime Database URL | `https://your-project-default-rtdb.firebaseio.com` |
| `FIREBASE_PROJECT_ID` | Your Firebase Project ID | `your-project-id` |
| `FIREBASE_STORAGE_BUCKET` | Your Firebase Storage Bucket | `your-project.firebasestorage.app` |
| `FIREBASE_MESSAGING_SENDER_ID` | Your Firebase Messaging Sender ID | `123456789012` |
| `FIREBASE_APP_ID` | Your Firebase App ID | `1:123456789012:xxx:abcdef123456` |
| `FIREBASE_MEASUREMENT_ID` | Your Google Analytics Measurement ID | `G-XXXXXXXXXX` |

### How to Find These Values

1. Go to your [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click the gear icon → Project settings
4. Scroll down to "Your apps" section
5. Click on your web app or create one if you haven't
6. You'll see all the config values in the "Firebase SDK snippet" section

### Deployment

Once you've added all the secrets:

1. Push your code to the `main` branch
2. GitHub Actions will automatically:
   - Create the `firebase-config.json` file using your secrets
   - Deploy your site to GitHub Pages
3. Your site will be available at `https://yourusername.github.io/repositoryname`

## Security Notes

- ✅ Firebase config is never stored in your repository
- ✅ Secrets are encrypted and only accessible during deployment
- ✅ Local development uses a separate config file
- ✅ The template file helps other developers set up their own environment

## Troubleshooting

If you see "Configuration Error" on your deployed site:
1. Check that all 8 secrets are properly set in your GitHub repository
2. Verify the secret names match exactly (case-sensitive)
3. Ensure your Firebase project is properly configured
4. Check the GitHub Actions logs for any deployment errors
