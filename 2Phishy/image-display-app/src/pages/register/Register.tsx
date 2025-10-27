import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import './register.scss';

interface RegisterFormData {
    username: string;
    email: string;
    password: string;
    confirmPassword: string;
}

interface FormErrors {
    username?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    general?: string;
}

const Register: React.FC = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState<RegisterFormData>({
        username: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [errors, setErrors] = useState<FormErrors>({});
    const [isLoading, setIsLoading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        
        // Clear error when user starts typing
        if (errors[name as keyof FormErrors]) {
            setErrors(prev => ({
                ...prev,
                [name]: undefined
            }));
        }
    };

    const validateForm = (): boolean => {
        const newErrors: FormErrors = {};
        
        if (!formData.username.trim()) {
            newErrors.username = "Username is required";
        }
        
        if (!formData.email.trim()) {
            newErrors.email = "Email is required";
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
            newErrors.email = "Email is invalid";
        }
        
        if (!formData.password) {
            newErrors.password = "Password is required";
        } else if (formData.password.length < 6) {
            newErrors.password = "Password must be at least 6 characters";
        }
        
        if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = "Passwords do not match";
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
        
        try {
            await api.register({
                username: formData.username,
                email: formData.email,
                password: formData.password
            });
            
            navigate('/login');
        } catch (error) {
            console.error('Registration failed', error);
            setErrors({
                general: "Registration failed. Please try again."
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="register">
            <div className="register-container">
                <img src="/logo1.png" alt="Logo" />
                <h1>Create Account</h1>
                <p className="subtitle">Please fill in your details to register</p>
                
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
                        <label htmlFor="email">Email</label>
                        <input
                            type="email"
                            id="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="Enter your email"
                            className={errors.email ? "error" : ""}
                            disabled={isLoading}
                        />
                        {errors.email && (
                            <div className="error-message">{errors.email}</div>
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
                    
                    <div className="form-group">
                        <label htmlFor="confirmPassword">Confirm Password</label>
                        <input
                            type="password"
                            id="confirmPassword"
                            name="confirmPassword"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            placeholder="Confirm your password"
                            className={errors.confirmPassword ? "error" : ""}
                            disabled={isLoading}
                        />
                        {errors.confirmPassword && (
                            <div className="error-message">{errors.confirmPassword}</div>
                        )}
                    </div>
                    
                    <button 
                        type="submit" 
                        className="register-button"
                        disabled={isLoading}
                    >
                        {isLoading ? "Creating Account..." : "Register"}
                    </button>
                </form>
                
                <p className="login-link">
                    Already have an account? <a href="/login">Log in</a>
                </p>
            </div>
        </div>
    );
};

export default Register;