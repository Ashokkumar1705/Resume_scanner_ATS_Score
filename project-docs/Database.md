# Database Schema (Firestore)

## `users` Collection
- `uid`: string (Document ID)
- `email`: string
- `displayName`: string
- `photoURL`: string
- `createdAt`: timestamp

## `resumes` Collection
- `id`: string (Document ID)
- `userId`: string (Reference to users.uid)
- `content`: string (The extracted resume text)
- `score`: number
- `analysis`: map
  - `summary`: string
  - `strengths`: array<string>
  - `weaknesses`: array<string>
  - `suggestions`: array<string>
- `createdAt`: timestamp
