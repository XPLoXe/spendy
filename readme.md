# Spendy - Daily Expense Tracker

A simple and minimalistic Nuxt 4 application for tracking daily expenses like a digital wallet.

## Features

- 🔐 **Google Authentication** - Secure login with Google
- 💰 **Wallet Management** - Set and track your wallet balance
- 📊 **Expense Tracking** - Add expenses with categories
- 🏷️ **Category Management** - Create and manage custom categories
- 📈 **Analytics** - Monthly spending insights and daily budget calculations
- 🔍 **Search & Filter** - Find expenses by name or category
- 📱 **Responsive Design** - Works on desktop and mobile

## Tech Stack

- **Framework**: Nuxt 4
- **Styling**: TailwindCSS
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth
- **Language**: TypeScript

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Firebase project

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd spendy
```

2. Install dependencies
```bash
npm install
```

3. Set up Firebase
   - Create a new Firebase project at [Firebase Console](https://console.firebase.google.com)
   - Enable Authentication with Google provider
   - Create a Firestore database
   - Get your Firebase configuration

4. Configure environment variables
```bash
cp env.example .env
```

Edit `.env` with your Firebase configuration:
```
FIREBASE_API_KEY=your_api_key_here
FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id
```

5. Start the development server
```bash
npm run dev
```

Visit `http://localhost:3000` to see the application.

## Usage

1. **Sign in** with your Google account
2. **Set your wallet balance** by clicking "Edit" on the wallet card
3. **Create categories** for your expenses (food, transport, entertainment, etc.)
4. **Add expenses** with amount, description, and category
5. **Track your spending** with monthly analytics and daily budget calculations
6. **Search and filter** your expenses by name or category

## Project Structure

```
spendy/
├── assets/css/           # Global styles
├── components/           # Vue components
│   ├── AuthButton.vue
│   ├── WalletCard.vue
│   ├── CategoryManager.vue
│   ├── ExpenseForm.vue
│   └── ExpenseList.vue
├── composables/          # Vue composables
│   ├── useAuth.ts
│   └── useFirestore.ts
├── plugins/              # Nuxt plugins
│   └── firebase.client.ts
├── types/                # TypeScript types
│   └── index.ts
└── app.vue              # Main application
```

## Features in Detail

### Wallet Management
- Set your initial wallet balance
- View current balance and remaining budget
- Track monthly spending
- Calculate daily budget based on remaining days

### Category System
- Create unlimited custom categories
- Color-coded categories for visual organization
- Easy category management with delete functionality

### Expense Tracking
- Add expenses with amount, description, and category
- Real-time balance updates
- Timestamp tracking for all expenses

### Analytics
- Monthly spending totals
- Daily budget calculations
- Remaining balance tracking
- Expense history with search and filtering

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
