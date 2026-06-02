// src/pages/VerifyEmail.jsx
import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("verifying");
  const [message, setMessage] = useState("");

  const verifyEmail = useCallback(async (token) => {
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/auth/verify-email?token=${token}`);
      const data = await response.json();
      
      if (response.ok) {
        setStatus("success");
        setMessage("Email verified successfully!");
        // Store that email is verified in localStorage
        localStorage.setItem("email_verified", "true");
        // Redirect to dashboard after 3 seconds
        setTimeout(() => navigate("/dashboard", { replace: true }), 3000);
      } else {
        setStatus("error");
        setMessage(data.detail || "Verification failed. The link may have expired.");
      }
    } catch (err) {
      console.error("Verification error:", err);
      setStatus("error");
      setMessage("Connection error. Please check your internet connection and try again.");
    }
  }, [navigate]);

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      setMessage("Invalid verification link. Please check your email for the correct link.");
      return;
    }
    
    verifyEmail(token);
  }, [searchParams, verifyEmail]);

  const handleRetry = () => {
    const token = searchParams.get("token");
    if (token) {
      setStatus("verifying");
      setMessage("");
      verifyEmail(token);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020c1b] text-white">
      <div className="text-center max-w-md mx-auto px-4">
        {status === "verifying" && (
          <>
            <div className="w-12 h-12 border-4 border-teal-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-300">Verifying your email...</p>
            <p className="text-xs text-gray-500 mt-2">Please wait while we confirm your email address.</p>
          </>
        )}
        
        {status === "success" && (
          <>
            <div className="w-16 h-16 bg-teal-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <div className="text-4xl text-teal-400">✓</div>
            </div>
            <p className="text-teal-400 font-semibold">{message}</p>
            <p className="text-gray-400 text-sm mt-2">Redirecting you to the dashboard...</p>
            <div className="mt-4 w-16 h-1 bg-teal-500/30 rounded-full overflow-hidden mx-auto">
              <div className="w-full h-full bg-teal-400 rounded-full animate-pulse"></div>
            </div>
          </>
        )}
        
        {status === "error" && (
          <>
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <div className="text-4xl text-red-400">✗</div>
            </div>
            <p className="text-red-400 font-semibold">{message}</p>
            <div className="mt-6 flex gap-3 justify-center">
              <button 
                onClick={handleRetry}
                className="px-4 py-2 rounded-lg bg-teal-500/10 border border-teal-500/40 text-teal-400 text-sm hover:bg-teal-500/20 transition"
              >
                Try Again
              </button>
              <button 
                onClick={() => navigate("/")} 
                className="px-4 py-2 rounded-lg border border-gray-600 text-gray-400 text-sm hover:bg-white/5 transition"
              >
                Go to Login
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-4">
              If you continue having issues, please request a new verification email from your settings page.
            </p>
          </>
        )}
      </div>
    </div>
  );
}