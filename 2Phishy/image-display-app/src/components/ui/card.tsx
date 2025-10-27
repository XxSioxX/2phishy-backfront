import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Card: React.FC<CardProps> = ({ children, ...props }) => {
  return (
    <div className="card" {...props}>
      {children}
    </div>
  );
};

interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardContent: React.FC<CardContentProps> = ({ children, ...props }) => {
  return (
    <div className="card-content" {...props}>
      {children}
    </div>
  );
};