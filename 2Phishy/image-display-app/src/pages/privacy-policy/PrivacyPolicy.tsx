import "./privacy-policy.scss";

const PrivacyPolicy: React.FC = () => {
  return (
    <div className="privacyPolicyPage">
      <div className="privacyPolicyCard">
        <div className="privacyPolicyHeader">
          <p className="eyebrow">2Phishy</p>
          <h1>Privacy Policy</h1>
          <p className="lastUpdated">Last Updated: June 2026</p>
        </div>

        <section>
          <h2>1. Introduction</h2>
          <p>
            Welcome to 2Phishy, an educational cybersecurity awareness game designed to help users
            identify and avoid phishing attacks. This Privacy Policy explains how we collect, use,
            store, and protect information when users access and use the system.
          </p>
          <p>
            By using 2Phishy, you agree to the collection and use of information in accordance with
            this Privacy Policy.
          </p>
        </section>

        <section>
          <h2>2. Information We Collect</h2>
          <p>To provide educational services and monitor user progress, 2Phishy may collect the following information:</p>
          <h3>Account Information</h3>
          <ul>
            <li>Full name</li>
            <li>Email address</li>
            <li>Username</li>
            <li>User role such as Student, Administrator, or Super Administrator</li>
          </ul>
          <h3>Learning and Gameplay Data</h3>
          <ul>
            <li>Quiz scores</li>
            <li>Level completion records</li>
            <li>Assessment results</li>
            <li>User progress and achievements</li>
            <li>Time and date of activities</li>
          </ul>
          <h3>System Information</h3>
          <ul>
            <li>Login timestamps</li>
            <li>User activity logs</li>
            <li>Browser and device information where applicable</li>
          </ul>
        </section>

        <section>
          <h2>3. How We Use Information</h2>
          <p>The collected information is used solely for educational and administrative purposes, including:</p>
          <ul>
            <li>Providing access to the 2Phishy platform</li>
            <li>Tracking learning progress and performance</li>
            <li>Generating educational reports and analytics</li>
            <li>Improving phishing awareness training content</li>
            <li>Managing user accounts and permissions</li>
            <li>Monitoring system security and preventing unauthorized access</li>
          </ul>
        </section>

        <section>
          <h2>4. Data Protection</h2>
          <p>
            2Phishy implements reasonable technical and organizational measures to protect user
            information from unauthorized access, alteration, disclosure, or destruction.
          </p>
          <ul>
            <li>Password encryption and secure authentication</li>
            <li>Role-based access control</li>
            <li>Activity monitoring and logging</li>
            <li>Secure database storage</li>
            <li>Session management and automatic logout after inactivity</li>
          </ul>
        </section>

        <section>
          <h2>5. Data Sharing and Disclosure</h2>
          <p>2Phishy does not sell, rent, or trade user information to third parties.</p>
          <p>
            User information may only be accessed by authorized administrators for educational,
            research, system maintenance, and security monitoring purposes.
          </p>
          <p>Information may be disclosed when required by law or institutional policies.</p>
        </section>

        <section>
          <h2>6. Data Retention</h2>
          <p>User data will be retained only for as long as necessary to:</p>
          <ul>
            <li>Fulfill educational objectives</li>
            <li>Support research and evaluation activities</li>
            <li>Maintain system records and reports</li>
            <li>Comply with applicable institutional requirements</li>
          </ul>
          <p>When data is no longer required, it will be securely deleted or anonymized.</p>
        </section>

        <section>
          <h2>7. User Rights</h2>
          <p>Users have the right to:</p>
          <ul>
            <li>Access their personal information</li>
            <li>Request correction of inaccurate information</li>
            <li>Request account deactivation subject to administrative approval</li>
            <li>Inquire about how their information is used</li>
          </ul>
          <p>Requests may be submitted to the system administrator.</p>
        </section>

        <section>
          <h2>8. Research and Academic Use</h2>
          <p>
            As 2Phishy is developed as an educational cybersecurity awareness platform and academic
            research project, anonymized and aggregated performance data may be used for research
            analysis, academic presentations, thesis documentation, and system evaluation and
            improvement.
          </p>
          <p>No personally identifiable information will be publicly disclosed without user consent.</p>
        </section>

        <section>
          <h2>9. Changes to This Privacy Policy</h2>
          <p>
            This Privacy Policy may be updated periodically to reflect system improvements, legal
            requirements, or institutional policies. Users will be notified of significant changes
            when applicable.
          </p>
        </section>

        <section>
          <h2>10. Contact Information</h2>
          <p>
            For questions, concerns, or requests regarding this Privacy Policy, please contact the
            system administrator through the official 2Phishy platform.
          </p>
        </section>

        <section className="notice">
          <h2>Data Privacy Notice</h2>
          <p>
            2Phishy is committed to protecting user privacy and handling personal information
            responsibly in accordance with applicable data protection principles and educational
            research standards. All collected data is used exclusively for educational, research,
            security, and system management purposes.
          </p>
        </section>
      </div>
    </div>
  );
};

export default PrivacyPolicy;