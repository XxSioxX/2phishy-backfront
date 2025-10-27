import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import "./login.scss";

interface LoginFormData {
  username: string;
  password: string;
}

interface FormErrors {
  username?: string;
  password?: string;
  general?: string;
}

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState<LoginFormData>({
    username: "",
    password: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    
    // Clear error when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({
        ...prev,
        [name]: undefined,
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    
    if (!formData.username.trim()) {
      newErrors.username = "Username is required";
    }
    
    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);
    setErrors({}); // Clear previous errors
    
    try {
      const response = await api.login(formData.username, formData.password);
      
      // Use auth context to handle login
      login(response.user, response.access_token);
      
      console.log("Login successful", response.user);
      console.log("User role:", response.user.role);
      
      // Navigate based on user role
      if (response.user.role === 'admin' || response.user.role === 'super-admin') {
        navigate("/admin");
      } else if (response.user.role === 'student') {
        navigate("/play-game"); // Redirect students to play game instead of dashboard
      } else {
        navigate("/");
      }
    } catch (error: any) {
      console.error("Login failed", error);
      
      // Better error handling
      let errorMessage = "Login failed. Please try again.";
      
      if (error.message.includes('401') || error.message.includes('Invalid')) {
        errorMessage = "Invalid username or password. Please check your credentials.";
      } else if (error.message.includes('403')) {
        errorMessage = "Account access denied. Please contact an administrator.";
      } else if (error.message.includes('Network') || error.message.includes('fetch')) {
        errorMessage = "Unable to connect to server. Please check your connection.";
      }
      
      setErrors({
        general: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login">
      <div className="login-container">
        <img src="/logo1.png" alt="Logo" />
        <h1>2Phishy Login</h1>
        <p className="subtitle">Please enter your credentials to log in</p>
        
        {errors.general && (
          <div className="error-message general">{errors.general}</div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="Enter your username"
              className={errors.username ? "error" : ""}
              disabled={isLoading}
            />
            {errors.username && (
              <div className="error-message">{errors.username}</div>
            )}
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter your password"
              className={errors.password ? "error" : ""}
              disabled={isLoading}
            />
            {errors.password && (
              <div className="error-message">{errors.password}</div>
            )}
          </div>
          
          <div className="forgot-password">
            <a href="/forgot-password">Forgot password?</a>
          </div>
          
          <button 
            type="submit" 
            className="login-button"
            disabled={isLoading}
          >
            {isLoading ? "Logging in..." : "Log In"}
          </button>
        </form>
        
        <div className="register-link">
          Don't have an account? <a href="/register">Sign up</a>
        </div>
      </div>
    </div>
  );
};

export default Login;