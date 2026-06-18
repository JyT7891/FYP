// React hooks for state, side effects, and memoized functions
import { useState, useEffect, useCallback } from "react";
// Router hooks for navigation and URL query parameter handling
import { useNavigate, useSearchParams } from "react-router-dom";

// Main email verification page component handling token validation and status display
export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  // Verification status state (verifying, success, error)
  const [status, setStatus] = useState("verifying");
  // Verification result message state
  const [message, setMessage] = useState("");

  // Send verification request to backend API using token
  const verifyEmail = useCallback(
    async (token) => {
      // API request to verify email token
      try {
        const response = await fetch(
          `http://127.0.0.1:8000/api/auth/verify-email?token=${token}`,
        );
        const data = await response.json();

        // Handle successful email verification
        if (response.ok) {
          // Set UI state to success
          setStatus("success");
          setMessage("Email verified successfully!");
          // Store that email is verified in localStorage
          localStorage.setItem("email_verified", "true");
          // Redirect to dashboard after 3 seconds
          setTimeout(() => navigate("/dashboard", { replace: true }), 3000);
        } else {
          // Set UI state to error
          setStatus("error");
          // Set backend error message or fallback message
          setMessage(
            data.detail || "Verification failed. The link may have expired.",
          );
        }
      } catch (err) {
        console.error("Verification error:", err);
        // Set UI state to error
        setStatus("error");
        setMessage(
          "Connection error. Please check your internet connection and try again.",
        );
      }
    },
    [navigate],
  );

  // Extract token from URL and trigger verification on page load
  useEffect(() => {
    // Get verification token from URL parameters
    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      setMessage(
        "Invalid verification link. Please check your email for the correct link.",
      );
      return;
    }

    verifyEmail(token);
  }, [searchParams, verifyEmail]);

  // Retry email verification request
  const handleRetry = () => {
    const token = searchParams.get("token");
    if (token) {
      setStatus("verifying");
      setMessage("");
      verifyEmail(token);
    }
  };

  // Render email verification UI
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020c1b] text-white">
      <div className="text-center max-w-md mx-auto px-4">
        {/* Loading state UI while verifying email */}
        {status === "verifying" && (
          <>
            <div className="w-12 h-12 border-4 border-teal-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-300">Verifying your email...</p>
            <p className="text-xs text-gray-500 mt-2">
              Please wait while we confirm your email address.
            </p>
          </>
        )}

        {/* Success state UI after email verification */}
        {status === "success" && (
          <>
            <div className="w-16 h-16 bg-teal-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <div className="text-4xl text-teal-400">✓</div>
            </div>
            <p className="text-teal-400 font-semibold">{message}</p>
            <p className="text-gray-400 text-sm mt-2">
              Redirecting you to the dashboard...
            </p>
            <div className="mt-4 w-16 h-1 bg-teal-500/30 rounded-full overflow-hidden mx-auto">
              <div className="w-full h-full bg-teal-400 rounded-full animate-pulse"></div>
            </div>
          </>
        )}

        {/* Error state UI when verification fails */}
        {status === "error" && (
          <>
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <div className="text-4xl text-red-400">✗</div>
            </div>
            <p className="text-red-400 font-semibold">{message}</p>
            <div className="mt-6 flex gap-3 justify-center">
              {/* Retry verification button */}
              <button
                onClick={handleRetry}
                className="px-4 py-2 rounded-lg bg-teal-500/10 border border-teal-500/40 text-teal-400 text-sm hover:bg-teal-500/20 transition"
              >
                Try Again
              </button>
              {/* Navigate back to login page button */}
              <button
                onClick={() => navigate("/")}
                className="px-4 py-2 rounded-lg border border-gray-600 text-gray-400 text-sm hover:bg-white/5 transition"
              >
                Go to Login
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-4">
              If you continue having issues, please request a new verification
              email from your settings page.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
