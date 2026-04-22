import React, { useState, useEffect } from 'react';
// HAPI 1: Importimi i njoftimeve nga folderi utils
import * as toast from '../utils/toast';

const PayrollPage = ({ user }) => {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [workStats, setWorkStats] = useState({ totalHours: 142, status: 'Active Now' });
  
  const [isClockedIn, setIsClockedIn] = useState(true);

  const handleClockToggle = () => {
    const newStatus = !isClockedIn;
    setIsClockedIn(newStatus);
    setWorkStats(prev => ({
      ...prev,
      status: newStatus ? 'Active Now' : 'Offline'
    }));

    // HAPI 2: Njoftimi për Clock In / Clock Out
    if (newStatus) {
      toast.success("U regjistruat me sukses! Punë të mbarë.");
    } else {
      toast.info("Dole nga sistemi. Pushim të këndshëm!");
    }
  };

  useEffect(() => {
    console.log("Duke marrë të dhënat e orës për:", user?.username);
  }, [user]);

  const calculate = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3005/api/payroll/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeName: user?.username || "Anna Lika",
          role: "Software Developer",
          hourlyRate: 15,
          hoursWorked: workStats.totalHours 
        })
      });

      if (!response.ok) throw new Error("Gabim në server");

      const data = await response.json();
      setReport(data);

      // HAPI 3: Njoftimi për suksesin e llogaritjes
      toast.success("Raporti i rrogës u gjenerua me sukses!");

    } catch (error) {
      console.error("Gabim gjatë llogaritjes:", error);
      // HAPI 4: Njoftimi në rast gabimi
      toast.error("Dështoi llogaritja e rrogës. Provo përsëri!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '40px', backgroundColor: '#f4f7f6', minHeight: '100vh', textAlign: 'center' }}>
      <h1 style={{ color: '#1a237e' }}>Sistemi i Rrogave - Nexus HR</h1>

      <div style={{ marginBottom: '30px' }}>
        <button 
          onClick={handleClockToggle}
          style={{
            padding: '10px 25px',
            backgroundColor: isClockedIn ? '#e74c3c' : '#27ae60',
            color: 'white',
            border: 'none',
            borderRadius: '50px',
            cursor: 'pointer',
            fontWeight: 'bold',
            boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
          }}
        >
          {isClockedIn ? '🛑 Clock Out' : '🕒 Clock In'}
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '30px' }}>
        <div style={styles.infoBox}>
          <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>Orët këtë muaj</p>
          <strong style={{ fontSize: '18px' }}>{workStats.totalHours} hrs</strong>
        </div>
        <div style={styles.infoBox}>
          <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>Statusi</p>
          <strong style={{ fontSize: '18px', color: isClockedIn ? '#27ae60' : '#666' }}>
            ● {workStats.status}
          </strong>
        </div>
      </div>

      <button 
        onClick={calculate}
        disabled={loading}
        style={{ 
          ...styles.button, 
          backgroundColor: loading ? '#9fa8da' : '#1a237e',
          cursor: loading ? 'not-allowed' : 'pointer' 
        }}
      >
        {loading ? 'Duke llogaritur...' : 'Gjenero Raportin e Rrogës'}
      </button>

      {report && (
        <div id="payroll-report" style={styles.card}>
          <div style={styles.header}>
            <h3>{report.header.company}</h3>
            <p>{report.header.report_type} - {report.header.date}</p>
          </div>
          <div style={styles.body}>
            <p><strong>Punonjësi:</strong> {report.employee_profile.full_name}</p>
            <p><strong>Pozicioni:</strong> {report.employee_profile.position}</p>
            <hr style={{ border: '0', borderTop: '1px solid #eee', margin: '15px 0' }} />
            
            <div style={styles.resultBox}>
              <div style={styles.row}>
                <span>Orë të regjistruara:</span>
                <span>{report.financial_summary.hours_logged}</span>
              </div>
              <div style={styles.row}>
                <span>Paga Bruto:</span>
                <span>{report.financial_summary.gross_total}</span>
              </div>
              <div style={styles.row, { color: '#e74c3c' }}>
                <span>Taksa (Deductions):</span>
                <span>{report.financial_summary.deductions}</span>
              </div>
              <hr />
              <div style={{ ...styles.row, fontWeight: 'bold', fontSize: '20px', color: '#27ae60' }}>
                <span>Neto:</span>
                <span>{report.financial_summary.final_net_salary}</span>
              </div>
            </div>
            
            <div style={{ textAlign: 'center' }}>
              <div style={styles.badge}>{report.status}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  card: { 
    background: 'white', 
    padding: '30px', 
    borderRadius: '15px', 
    boxShadow: '0 10px 30px rgba(0,0,0,0.1)', 
    maxWidth: '450px', 
    margin: '0 auto', 
    textAlign: 'left' 
  },
  header: { borderBottom: '2px solid #f1f1f1', marginBottom: '20px', paddingBottom: '10px' },
  body: { lineHeight: '1.6' },
  resultBox: { backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '10px' },
  row: { display: 'flex', justifyContent: 'space-between', marginBottom: '8px' },
  infoBox: { background: 'white', padding: '10px 20px', borderRadius: '10px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', minWidth: '120px' },
  button: { padding: '12px 24px', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', marginBottom: '30px', transition: '0.3s' },
  badge: { backgroundColor: '#27ae60', color: 'white', padding: '5px 15px', borderRadius: '20px', display: 'inline-block', marginTop: '15px', fontSize: '12px', fontWeight: 'bold' }
};

export default PayrollPage;