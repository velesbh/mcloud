export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p><strong>Last Updated:</strong> May 14, 2026</p>
      <p>This Privacy Policy applies to MCloud, operated by <strong>Enzonic LLC</strong>, a Kentucky limited liability company. It describes how we collect, use, and protect your personal information in compliance with the <strong>Kentucky Consumer Data Protection Act (KCDPA)</strong>, effective January 1, 2026.</p>

      <h2>1. Company Information</h2>
      <p>
        <strong>Enzonic LLC</strong><br />
        State of Incorporation: Kentucky, USA<br />
        Email: <a href="mailto:admin@enzonic.com">admin@enzonic.com</a>
      </p>

      <h2>2. Information We Collect</h2>
      <p>We collect the following categories of personal data:</p>
      <ul>
        <li><strong>Account Information:</strong> Name, email address, and authentication data provided when you register through Clerk.</li>
        <li><strong>Usage Data:</strong> Server activity logs, console outputs, file uploads, and feature usage patterns.</li>
        <li><strong>Technical Data:</strong> IP addresses, browser type, device information, and cookies.</li>
        <li><strong>Payment Data:</strong> Processed by third-party payment processors; we do not store payment card details.</li>
      </ul>

      <h2>3. Purposes of Processing</h2>
      <p>We use your personal data to:</p>
      <ul>
        <li>Provide, operate, and maintain the MCloud service;</li>
        <li>Authenticate users and manage accounts securely;</li>
        <li>Process transactions and send service-related communications;</li>
        <li>Monitor and improve service performance and security;</li>
        <li>Comply with legal obligations under Kentucky and federal law.</li>
      </ul>

      <h2>4. Data Sharing with Third Parties</h2>
      <p>We share personal data with the following categories of third parties:</p>
      <ul>
        <li><strong>Clerk, Inc.</strong> — Authentication and user identity management;</li>
        <li><strong>Supabase, Inc.</strong> — Cloud database and file storage;</li>
        <li><strong>Vercel, Inc.</strong> — Hosting and deployment infrastructure;</li>
        <li><strong>Modrinth</strong> — Mod/plugin search (no personal data transmitted).</li>
      </ul>
      <p>We do not sell your personal data to third parties.</p>

      <h2>5. Your Rights Under the KCDPA</h2>
      <p>If you are a Kentucky resident, you have the right to:</p>
      <ul>
        <li><strong>Access</strong> the personal data we hold about you;</li>
        <li><strong>Correct</strong> inaccurate personal data;</li>
        <li><strong>Delete</strong> your personal data (subject to legal exceptions);</li>
        <li><strong>Opt out</strong> of the sale of personal data (we do not sell data);</li>
        <li><strong>Data portability</strong> — receive your data in a portable format.</li>
      </ul>
      <p>To exercise these rights, contact us at <a href="mailto:admin@enzonic.com">admin@enzonic.com</a>. We will respond within 45 days.</p>

      <h2>6. Data Security</h2>
      <p>We implement the following administrative, technical, and physical safeguards:</p>
      <ul>
        <li>Encrypted data transmission (TLS/HTTPS);</li>
        <li>Row-level security policies on all database tables;</li>
        <li>Access controls and authentication via Clerk;</li>
        <li>Regular security reviews and vulnerability assessments.</li>
      </ul>

      <h2>7. Data Retention</h2>
      <p>We retain personal data for as long as necessary to provide our services and comply with legal obligations. Console logs are automatically purged after 24 hours. Account data is retained until account deletion is requested.</p>

      <h2>8. Children&apos;s Privacy</h2>
      <p>MCloud is not directed at children under 13 years of age. We do not knowingly collect personal data from children under 13. If we become aware of such collection, we will promptly delete the data.</p>

      <h2>9. Changes to This Policy</h2>
      <p>We may update this Privacy Policy from time to time. We will notify you of material changes via email or a prominent notice on our website.</p>

      <h2>10. Contact Us</h2>
      <p>For privacy-related inquiries, contact us at:<br />
      <a href="mailto:admin@enzonic.com">admin@enzonic.com</a></p>
    </>
  );
}
