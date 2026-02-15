import { useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../../services/api";
import "./forgot-password.scss";

interface FormErrors {
  email?: string;
  general?: string;
}

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    if (!email.trim()) {
      newErrors.email = "Email is required";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setIsLoading(true);
    setErrors({});
    setSuccessMessage("");

    try {
      await api.forgotPassword(email);

      setSuccessMessage(
        "If an account with that email exists, a reset link has been sent."
      );
    } catch {
      // Always return generic message for security
      setSuccessMessage(
        "If an account with that email exists, a reset link has been sent."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login">
      <div className="login-container">
        <img src="/logo1.png" alt="Logo" />
        <h1>Forgot Password</h1>
        <p className="subtitle">
          Enter your email to receive a reset link
        </p>

        {successMessage && (
          <div className="success-message">{successMessage}</div>
        )}

        {errors.general && (
          <div className="error-message general">{errors.general}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className={errors.email ? "error" : ""}
              disabled={isLoading}
            />
            {errors.email && (
              <div className="error-message">{errors.email}</div>
            )}
          </div>

          <button
            type="submit"
            className="login-button"
            disabled={isLoading}
          >
            {isLoading ? "Sending..." : "Send Reset Link"}
          </button>
        </form>

        <div className="register-link">
          <Link to="/login">Back to login</Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
