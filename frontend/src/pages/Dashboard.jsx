import React, { useState } from 'react';
import ConfirmationModal from '../components/ui/ConfirmationModal';

// Render the dashboard page.
const Dashboard = () => {
  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    variant: 'default',
    onConfirm: null
  });

  // Open confirmation in the UI.
  const openConfirmation = ({ title, message, variant = 'default', onConfirm }) => {
    setModalConfig({
      isOpen: true,
      title,
      message,
      variant,
      onConfirm
    });
  };

  // Close confirmation in the UI.
  const closeConfirmation = () => {
    setModalConfig((current) => ({
      ...current,
      isOpen: false
    }));
  };

  // Handle confirm interactions.
  const handleConfirm = () => {
    modalConfig.onConfirm?.();
    closeConfirmation();
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <p style={styles.eyebrow}>Admin Dashboard</p>
          <h1 style={styles.title}>Confirmation Modal Demo</h1>
          <p style={styles.subtitle}>
            Reusable popup for delete, edit, logout, and any other important action.
          </p>
        </div>
      </div>

      <div style={styles.grid}>
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Delete Confirmation</h2>
          <p style={styles.cardText}>
            Use this when deleting a record or removing content permanently.
          </p>
          <button
            type="button"
            style={{ ...styles.button, ...styles.dangerButton }}
            onClick={() =>
              openConfirmation({
                title: 'Delete Item',
                message: 'Are you sure you want to delete this item?',
                variant: 'danger',
                onConfirm: () => console.log('Item deleted')
              })
            }
          >
            Delete Item
          </button>
        </div>

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Edit Confirmation</h2>
          <p style={styles.cardText}>
            Ask users before saving or changing sensitive record information.
          </p>
          <button
            type="button"
            style={{ ...styles.button, ...styles.primaryButton }}
            onClick={() =>
              openConfirmation({
                title: 'Edit Record',
                message: 'Do you want to edit this record?',
                variant: 'default',
                onConfirm: () => console.log('Record edited')
              })
            }
          >
            Edit Record
          </button>
        </div>

        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Logout Confirmation</h2>
          <p style={styles.cardText}>
            Show this before signing users out from the current session.
          </p>
          <button
            type="button"
            style={{ ...styles.button, ...styles.warningButton }}
            onClick={() =>
              openConfirmation({
                title: 'Logout',
                message: 'Are you sure you want to logout?',
                variant: 'warning',
                onConfirm: () => console.log('User logged out')
              })
            }
          >
            Logout
          </button>
        </div>
      </div>

      <ConfirmationModal
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        variant={modalConfig.variant}
        onConfirm={handleConfirm}
        onClose={closeConfirmation}
      />
    </div>
  );
};

const styles = {
  page: {
    minHeight: '100vh',
    padding: '40px 24px',
    background: 'linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)'
  },
  header: {
    maxWidth: '1120px',
    margin: '0 auto 28px'
  },
  eyebrow: {
    margin: '0 0 8px',
    color: '#0f766e',
    fontSize: '12px',
    fontWeight: 800,
    letterSpacing: '0.1em',
    textTransform: 'uppercase'
  },
  title: {
    margin: '0 0 10px',
    color: '#0f172a',
    fontSize: '34px',
    fontWeight: 800
  },
  subtitle: {
    margin: 0,
    maxWidth: '720px',
    color: '#475569',
    fontSize: '16px',
    lineHeight: 1.7
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '20px',
    maxWidth: '1120px',
    margin: '0 auto'
  },
  card: {
    padding: '24px',
    border: '1px solid #e2e8f0',
    borderRadius: '24px',
    background: '#ffffff',
    boxShadow: '0 18px 40px rgba(15, 23, 42, 0.08)'
  },
  cardTitle: {
    margin: '0 0 10px',
    color: '#0f172a',
    fontSize: '20px',
    fontWeight: 700
  },
  cardText: {
    margin: '0 0 18px',
    color: '#64748b',
    fontSize: '14px',
    lineHeight: 1.7
  },
  button: {
    padding: '12px 16px',
    border: 0,
    borderRadius: '14px',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer'
  },
  primaryButton: {
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
  },
  dangerButton: {
    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
  },
  warningButton: {
    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
  }
};

export default Dashboard;
