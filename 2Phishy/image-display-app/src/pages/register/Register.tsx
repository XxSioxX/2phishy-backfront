import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useBranding } from '../../contexts/BrandingContext';
import './register.scss';

interface RegisterFormData {
    username: string;
    email: string;
    password: string;
    confirmPassword: string;
    thesisConsentAccepted: boolean;
}

interface FormErrors {
    username?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    thesisConsentAccepted?: string;
    general?: string;
}

const PASSWORD_REQUIREMENTS = [
    {
        label: "At least 12 characters",
        test: (password: string) => password.length >= 12,
    },
    {
        label: "One uppercase letter",
        test: (password: string) => /[A-Z]/.test(password),
    },
    {
        label: "One lowercase letter",
        test: (password: string) => /[a-z]/.test(password),
    },
    {
        label: "One number",
        test: (password: string) => /\d/.test(password),
    },
    {
        label: "One special character",
        test: (password: string) => /[^A-Za-z0-9]/.test(password),
    },
];

const Register: React.FC = () => {
    const navigate = useNavigate();
    const { branding } = useBranding();
    const [formData, setFormData] = useState<RegisterFormData>({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        thesisConsentAccepted: false
    });
    const [errors, setErrors] = useState<FormErrors>({});
    const [isLoading, setIsLoading] = useState(false);
    const unmetPasswordRequirements = PASSWORD_REQUIREMENTS.filter(
        requirement => !requirement.test(formData.password)
    );

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, type, value, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === "checkbox" ? checked : value
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
        } else if (unmetPasswordRequirements.length > 0) {
            newErrors.password = "Password does not meet the security requirements";
        }
        
        if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = "Passwords do not match";
        }

        if (!formData.thesisConsentAccepted) {
            newErrors.thesisConsentAccepted = "Privacy policy and thesis study consent are required";
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
                password: formData.password,
                privacy_policy_accepted: formData.thesisConsentAccepted,
                thesis_consent_accepted: formData.thesisConsentAccepted,
                consent_version: "2026-06-27"
            });
            
            navigate('/login');
        } catch (error) {
            console.error('Registration failed', error);
            setErrors({
                general: error instanceof Error
                    ? error.message
                    : "Registration failed. Please try again."
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="register">
            <div className="register-shell">
                <div className="register-container">
                    <div className="register-heading">
                        <img className="register-logo" src={branding.logo_url} alt="Logo" />
                        <h1>Create Account</h1>
                        <p className="subtitle">{branding.register_subtitle}</p>
                    </div>
                
                    {errors.general && (
                        <div className="error-message general">{errors.general}</div>
                    )}
                
                    <form onSubmit={handleSubmit}>
                        <div className="register-form-grid">
                            <div className="register-fields">
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
                                    <p className="field-note">
                                        Use an email you can access. Password recovery will be sent there.
                                    </p>
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
                                    <ul className="password-requirements" aria-label="Password requirements">
                                        {PASSWORD_REQUIREMENTS.map(requirement => {
                                            const met = requirement.test(formData.password);
                                            return (
                                                <li key={requirement.label} className={met ? "met" : ""}>
                                                    {requirement.label}
                                                </li>
                                            );
                                        })}
                                    </ul>
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
                            </div>

                            <div className="privacy-consent-panel">
                                <h2>Privacy Policy & Study Participation</h2>
                                <p>{branding.privacy_summary}</p>
                                <a href="/privacy-policy" target="_blank" rel="noreferrer">
                                    View full privacy policy
                                </a>
                                <label className="consent-checkbox">
                                    <input
                                        type="checkbox"
                                        name="thesisConsentAccepted"
                                        checked={formData.thesisConsentAccepted}
                                        onChange={handleChange}
                                        disabled={isLoading}
                                    />
                                    <span>{branding.consent_text}</span>
                                </label>
                                {errors.thesisConsentAccepted && (
                                    <div className="error-message">{errors.thesisConsentAccepted}</div>
                                )}
                            </div>
                        </div>
                      
                        <button 
                            type="submit" 
                            className="register-button"
                            disabled={isLoading || !formData.thesisConsentAccepted}
                        >
                            {isLoading ? "Creating Account..." : "Register"}
                        </button>
                    </form>
                
                    <p className="login-link">
                        Already have an account? <a href="/login">Log in</a>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Register;
