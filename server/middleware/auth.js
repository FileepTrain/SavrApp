import admin from "firebase-admin";

/**
 * Middleware to verify Firebase ID token
 * Extracts the token from Authorization header and verifies it
 * Attaches the decoded user info to req.user
 */
export const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "No token provided",
      code: "UNAUTHORIZED",
    });
  }

  const idToken = authHeader.split("Bearer ")[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      username: decodedToken.name || decodedToken.displayName,
    };
    next();
  } catch (error) {
    console.error("Token verification failed:", error);
    return res.status(401).json({
      error: "Invalid or expired token",
      code: "INVALID_TOKEN",
    });
  }
};
