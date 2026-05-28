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

Backend:

```bash
cd backend
npm install
npm run dev
```

Frontend:

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
