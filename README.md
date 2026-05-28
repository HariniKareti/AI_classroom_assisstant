# Automatic Question Generation System

MERN application for generating questions from uploaded PDFs using a simple keyword-based RAG pipeline and JWT authentication.

## Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: MongoDB Atlas
- AI: Google Gemini API

## Features

- Basic signup with `name`, `email`, and `password`
- Basic login with `email` and `password`
- JWT authentication
- Teacher-style PDF upload flow after login
- Backend PDF text extraction
- Extracted text stored in MongoDB
- Text chunking and case-insensitive keyword filtering
- Top 3 to 5 relevant chunks sent to Gemini
- Exactly 3 clear, non-duplicate questions when content is sufficient
- Questions generated only from matched PDF content

## Run

From the repository root:

```bash
npm run chroma
npm run backend:dev
npm run frontend:dev
```

If port `8000` is already in use, start Chroma on another port and point the backend to it:

```bash
CHROMA_PORT=8001 npm run chroma
# then update CHROMA_URL in backend/.env to http://localhost:8001
```

If you prefer to run commands directly inside each app folder:

```bash
cd backend
cp .env.example .env
npm install
npm run chroma
npm run dev
```

```bash
cd frontend
npm install
npm run dev
```

## Required Backend Env

- `MONGODB_URI`
- `JWT_SECRET`
- `GEMINI_API_KEY`
- `GEMINI_TEXT_MODEL`
- `MAX_CONTEXT_CHUNKS`
- `CHROMA_URL` (defaults to `http://localhost:8000`)

Create the backend environment file from `.env.example` and replace the placeholder MongoDB connection string before starting the server.

## API Summary

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/lecture`
- `POST /api/lecture/upload`
- `GET /api/questions`
- `POST /api/questions/generate`

## Flow

1. Upload a PDF.
2. Backend extracts PDF text and stores it in MongoDB.
3. Enter comma-separated keywords.
4. Backend filters chunks using case-insensitive keyword matching.
5. Top matched chunks are passed to Gemini.
6. Gemini returns 3 questions with answers, based only on the provided content.
