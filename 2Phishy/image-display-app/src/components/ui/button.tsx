import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive";
}

const Button: React.FC<ButtonProps> = ({ variant = "default", children, ...props }) => {
  const className = `button ${variant}`;
  return (
    <button className={className} {...props}>
      {children}
    </button>
  );
};

export default Button;