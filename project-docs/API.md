# API Specification

## Internal API (Express)

### `POST /api/analyze`
- **Description**: Sends resume text to Gemini for analysis.
- **Request Body**: `{ text: string }`
- **Response**: `{ score: number, analysis: object }`

## Client-Side (Firebase SDK)
- `auth.signInWithPopup()`: Authentication.
- `firestore.addDoc()`: Saving analysis results.
- `firestore.getDocs()`: Retrieving user history.
