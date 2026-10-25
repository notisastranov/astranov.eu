import React, { useState, useEffect } from 'react';

export default function KrypteiaPanel({ isOpen, onClose }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  
  const [activeTab, setActiveTab] = useState('inspect');
  const [runtimeState, setRuntimeState] = useState(null);
  const [logs, setLogs] = useState([]);
  const [scanResults, setScanResults] = useState(null);
  const [testResults, setTestResults] = useState(null);
  const [actionMessage, setActionMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Load state and logs when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchState();
      fetchLogs();
    }
  }, [isAuthenticated, activeTab]);

  if (!isOpen) return null;

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      const response = await fetch('/api/auth/owner-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, phone })
      });
      const data = await response.json();

      if (data.authorized) {
        setIsAuthenticated(true);
        setError('');
      } else {
        setError('UNAUTHORIZED IDENTITY ACCESS DENIED');
      }
    } catch (err) {
      setError('AUTHENTICATION ENDPOINT OFFLINE');
    }
  };

  const fetchState = async () => {
    try {
      const response = await fetch('/api/dev/inspect');
      const data = await response.json();
      setRuntimeState(data);
    } catch (err) {
      console.error('Failed to fetch runtime state');
    }
  };

  const fetchLogs = async () => {
    try {
      const response = await fetch('/api/logs/read');
      const data = await response.json();
      setLogs(data.logs || []);
    } catch (err) {
      console.error('Failed to fetch evolution logs');
    }
  };

  const runContaminationScan = async () => {
    setLoading(true);
    setActionMessage('Scanning codebase for banned triggers...');
    try {
      const response = await fetch('/api/dev/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'contamination' })
      });
      const data = await response.json();
      setScanResults(data);
      setActionMessage('Scan complete.');
    } catch (err) {
      setActionMessage('Scan failed to execute.');
    } finally {
      setLoading(false);
    }
  };

  const runSmokeTests = async () => {
    setLoading(true);
    setActionMessage('Executing browser smoke simulation tests...');
    try {
      const response = await fetch('/api/dev/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'smoke' })
      });
      const data = await response.json();
      setTestResults(data);
      setActionMessage('Smoke tests executed.');
      fetchLogs();
    } catch (err) {
      setActionMessage('Smoke tests failed to execute.');
    } finally {
      setLoading(false);
    }
  };

  const triggerRebuild = async () => {
    setLoading(true);
    setActionMessage('Rebuilding application slice...');
    try {
      const response = await fetch('/api/dev/rebuild', { method: 'POST' });
      const data = await response.json();
      setActionMessage(`Rebuild complete: ${data.message}`);
      fetchLogs();
    } catch (err) {
      setActionMessage('Rebuild command failed.');
    } finally {
      setLoading(false);
    }
  };

  const triggerRollback = async () => {
    setLoading(true);
    setActionMessage('Initiating codebase rollback to previous stable point...');
    try {
      const response = await fetch('/api/dev/rollback', { method: 'POST' });
      const data = await response.json();
      setActionMessage(`Rollback initiated: ${data.message}. Refresh recommended.`);
      fetchLogs();
    } catch (err) {
      setActionMessage('Rollback command failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="krypteia-overlay">
      {!isAuthenticated ? (
        <div 
          className="auth-panel"
          style={{
            background: 'var(--color-dark-surface)',
            border: '1px solid #ff3b30',
            borderRadius: '16px',
            padding: '30px',
            boxShadow: '0 0 25px rgba(255,59,48,0.2)'
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <h2 style={{ color: '#ff3b30', fontSize: '1.5rem', letterSpacing: '0.1em' }}>KRYPTEIA AUTHORIZATION</h2>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', marginTop: '6px' }}>Owner Access Point Only</p>
          </div>
          
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <input 
              type="email" 
              placeholder="Owner Email Address" 
              className="auth-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input 
              type="tel" 
              placeholder="Owner Phone Number" 
              className="auth-input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
            
            {error && (
              <div style={{ color: '#ff3b30', fontSize: '0.8rem', fontWeight: 'bold', textAlign: 'center' }}>
                ⚠️ {error}
              </div>
            )}
            
            <button type="submit" className="btn-action-red" style={{ width: '100%' }}>
              VERIFY OWNER KEY
            </button>
            <button 
              type="button" 
              onClick={onClose} 
              style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '0.8rem' }}
            >
              Abstain & Close
            </button>
          </form>
        </div>
      ) : (
        <div className="krypteia-container">
          <div className="krypteia-header">
            <div className="krypteia-title">KRYPTEIA SYSTEM ADMIN</div>
            <button className="btn-krypteia-close" onClick={onClose}>✕</button>
          </div>
          
          <div className="krypteia-content">
            <div className="krypteia-tabs">
              <button 
                className={`krypteia-tab ${activeTab === 'inspect' ? 'active' : ''}`}
                onClick={() => setActiveTab('inspect')}
              >
                Inspect State
              </button>
              <button 
                className={`krypteia-tab ${activeTab === 'law' ? 'active' : ''}`}
                onClick={() => setActiveTab('law')}
              >
                App Law
              </button>
              <button 
                className={`krypteia-tab ${activeTab === 'logs' ? 'active' : ''}`}
                onClick={() => setActiveTab('logs')}
              >
                Evolution Logs
              </button>
              <button 
                className={`krypteia-tab ${activeTab === 'control' ? 'active' : ''}`}
                onClick={() => setActiveTab('control')}
              >
                Self-Evolution
              </button>
            </div>

            {/* Inspect State Tab */}
            {activeTab === 'inspect' && (
              <div className="krypteia-grid">
                <div className="krypteia-card">
                  <h3>Runtime Statistics</h3>
                  {runtimeState ? (
                    <ul style={{ fontSize: '0.85rem', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <li>System Health: <span style={{ color: '#00ff66' }}>OPTIMAL</span></li>
                      <li>Environment: <span>Node.js / React</span></li>
                      <li>Database Store: <span>File Ledger Active</span></li>
                      <li>Active Orders: <span>{runtimeState.ordersCount || 0}</span></li>
                      <li>Accounting Entries: <span>{runtimeState.accountingCount || 0}</span></li>
                      <li>Evolution Runs: <span>{runtimeState.runsCount || 0}</span></li>
                    </ul>
                  ) : (
                    <p>Loading runtime metrics...</p>
                  )}
                </div>

                <div className="krypteia-card">
                  <h3>Owner Information</h3>
                  <ul style={{ fontSize: '0.85rem', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <li>Architect: <span>Notis Astranov</span></li>
                    <li>Email: <span>notisastranov@gmail.com</span></li>
                    <li>Phone: <span>+306971930225</span></li>
                    <li>Role: <span style={{ color: '#ff3b30', fontWeight: 'bold' }}>Architect / Administrator</span></li>
                  </ul>
                </div>
              </div>
            )}

            {/* App Law Tab */}
            {activeTab === 'law' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div className="krypteia-card">
                  <h3 style={{ color: 'var(--color-electric)' }}>Prime Identity & Role Law</h3>
                  <p style={{ fontSize: '0.85rem', lineHeight: '1.5', color: 'rgba(255,255,255,0.8)' }}>
                    Notis Astranov is the Architect. The AI is the coding engine. The AI must not redesign the architecture. The AI must translate the architecture into working code. Brand spelling: <strong>AstranoV</strong>.
                  </p>
                </div>
                <div className="krypteia-card">
                  <h3 style={{ color: 'var(--color-gold)' }}>Zero UI Law</h3>
                  <p style={{ fontSize: '0.85rem', lineHeight: '1.5', color: 'rgba(255,255,255,0.8)' }}>
                    AstranoV is clean by default. At app entry, the visible UI must show only brand logo and the living Earth. No permanent clutter. Controls appear only when required by user intent or system need.
                  </p>
                </div>
              </div>
            )}

            {/* Evolution Logs Tab */}
            {activeTab === 'logs' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div className="krypteia-card">
                  <h3>Activity Ledger Logs</h3>
                  <div className="krypteia-log-list">
                    {logs.length > 0 ? (
                      logs.map((log, index) => (
                        <div key={index} style={{ marginBottom: '8px' }}>
                          [{log.timestamp}] {log.level.toUpperCase()}: {log.message}
                        </div>
                      ))
                    ) : (
                      <div>No active evolution logs recorded.</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Self-Evolution Tab */}
            {activeTab === 'control' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button 
                    className="btn-action-red" 
                    onClick={runContaminationScan}
                    disabled={loading}
                  >
                    Run Contamination Scan
                  </button>
                  <button 
                    className="btn-action-red" 
                    onClick={runSmokeTests}
                    disabled={loading}
                  >
                    Run Smoke Tests
                  </button>
                  <button 
                    className="btn-action-red"
                    style={{ background: '#d4af37', color: '#000' }}
                    onClick={triggerRebuild}
                    disabled={loading}
                  >
                    Trigger Rebuild
                  </button>
                  <button 
                    className="btn-action-red"
                    style={{ background: 'transparent', border: '1px solid #ff3b30' }}
                    onClick={triggerRollback}
                    disabled={loading}
                  >
                    Rollback System
                  </button>
                </div>

                {actionMessage && (
                  <div style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', fontSize: '0.85rem' }}>
                    ⚙️ <strong>Status:</strong> {actionMessage}
                  </div>
                )}

                {scanResults && (
                  <div className="krypteia-card" style={{ borderColor: scanResults.clean ? '#00ff66' : '#ff3b30' }}>
                    <h3>Contamination Scan Results</h3>
                    <div style={{ fontSize: '0.85rem' }}>
                      Status: <span style={{ color: scanResults.clean ? '#00ff66' : '#ff3b30', fontWeight: 'bold' }}>
                        {scanResults.clean ? 'CLEAN (No Banned Code Found)' : 'CONTAMINATED'}
                      </span>
                      {!scanResults.clean && (
                        <ul style={{ marginTop: '10px', color: '#ff3b30' }}>
                          {scanResults.violations.map((v, i) => (
                            <li key={i}>{v.file}: line {v.line} matches "{v.match}"</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}

                {testResults && (
                  <div className="krypteia-card" style={{ borderColor: testResults.success ? '#00ff66' : '#ff3b30' }}>
                    <h3>Smoke Test Results</h3>
                    <pre style={{ fontSize: '0.75rem', background: '#000', padding: '10px', borderRadius: '6px', overflowX: 'auto', color: '#fff' }}>
                      {testResults.report}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
